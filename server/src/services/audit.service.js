import { AuditLog } from '../models/index.js';
import { STAFF_ROLE_LABEL, STAFF_ROLES } from '../config/permissions.js';

/**
 * REGISTER ME LIKHNE KA EK HI DARWAZA.
 *
 * Poore app me kabhi seedha `AuditLog.create()` mat likhna — hamesha yahin se.
 * Wajah wahi jo stock aur ledger ki hai: agar likhne ki jagah dus hui, to kal
 * koi ek jagah bhool jayega aur register me chhed reh jayega. Aur chhed wala
 * register kisi kaam ka nahi hota — bharosa hi khatam.
 *
 * SABSE ZAROORI NIYAM: ye kabhi asli kaam nahi rokta.
 *
 * Register me likhna fail ho jaye to bill banna nahi ruk sakta. Isliye har
 * galti yahin pakad kar sirf log kar dete hain. Ulta hua to ek din database
 * bhar jane par poori dukaan ruk jati.
 */

/** Chhoti si value hi register me jayegi — poora object nahi */
function plain(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const t = typeof value;
  if (t === 'number' || t === 'boolean') return value;
  if (t === 'string') return value.length > 120 ? `${value.slice(0, 120)}…` : value;
  if (Array.isArray(value)) return `${value.length} cheezein`;
  return String(value).slice(0, 120);
}

const same = (a, b) => plain(a) === plain(b);

/**
 * Do haalat ka farak nikalna — sirf wahi field jo sach me badle.
 *
 * `fields` me { key: 'dikhne wala naam' } dena hota hai. Sirf wahi dekhe jate
 * hain — warna `updatedAt` jaisi cheezein har baar "badli hui" dikhti aur
 * register kachre se bhar jata.
 */
export function diff(before, after, fields) {
  const out = [];
  for (const [key, label] of Object.entries(fields)) {
    const from = before?.[key];
    const to = after?.[key];
    if (same(from, to)) continue;
    out.push({ field: key, label, from: plain(from), to: plain(to) });
  }
  return out;
}

/**
 * Register me ek line likho.
 *
 * @param {object} req   — user aur ip isi se aate hain
 * @param {object} entry — { action, entityType, entityId, entityLabel, changes, summary }
 */
export async function logAction(req, entry) {
  try {
    const user = req?.user || {};
    const staffRole = user.staffRole || STAFF_ROLES.OWNER;

    await AuditLog.create({
      businessId: req?.businessId || user.businessId,
      userId: user._id || null,
      userName: user.name || '',
      userRole: STAFF_ROLE_LABEL[staffRole] || staffRole,
      action: entry.action,
      entityType: entry.entityType || '',
      entityId: entry.entityId || null,
      entityLabel: entry.entityLabel || '',
      changes: entry.changes || [],
      summary: entry.summary || '',
      ip: req?.ip || '',
    });
  } catch (err) {
    // Jaan-boojh kar chup — register ki galti se dukaan ka kaam nahi rukega
    console.warn('[audit] likha nahi ja saka:', err.message);
  }
}

/* ───────────────────────── padhne ke liye ───────────────────────── */

/**
 * Register kholna.
 *
 * `scope` wale staff ko sirf apna kiya hua dikhta hai — warna salesman
 * doosron ka poora kaam padh leta, jo scope ka matlab hi khatam kar deta.
 */
export async function listAudit(businessId, query = {}, viewer = null) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));

  const filter = { businessId };

  if (query.userId) filter.userId = query.userId;
  if (query.action && query.action !== 'all') filter.action = new RegExp(`^${query.action}`);
  if (query.entityType && query.entityType !== 'all') filter.entityType = query.entityType;

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) filter.createdAt.$lte = new Date(`${query.to}T23:59:59.999Z`);
  }

  // Jise sirf apna data dikhta hai, use register bhi apna hi dikhega
  if (viewer && viewer.scope === 'own'
    && (viewer.staffRole || STAFF_ROLES.OWNER) !== STAFF_ROLES.OWNER) {
    filter.userId = viewer._id;
  }

  const [rows, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    rows,
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** Ek hi cheez ka poora itihaas — "is bill pe kya kya hua" */
export async function historyOf(businessId, entityType, entityId) {
  return AuditLog.find({ businessId, entityType, entityId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
}
