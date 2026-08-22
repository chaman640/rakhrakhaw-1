import mongoose from 'mongoose';
import { round2 } from '../utils/money.js';
import { Invoice, Purchase } from '../models/index.js';

/**
 * EK HI DARWAZA — "ye credit kis bill pe lagega".
 *
 * Dukaan me paisa teen tareeke se ghatta hai:
 *
 *   1. graahak ne paisa diya          (Payment)
 *   2. graahak ne maal wapas kiya     (Return / credit note)
 *   3. purana jama paisa naye bill pe lag gaya
 *
 * Teeno ka MATLAB ek hi hai — "us party ka baaki kam ho gaya" — par pehle
 * teeno alag alag jagah likhe the, aur ek to likha hi nahi tha:
 *
 *   Payment `allocateToInvoices` se bill pe lagta tha.
 *   Return  SIRF khate me credit daalta tha — bill ka `dueAmount` chhuta hi
 *           nahi tha.
 *
 * Isi ek chhoot se dukaandaar ko do jagah do alag jawab dikhte the:
 *
 *   Payment page  ->  Party.balance         ->  "kuch baaki nahi"
 *   Home / Sale   ->  sum(bill ka dueAmount) ->  "₹4,000 baaki"
 *
 * Aur bill khud kabhi "chukta" hota hi nahi tha, chahe poora maal wapas aa
 * gaya ho. Ab teeno rasta yahin se guzarte hain, isliye dono jawab hamesha
 * ek hi rahenge.
 *
 * ULTA BHI ZAROORI HAI: har allocation lauta di jati hai (`releaseCredit`),
 * taaki payment ya return mitane pe bill wapas theek ho jaye. Isliye har
 * allocation likh kar rakhi jati hai — "kitna laga tha" yaad na ho to "kitna
 * wapas karna hai" ka jawab bhi nahi hota.
 */

/*
  Bill aur purchase — dono me wahi teen field hain, bas naam alag.
  Ek hi jagah likh dene se aage koi ek taraf theek aur doosri galat nahi rehti.
*/
const DOCS = {
  Invoice: {
    model: () => Invoice,
    party: 'partyId',
    date: 'invoiceDate',
    open: { isCancelled: false },
  },
  Purchase: {
    model: () => Purchase,
    party: 'supplierId',
    date: 'purchaseDate',
    // Purchase me `isCancelled` hota hi nahi — use mitao to wo hat jati hai
    open: {},
  },
};

/**
 * Teeno field DATABASE khud ginta hai, ek hi update me.
 *
 * Pehle ye JS me ginte the: doc padho, `paidAmount + x` likho, save karo. Do
 * cheezein ek saath aayein (do payment, ya payment + return) to dono ne wahi
 * purana number padha aur wahi naya likh diya — ek ka paisa bill se gayab.
 *
 * `$min` aur `$max` ki wajah se `paidAmount` kabhi 0 se neeche ya `grandTotal`
 * se upar nahi ja sakta, chahe caller kuch bhi bheje.
 */
function paidPipeline(delta) {
  return [
    { $set: { paidAmount: { $round: [{ $min: ['$grandTotal', { $max: [0, { $add: ['$paidAmount', delta] }] }] }, 2] } } },
    { $set: { dueAmount: { $round: [{ $subtract: ['$grandTotal', '$paidAmount'] }, 2] } } },
    {
      $set: {
        paymentStatus: {
          $cond: [{ $lte: ['$paidAmount', 0] }, 'unpaid',
            { $cond: [{ $lte: ['$dueAmount', 0] }, 'paid', 'partial'] }],
        },
      },
    },
  ];
}

/**
 * Ek doc pe utna paisa lagao — par tabhi jab uspe utna baaki SACH ME ho.
 *
 * `needDue` na milne par `null` wapas aata hai (kisi aur ne beech me le liya)
 * aur bulane wala dobara dekh leta hai. Bina is check ke do ek saath chalne
 * wale kaam ek hi bill pe do baar paisa laga dete.
 */
export async function applyPaidAtomic(kind, businessId, id, delta, { needDue = 0 } = {}) {
  const cfg = DOCS[kind];
  const filter = { _id: id, businessId };
  if (needDue > 0) filter.dueAmount = { $gte: needDue };
  return cfg.model().findOneAndUpdate(filter, paidPipeline(delta), { new: true });
}

/**
 * Credit ko khule bill pe lagao.
 *
 * Kram: pehle `preferId` wala bill (agar diya ho), phir sabse PURANA khula
 * bill (FIFO) — jaise dukaan me hota hai. Jo bach jaye wo "jama paisa" hai.
 *
 * `preferId` khaas taur pe wapasi ke liye hai: agar maal kisi ek bill ka wapas
 * aaya hai to uska credit sabse pehle USI bill pe lagna chahiye, kisi purane
 * pe nahi. Warna wo bill kagaz pe udhaar dikhata rehta hai jabki uska maal
 * dukaan me wapas pada hai.
 */
export async function applyCredit(kind, businessId, partyId, amount, { preferId = null } = {}) {
  const cfg = DOCS[kind];
  const Model = cfg.model();
  let left = round2(amount);
  const allocations = [];

  if (left <= 0) return { allocations, left: 0 };

  // ---- 1. pehle jispe kaha gaya ----
  if (preferId) {
    const doc = await Model.findOne({
      _id: preferId, businessId, ...cfg.open, dueAmount: { $gt: 0 },
    }).lean();
    if (doc) {
      const apply = round2(Math.min(left, doc.dueAmount));
      if (apply > 0 && await applyPaidAtomic(kind, businessId, doc._id, apply, { needDue: apply })) {
        allocations.push({ docId: doc._id, amount: apply });
        left = round2(left - apply);
      }
    }
  }

  // ---- 2. phir sabse purana khula ----
  const openCount = await Model.countDocuments({
    businessId, [cfg.party]: partyId, ...cfg.open, dueAmount: { $gt: 0 },
  });
  // Bina aage badhe ghumte rehne se bachne ke liye — doc se zyada chakkar nahi
  let tries = openCount * 2 + 5;

  while (left > 0 && tries-- > 0) {
    const [next] = await Model.find({
      businessId, [cfg.party]: partyId, ...cfg.open, dueAmount: { $gt: 0 },
    }).sort({ [cfg.date]: 1, createdAt: 1 }).limit(1).lean();

    if (!next) break;

    const apply = round2(Math.min(left, next.dueAmount));
    if (apply <= 0) break;

    if (!(await applyPaidAtomic(kind, businessId, next._id, apply, { needDue: apply }))) continue;

    allocations.push({ docId: next._id, amount: apply });
    left = round2(left - apply);
  }

  return { allocations, left };
}

/** Jo laga tha wo poora wapas — payment ya return mitane par */
export async function releaseCredit(kind, businessId, allocations = []) {
  for (const a of allocations) {
    const id = a.docId || a.invoiceId || a.purchaseId;
    if (!id || !a.amount) continue;
    await applyPaidAtomic(kind, businessId, id, -a.amount);
  }
}

/**
 * Is party ne kitna maal LIYA aur kitna PEHLE HI WAPAS kar chuka hai.
 *
 * Ye jaanch pehle SIRF tab hoti thi jab wapasi kisi ek bill se judi ho. Bina
 * bill wali wapasi pe koi hadd thi hi nahi — yaani 10 piece kharid kar 50
 * wapas kiye ja sakte the, aur uska poora credit khate me chala jata tha.
 * Dukaan ke liye ye seedha paisa ka nuksan hai.
 */
export async function tradedQty(kind, businessId, partyId, itemIds = []) {
  const cfg = DOCS[kind];
  const bid = new mongoose.Types.ObjectId(String(businessId));
  const pid = new mongoose.Types.ObjectId(String(partyId));
  const ids = itemIds.map((i) => new mongoose.Types.ObjectId(String(i)));

  const rows = await cfg.model().aggregate([
    { $match: { businessId: bid, [cfg.party]: pid, ...cfg.open } },
    { $unwind: '$items' },
    { $match: { 'items.itemId': { $in: ids } } },
    { $group: { _id: '$items.itemId', qty: { $sum: '$items.qty' } } },
  ]);

  return Object.fromEntries(rows.map((r) => [String(r._id), round2(r.qty)]));
}
