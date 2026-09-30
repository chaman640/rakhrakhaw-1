import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { round2 } from '../utils/money.js';
import { istDay, istStart } from '../utils/istDay.js';
import { PARTY_TYPES, NOTIFICATION_TYPES } from '../config/constants.js';
import {
  Quotation, Party, Lead, Item, Business, Counter, CrmTask,
} from '../models/index.js';
import { isScoped, canSeeParty, ownPartyIds } from '../utils/scope.js';
import { resolveRates } from './rate.service.js';
import { createSellerOrder } from './order.service.js';
import { convertLead } from './crmWork.service.js';
import { notifyRetailer } from './notification.service.js';

const esc = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const EDITABLE = ['draft', 'sent'];

async function scopeFilter(businessId, user) {
  if (!isScoped(user)) return {};
  const [parties, leads] = await Promise.all([
    ownPartyIds(businessId, user),
    Lead.find({ businessId, $or: [{ assignedToUserId: user._id }, { createdBy: user._id }] }).distinct('_id'),
  ]);
  return { $or: [{ createdBy: user._id }, { assignedToUserId: user._id }, { partyId: { $in: parties } }, { leadId: { $in: leads } }] };
}

/** Sent quotes past their validity date become expired */
async function expireOld(businessId) {
  await Quotation.updateMany(
    { businessId, status: 'sent', validUntil: { $ne: null, $lt: istStart(istDay()) } },
    { $set: { status: 'expired', decidedAt: new Date() } },
  );
}

async function customerOf(businessId, user, { partyId, leadId }) {
  if (partyId) {
    const p = await Party.findOne({ _id: partyId, businessId, type: PARTY_TYPES.RETAILER }).select('name shopName phone address gstin').lean();
    if (!p || (isScoped(user) && !(await canSeeParty(p._id, businessId, user)))) throw ApiError.badRequest('Customer not found');
    return { partyId: p._id, leadId: null, customer: { name: p.name, shopName: p.shopName || '', phone: p.phone || '', city: p.address?.city || '', gstin: p.gstin || '' } };
  }
  if (leadId) {
    const l = await Lead.findOne({ _id: leadId, businessId }).select('name shopName phone city partyId assignedToUserId createdBy').lean();
    if (!l) throw ApiError.badRequest('Lead not found');
    if (isScoped(user) && ![String(l.assignedToUserId), String(l.createdBy)].includes(String(user._id))) throw ApiError.badRequest('Lead not found');
    if (l.partyId) return customerOf(businessId, user, { partyId: l.partyId });
    return { partyId: null, leadId: l._id, customer: { name: l.name, shopName: l.shopName || '', phone: l.phone || '', city: l.city || '', gstin: '' } };
  }
  throw ApiError.badRequest('Choose a customer or a lead');
}

async function priceLines(businessId, partyId, lines) {
  const items = await Item.find({ _id: { $in: lines.map((l) => l.itemId) }, businessId, isActive: true })
    .select('name unit hsn gstRate salePrice wholesalePrice').lean();
  const byId = new Map(items.map((i) => [String(i._id), i]));
  const rates = new Map((await resolveRates(businessId, partyId, items)).map((i) => [String(i._id), i.rate]));
  const biz = await Business.findById(businessId).select('gstEnabled').lean();
  const gst = Boolean(biz?.gstEnabled);
  return lines.map((l) => {
    const it = byId.get(String(l.itemId));
    if (!it) throw ApiError.badRequest('An item is no longer available');
    const rate = round2(l.rate ?? rates.get(String(l.itemId)) ?? 0);
    const qty = round2(l.qty);
    const discountPct = round2(l.discountPct || 0);
    const gross = round2(qty * rate);
    const taxable = round2(gross * (1 - discountPct / 100));
    const gstRate = gst ? (it.gstRate || 0) : 0;
    const tax = round2((taxable * gstRate) / 100);
    return { itemId: it._id, name: it.name, hsn: it.hsn || '', unit: it.unit, qty, rate, discountPct, gstRate, taxable, tax, amount: round2(taxable + tax) };
  });
}

function totals(items) {
  const subTotal = round2(items.reduce((a, l) => a + l.qty * l.rate, 0));
  const taxableTotal = round2(items.reduce((a, l) => a + l.taxable, 0));
  const taxTotal = round2(items.reduce((a, l) => a + l.tax, 0));
  return { subTotal, discountTotal: round2(subTotal - taxableTotal), taxTotal, total: Math.round(taxableTotal + taxTotal) };
}

export async function listQuotations(businessId, user, { status = '', q = '', partyId = '', page = 1, limit = 25 }) {
  await expireOld(businessId);
  const f = { businessId, ...(await scopeFilter(businessId, user)) };
  if (status === 'open') f.status = { $in: ['draft', 'sent', 'accepted'] };
  else if (status) f.status = status;
  if (partyId) f.partyId = partyId;
  if (q) {
    const rx = new RegExp(esc(q), 'i');
    f.$and = [{ $or: [{ quoteNo: rx }, { 'customer.name': rx }, { 'customer.shopName': rx }, { 'customer.phone': rx }] }];
  }
  const [rows, total, counts] = await Promise.all([
    Quotation.find(f).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('-items').lean(),
    Quotation.countDocuments(f),
    Quotation.aggregate([{ $match: { businessId: new mongoose.Types.ObjectId(String(businessId)) } }, { $group: { _id: '$status', n: { $sum: 1 }, value: { $sum: '$total' } } }]),
  ]);
  return { rows, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), counts: Object.fromEntries(counts.map((c) => [c._id, { count: c.n, value: c.value }])) } };
}

export async function getQuotation(businessId, user, id) {
  await expireOld(businessId);
  const qd = await Quotation.findOne({ _id: id, businessId, ...(await scopeFilter(businessId, user)) }).lean();
  if (!qd) throw ApiError.notFound('Quotation not found');
  const [biz, revisions] = await Promise.all([
    Business.findById(businessId).select('name phone gstin address logoUrl').lean(),
    Quotation.find({ businessId, $or: [{ revisionOf: qd._id }, ...(qd.revisionOf ? [{ _id: qd.revisionOf }] : [])] }).select('quoteNo status total createdAt').lean(),
  ]);
  return { ...qd, business: biz, revisions };
}

export async function createQuotation(businessId, user, body) {
  const who = await customerOf(businessId, user, body);
  const items = await priceLines(businessId, who.partyId, body.items);
  const { number } = await Counter.nextNumber({ businessId, key: 'quotation', prefix: 'QT' });
  const qd = await Quotation.create({
    businessId, quoteNo: number, ...who, items, ...totals(items),
    validUntil: body.validUntil || new Date(Date.now() + 15 * 86400000),
    notes: body.notes || '', terms: body.terms || '', deliveryTerms: body.deliveryTerms || '', paymentTerms: body.paymentTerms || '',
    revisionOf: body.revisionOf || null, assignedToUserId: user._id, createdBy: user._id,
  });
  return getQuotation(businessId, user, qd._id);
}

export async function updateQuotation(businessId, user, id, body) {
  const qd = await Quotation.findOne({ _id: id, businessId, ...(await scopeFilter(businessId, user)) });
  if (!qd) throw ApiError.notFound('Quotation not found');
  if (!EDITABLE.includes(qd.status)) throw ApiError.badRequest('Only draft or sent quotations can be edited — make a revision instead');
  if (body.items) {
    qd.items = await priceLines(businessId, qd.partyId, body.items);
    Object.assign(qd, totals(qd.items));
  }
  for (const k of ['validUntil', 'notes', 'terms', 'deliveryTerms', 'paymentTerms']) if (body[k] !== undefined) qd[k] = body[k];
  await qd.save();
  return getQuotation(businessId, user, id);
}

/** New version of an old quote; the old one is closed as rejected */
export async function reviseQuotation(businessId, user, id) {
  const old = await Quotation.findOne({ _id: id, businessId, ...(await scopeFilter(businessId, user)) }).lean();
  if (!old) throw ApiError.notFound('Quotation not found');
  if (old.status === 'converted') throw ApiError.badRequest('This quotation is already an order');
  const next = await createQuotation(businessId, user, {
    partyId: old.partyId, leadId: old.leadId, items: old.items.map((l) => ({ itemId: l.itemId, qty: l.qty, rate: l.rate, discountPct: l.discountPct })),
    notes: old.notes, terms: old.terms, deliveryTerms: old.deliveryTerms, paymentTerms: old.paymentTerms, revisionOf: old._id,
  });
  if (['draft', 'sent', 'accepted', 'expired'].includes(old.status)) {
    await Quotation.updateOne({ _id: old._id }, { $set: { status: 'rejected', rejectReason: `Revised as ${next.quoteNo}`, decidedAt: new Date() } });
  }
  return next;
}

const FLOW = { draft: ['sent'], sent: ['accepted', 'rejected'], expired: ['sent'], accepted: ['rejected'] };

export async function setQuotationStatus(businessId, user, id, { status, reason = '' }) {
  const qd = await Quotation.findOne({ _id: id, businessId, ...(await scopeFilter(businessId, user)) });
  if (!qd) throw ApiError.notFound('Quotation not found');
  if (!(FLOW[qd.status] || []).includes(status)) throw ApiError.badRequest(`A ${qd.status} quotation cannot be marked ${status}`);
  if (status === 'sent' && qd.validUntil && qd.validUntil < istStart(istDay())) throw ApiError.badRequest('Validity date has passed — change it first');
  qd.status = status;
  if (status === 'sent') {
    qd.sentAt = new Date();
    if (qd.partyId) {
      await notifyRetailer(businessId, qd.partyId, { type: NOTIFICATION_TYPES.ORDER_STATUS, title: `Quotation ${qd.quoteNo}`, body: `Total ₹${qd.total}`, link: '/notifications' }).catch(() => {});
    }
    if (qd.leadId) {
      await Lead.updateOne({ _id: qd.leadId, stage: { $in: ['new', 'contacted', 'interested'] } }, { $set: { stage: 'quotation', stageChangedAt: new Date(), lastContactAt: new Date() } });
    }
  } else {
    qd.decidedAt = new Date();
    if (status === 'rejected') qd.rejectReason = reason;
    if (status === 'accepted' && qd.leadId) await Lead.updateOne({ _id: qd.leadId, stage: { $nin: ['won', 'lost'] } }, { $set: { stage: 'negotiation', stageChangedAt: new Date() } });
  }
  await qd.save();
  await CrmTask.updateMany({ businessId, autoKey: `quote:${qd._id}`, status: { $ne: 'done' } }, { $set: { status: 'done', doneAt: new Date(), doneNote: `Quotation ${status}` } }).catch(() => {});
  return getQuotation(businessId, user, id);
}

/** Won quote → sales order (turns the lead into a customer first when needed) */
export async function convertToOrder(businessId, user, id, { expectedDeliveryAt = null, paymentMode } = {}) {
  const qd = await Quotation.findOne({ _id: id, businessId, ...(await scopeFilter(businessId, user)) });
  if (!qd) throw ApiError.notFound('Quotation not found');
  if (qd.status === 'converted') throw ApiError.conflict('Already converted to an order');
  if (!['sent', 'accepted'].includes(qd.status)) throw ApiError.badRequest('Send the quotation or mark it accepted first');
  const claimed = await Quotation.findOneAndUpdate({ _id: qd._id, status: qd.status }, { $set: { status: 'converted' } });
  if (!claimed) throw ApiError.badRequest('Quotation changed — reload and try again');
  try {
    let partyId = qd.partyId;
    if (!partyId && qd.leadId) {
      const lead = await convertLead(businessId, user, qd.leadId);
      partyId = lead.partyId;
    }
    const order = await createSellerOrder(businessId, {
      partyId,
      items: qd.items.map((l) => ({ itemId: l.itemId, qty: l.qty, rate: round2(l.taxable / l.qty) })),
      note: `From quotation ${qd.quoteNo}`, paymentMode, expectedDeliveryAt, source: 'quotation', quotationId: qd._id,
    }, user._id, user);
    await Quotation.updateOne({ _id: qd._id }, { $set: { orderId: order._id, partyId, decidedAt: new Date() } });
    await CrmTask.updateMany({ businessId, autoKey: `quote:${qd._id}`, status: { $ne: 'done' } }, { $set: { status: 'done', doneAt: new Date(), doneNote: 'Order received' } });
    return { quotation: await getQuotation(businessId, user, id), order };
  } catch (e) {
    await Quotation.updateOne({ _id: qd._id }, { $set: { status: qd.status } });
    throw e;
  }
}

export async function deleteQuotation(businessId, user, id) {
  const qd = await Quotation.findOne({ _id: id, businessId, ...(await scopeFilter(businessId, user)) }).lean();
  if (!qd) throw ApiError.notFound('Quotation not found');
  if (qd.status !== 'draft') throw ApiError.badRequest('Only drafts can be deleted — mark others as rejected');
  await Quotation.deleteOne({ _id: id });
  return { deleted: true };
}
