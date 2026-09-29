import { PLANS, PLAN_BY_CODE } from '../config/billing.js';
import { FEATURES, FEATURE_BY_KEY } from '../config/features.js';
import { PlatformConfig } from '../models/index.js';
import { cacheDel } from '../utils/cache.js';
import ApiError from '../utils/ApiError.js';

/**
 * PLATFORM KI SETTING — padhna, lagana, badalna.
 *
 * Plan ka naam/daam/seat admin badal sakta hai. Poora app `PLANS` /
 * `PLAN_BY_CODE` (config/billing.js) seedha padhta hai — isliye override
 * UNHI objects pe laga diye jate hain. Ek hi jagah badla, har jagah dikha;
 * sau jagah "config se padho ya DB se" likhne ki zarurat nahi.
 *
 * Code wala default ek baar yahan copy kar liya jata hai, taaki admin koi
 * badlav hataye to plan wapas asli pe aa sake.
 */
const DEFAULT_PLANS = new Map(PLANS.map((p) => [p.code, { ...p, features: [...(p.features || [])] }]));

const DEFAULTS = { trialDays: 15, trialPlanCode: 'BADHTI', supportPhone: '', supportEmail: '' };

let current = { ...DEFAULTS, featurePlans: {}, featureOff: [], plans: [] };
let loadedAt = 0;
const REFRESH_MS = 60_000;   // kai server hon to doosre ka badlav minute bhar me pahunch jaye

function applyPlans(overrides = []) {
  const byCode = new Map(overrides.map((o) => [o.code, o]));
  for (const p of PLANS) {
    const base = DEFAULT_PLANS.get(p.code);
    Object.assign(p, { ...base, features: [...base.features], active: true });
    const o = byCode.get(p.code);
    if (!o) continue;
    if (o.name) p.name = o.name;
    if (o.tagline !== undefined && o.tagline !== null) p.tagline = o.tagline;
    if (Array.isArray(o.features) && o.features.length) p.features = [...o.features];
    if (typeof o.active === 'boolean') p.active = o.active;
    // FREE ka daam kabhi nahi badalta — wo kharidne walon ka hai
    if (p.pricePaise > 0 && Number(o.pricePaise) > 0) p.pricePaise = Math.round(Number(o.pricePaise));
    if (o.unlimited === true) p.seats = null;
    else if (Number(o.seats) > 0) p.seats = Math.round(Number(o.seats));
  }
  cacheDel('plans');
}

function toPlain(doc) {
  if (!doc) return { ...DEFAULTS, featurePlans: {}, featureOff: [], plans: [] };
  const fp = doc.featurePlans instanceof Map ? Object.fromEntries(doc.featurePlans) : (doc.featurePlans || {});
  return {
    trialDays: doc.trialDays ?? DEFAULTS.trialDays,
    trialPlanCode: doc.trialPlanCode || DEFAULTS.trialPlanCode,
    supportPhone: doc.supportPhone || '',
    supportEmail: doc.supportEmail || '',
    featurePlans: fp,
    featureOff: doc.featureOff || [],
    plans: (doc.plans || []).map((p) => (p.toObject ? p.toObject() : p)),
    updatedAt: doc.updatedAt || null,
  };
}

/** Server shuru hote hi, aur har badlav ke baad */
export async function loadPlatformConfig() {
  const doc = await PlatformConfig.findOne({ key: 'main' }).lean();
  current = toPlain(doc);
  applyPlans(current.plans);
  loadedAt = Date.now();
  return current;
}

/** Abhi ki setting — minute purani ho to peeche se taaza */
export function platformConfig() {
  if (Date.now() - loadedAt > REFRESH_MS) {
    loadedAt = Date.now();                       // ek hi baar dobara padho
    loadPlatformConfig().catch(() => {});
  }
  return current;
}

/* ─────────────────────────────── feature ─────────────────────────────── */

/** Is feature ke liye kaunse plan */
export function plansForFeature(key) {
  const f = FEATURE_BY_KEY[key];
  if (!f) return [];
  const cfg = platformConfig();
  if ((cfg.featureOff || []).includes(key)) return [];
  const custom = cfg.featurePlans?.[key];
  return Array.isArray(custom) ? custom : f.plans;
}

export function planHasFeature(planCode, key) {
  return plansForFeature(key).includes(planCode);
}

/** Ek plan ke saare feature — client ko ek baar me */
export function featuresOfPlan(planCode) {
  return FEATURES.filter((f) => planHasFeature(planCode, f.key)).map((f) => f.key);
}

/** "Ye feature kis sabse saste plan me hai" — upgrade screen ke liye */
export function cheapestPlanFor(key) {
  const allowed = plansForFeature(key);
  return PLANS
    .filter((p) => p.pricePaise > 0 && p.active !== false && allowed.includes(p.code))
    .sort((a, b) => a.pricePaise - b.pricePaise)[0] || null;
}

export function featureMatrix() {
  return FEATURES.map((f) => ({
    key: f.key, name: f.name, desc: f.desc,
    defaultPlans: f.plans,
    plans: plansForFeature(f.key),
    off: (platformConfig().featureOff || []).includes(f.key),
  }));
}

/* ─────────────────────────────── badalna (admin) ─────────────────────────────── */

export async function updatePlatformConfig(patch, adminId) {
  const doc = await PlatformConfig.findOne({ key: 'main' }) || new PlatformConfig({ key: 'main' });
  const before = toPlain(doc.toObject ? doc.toObject() : doc);

  if (patch.trialDays !== undefined) doc.trialDays = patch.trialDays;
  if (patch.trialPlanCode !== undefined) {
    const p = PLAN_BY_CODE[patch.trialPlanCode];
    if (!p || p.pricePaise <= 0) throw ApiError.badRequest('Trial sirf kisi paid plan pe ho sakta hai');
    doc.trialPlanCode = patch.trialPlanCode;
  }
  if (patch.supportPhone !== undefined) doc.supportPhone = patch.supportPhone;
  if (patch.supportEmail !== undefined) doc.supportEmail = patch.supportEmail;

  if (Array.isArray(patch.plans)) {
    for (const o of patch.plans) {
      if (!PLAN_BY_CODE[o.code]) throw ApiError.badRequest(`Plan ${o.code} nahi hai`);
    }
    doc.plans = patch.plans;
  }
  if (patch.featurePlans) {
    for (const [key, plans] of Object.entries(patch.featurePlans)) {
      if (!FEATURE_BY_KEY[key]) throw ApiError.badRequest(`Feature ${key} nahi hai`);
      if (!Array.isArray(plans) || plans.some((c) => !PLAN_BY_CODE[c])) {
        throw ApiError.badRequest(`${key}: plan galat hai`);
      }
      doc.featurePlans.set(key, plans);
    }
  }
  if (Array.isArray(patch.featureOff)) {
    if (patch.featureOff.some((k) => !FEATURE_BY_KEY[k])) throw ApiError.badRequest('Feature galat hai');
    doc.featureOff = patch.featureOff;
  }
  doc.updatedByAdminId = adminId || null;
  await doc.save();

  const after = await loadPlatformConfig();
  return { before, after };
}
