/**
 * SELF CHECK — bina database ke chalne wala test.
 *
 *   npm run selfcheck
 *
 * `npm run smoke` asli API asli database pe chalata hai — wo sabse sacha test
 * hai, par uske liye MongoDB chahiye. Ye wala kuch nahi maangta: na database,
 * na internet. Isliye ye har machine pe, har baar, das second me chal jata hai.
 *
 * Kya jaanchta hai — wahi teen cheezein jinme galti sabse mehngi padti hai:
 *
 *   1. "KAUN SI DUKAAN" ka faisla (`withBuyerTenant`).
 *      Yahan ek galti ka matlab hai kisi aur ki dukaan ka maal, rate aur khata
 *      dikhna. Ye bug dikhta nahi — screen bilkul theek lagti hai — isliye iska
 *      test sabse zaroori hai.
 *
 *   2. "KISKO KHAREEDNE KA HAQ" (`requireBuyer`).
 *      Godown incharge ko milna chahiye, salesman ko nahi.
 *
 *   3. Buy-side ke saare router usi ek pehre se guzarte hain ya nahi.
 *      Ek naya route jodte waqt purana `requireRole(RETAILER)` copy kar lena
 *      sabse aasan galti hai — aur usse wo route wholesaler ke liye chup-chaap
 *      band ho jata hai.
 *
 * Database ke bina model kaise chale: mongoose ke model ke `find`/`findOne`
 * yahan apne nakli jawab se badal diye jate hain. Middleware ko farak nahi
 * padta — wo wahi model uthata hai aur wahi method bulata hai.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { requireBuyer } from '../src/middleware/auth.js';
import { withBuyerTenant, requireActiveParty, withTenant } from '../src/middleware/tenant.js';
import { buyerFilter, buyerFields } from '../src/utils/buyer.js';
import { Membership, Party } from '../src/models/index.js';
import { ROLES, PARTY_STATUS } from '../src/config/constants.js';
import { checkoutSchema } from '../src/validators/buy.validator.js';
import { decideLineSchema, finishIntakeSchema } from '../src/validators/intake.validator.js';
import { StockIntake } from '../src/models/index.js';
import { lineFromInvoiceItem } from '../src/services/intake.service.js';
import { unappliedCredit, splitBalance } from '../src/services/balance.service.js';
import { round2 } from '../src/utils/money.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { assertOtpToken } from '../src/services/otp.service.js';
import {
  sendOtpSchema, verifyOtpSchema, resetPasswordSchema, wholesalerSignupSchema,
} from '../src/validators/auth.validator.js';
import { permissionsForRole, STAFF_ROLES } from '../src/config/permissions.js';

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', N = '\x1b[0m';

let passed = 0, failed = 0;
const results = [];

function check(name, condition, extra = '') {
  if (condition) { passed += 1; results.push(`${G}  ✔${N} ${name}`); }
  else { failed += 1; results.push(`${R}  ✖${N} ${name} ${D}${extra}${N}`); }
}

/* ────────────────────────── nakli id aur nakli data ────────────────────────── */

const id = (n) => String(n).padStart(24, '0');

const W1_BIZ = id(11);     // hamari apni dukaan
const BIG_BIZ = id(22);    // bade wholesaler ki dukaan
const OTHER_BIZ = id(33);  // koi teesri dukaan — isse hum jude hi nahi hain
const R_USER = id(44);
const W_USER = id(55);
const PARTY_IN_BIG = id(66);
const PARTY_IN_W1 = id(77);

/** Nakli membership ki tijori — jaise database me pade hon */
let rows = [];

function matches(row, filter) {
  return Object.entries(filter).every(([k, v]) => String(row[k] || '') === String(v || ''));
}

Membership.findOne = (filter) => ({ lean: async () => rows.find((x) => matches(x, filter)) || null });
Membership.find = (filter) => ({
  sort: () => ({ limit: () => ({ lean: async () => rows.filter((x) => matches(x, filter)) }) }),
});

let partyRow = null;
Party.findOne = () => ({ select: () => ({ lean: async () => partyRow }) });

/** Middleware chalao aur bas itna batao ki error aaya ya nahi */
function run(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, {}, (err) => resolve(err || null));
  });
}

const makeReq = (user, shopId = null) => ({
  user,
  get: (name) => (String(name).toLowerCase() === 'x-shop-id' ? shopId : undefined),
});

const retailer = { _id: R_USER, role: ROLES.RETAILER, businessId: W1_BIZ, partyId: PARTY_IN_W1 };
const owner = {
  _id: W_USER, role: ROLES.WHOLESALER, businessId: W1_BIZ,
  staffRole: STAFF_ROLES.OWNER, permissions: [],
};
const storekeeper = {
  _id: id(56), role: ROLES.WHOLESALER, businessId: W1_BIZ,
  staffRole: STAFF_ROLES.STOREKEEPER, permissions: permissionsForRole(STAFF_ROLES.STOREKEEPER),
};
const salesman = {
  _id: id(57), role: ROLES.WHOLESALER, businessId: W1_BIZ,
  staffRole: STAFF_ROLES.SALESMAN, permissions: permissionsForRole(STAFF_ROLES.SALESMAN),
};

async function main() {
  console.log(`\n${Y}Rakh Rakhav — self check (bina database ke)${N}\n`);

  /* ═════════════════════ 1. kharidaar kaun ═════════════════════ */
  console.log(`${Y}Kharidaar kaun hai${N}`);

  check('retailer ka rishta uske apne login se juda hai',
    JSON.stringify(buyerFilter(retailer)) === JSON.stringify({ userId: R_USER }),
    JSON.stringify(buyerFilter(retailer)));

  check('wholesaler ka rishta uski DUKAAN se juda hai (aadmi se nahi)',
    JSON.stringify(buyerFilter(owner)) === JSON.stringify({ buyerBusinessId: W1_BIZ }),
    JSON.stringify(buyerFilter(owner)));

  check('malik aur godown incharge — dono ka rishta ek hi',
    JSON.stringify(buyerFilter(owner)) === JSON.stringify(buyerFilter(storekeeper)),
    'staff badalne se dukaan ka rishta nahi badalna chahiye');

  check('nayi entry me do me se ek hi khaana bharta hai',
    buyerFields(retailer).buyerBusinessId === null && buyerFields(owner).userId === null,
    JSON.stringify([buyerFields(retailer), buyerFields(owner)]));

  /* ═════════════════════ 2. khareedne ka haq ═════════════════════ */
  console.log(`\n${Y}Kisko khareedne ka haq${N}`);

  check('retailer khareed sakta hai', (await run(requireBuyer, makeReq(retailer))) === null);
  check('malik khareed sakta hai', (await run(requireBuyer, makeReq(owner))) === null);
  check('GODOWN INCHARGE khareed sakta hai',
    (await run(requireBuyer, makeReq(storekeeper))) === null,
    'uske role me purchases:create pehle se hai');

  const salesErr = await run(requireBuyer, makeReq(salesman));
  check('salesman nahi khareed sakta', salesErr?.statusCode === 403, `status ${salesErr?.statusCode}`);
  check('...aur use saaf bataya gaya ki kis cheez ki ijazat chahiye',
    salesErr?.details?.needed?.includes('purchases:create'), JSON.stringify(salesErr?.details));

  check('bina login koi nahi', (await run(requireBuyer, makeReq(null)))?.statusCode === 401);

  /* ═════════════════════ 3. kaunsi dukaan ═════════════════════ */
  console.log(`\n${Y}Kaunsi dukaan (sabse zaroori)${N}`);

  // -- purana rasta: retailer, bina header --
  rows = [];
  let req = makeReq(retailer);
  let err = await run(withBuyerTenant, req);
  check('PURANA RASTA: retailer bina header ke apni hi dukaan me raha',
    err === null && String(req.businessId) === W1_BIZ && String(req.partyId) === PARTY_IN_W1,
    `${err?.message || `${req.businessId} / ${req.partyId}`}`);

  // -- retailer, doosri dukaan se juda hua --
  rows = [{ userId: R_USER, businessId: BIG_BIZ, partyId: PARTY_IN_BIG }];
  req = makeReq(retailer, BIG_BIZ);
  err = await run(withBuyerTenant, req);
  check('header dene par retailer doosri dukaan me pahuncha',
    err === null && String(req.businessId) === BIG_BIZ && String(req.partyId) === PARTY_IN_BIG,
    `${err?.message || `${req.businessId} / ${req.partyId}`}`);

  req = makeReq(retailer);
  err = await run(withBuyerTenant, req);
  check('header hataate hi wapas apni purani dukaan me',
    err === null && String(req.businessId) === W1_BIZ,
    `${err?.message || req.businessId}`);

  // -- jisse jude nahi --
  req = makeReq(retailer, OTHER_BIZ);
  err = await run(withBuyerTenant, req);
  check('JISSE JUDE NAHI uski dukaan band rahi', err?.statusCode === 403, `status ${err?.statusCode}`);

  // -- galat shakal ki id --
  req = makeReq(retailer, 'kuch-bhi');
  err = await run(withBuyerTenant, req);
  check('galat shakal ki id reject hui', err?.statusCode === 400, `status ${err?.statusCode}`);

  // -- wholesaler, ek bhi dukaan judi nahi --
  rows = [];
  req = makeReq(owner);
  err = await run(withBuyerTenant, req);
  check('bina dukaan jude wholesaler ko rasta nahi mila', err?.statusCode === 400, `status ${err?.statusCode}`);

  // -- wholesaler, ek hi dukaan judi --
  rows = [{ buyerBusinessId: W1_BIZ, businessId: BIG_BIZ, partyId: PARTY_IN_BIG }];
  req = makeReq(owner);
  err = await run(withBuyerTenant, req);
  check('ek hi dukaan judi ho to bina poochhe wahi chun li',
    err === null && String(req.businessId) === BIG_BIZ,
    `${err?.message || req.businessId}`);

  // -- wholesaler, do dukaan judi --
  rows = [
    { buyerBusinessId: W1_BIZ, businessId: BIG_BIZ, partyId: PARTY_IN_BIG },
    { buyerBusinessId: W1_BIZ, businessId: OTHER_BIZ, partyId: id(88) },
  ];
  req = makeReq(owner);
  err = await run(withBuyerTenant, req);
  check('do dukaan judi hon to andaza nahi lagaya — poochha gaya',
    err?.statusCode === 400, `status ${err?.statusCode}`);

  req = makeReq(owner, OTHER_BIZ);
  err = await run(withBuyerTenant, req);
  check('chuni hui dukaan wahi khuli jo maangi thi',
    err === null && String(req.businessId) === OTHER_BIZ, `${err?.message || req.businessId}`);

  // -- staff ko malik wali dukaan dikhti hai --
  req = makeReq(storekeeper, BIG_BIZ);
  err = await run(withBuyerTenant, req);
  check('malik ne jo dukaan jodi, wahi godown incharge ko bhi mili',
    err === null && String(req.partyId) === PARTY_IN_BIG, `${err?.message || req.partyId}`);

  /* ═════════════════════ 4. bechne wala rasta ═════════════════════ */
  console.log(`\n${Y}Bechne wala rasta (kuch badla to nahi)${N}`);

  req = makeReq(owner, BIG_BIZ);
  err = await run(withTenant, req);
  check('SELLER side header ko dekhta hi nahi — apni hi dukaan',
    err === null && String(req.businessId) === W1_BIZ, `${err?.message || req.businessId}`);
  check('...aur wahan koi party nahi hoti', req.partyId === null, `${req.partyId}`);

  /* ═════════════════════ 5. approve hua ya nahi ═════════════════════ */
  console.log(`\n${Y}Approve hua ya nahi${N}`);

  partyRow = { _id: PARTY_IN_BIG, status: PARTY_STATUS.ACTIVE, name: 'Hamari Dukaan' };
  req = { user: retailer, businessId: BIG_BIZ, partyId: PARTY_IN_BIG, get: () => undefined };
  check('active party aage badh gayi', (await run(requireActiveParty, req)) === null);

  partyRow = { _id: PARTY_IN_BIG, status: PARTY_STATUS.PENDING, name: 'Hamari Dukaan' };
  err = await run(requireActiveParty, { ...req });
  check('pending party ruk gayi', err?.statusCode === 403, `status ${err?.statusCode}`);

  partyRow = { _id: PARTY_IN_BIG, status: PARTY_STATUS.BLOCKED, name: 'Hamari Dukaan' };
  err = await run(requireActiveParty, { ...req });
  check('blocked party ruk gayi', err?.statusCode === 403, `status ${err?.statusCode}`);

  partyRow = null;
  err = await run(requireActiveParty, { user: owner, businessId: W1_BIZ, partyId: null, get: () => undefined });
  check('bechne wale pe ye jaanch lagti hi nahi', err === null, `${err?.message}`);

  /* ═════════════════════ 6. router ka pehra ═════════════════════ */
  console.log(`\n${Y}Buy-side ke router${N}`);

  const here = path.dirname(fileURLToPath(import.meta.url));
  const routesDir = path.join(here, '..', 'src', 'routes');

  /*
    Comment hata kar dekho, warna jaanch WAJAH ko hi saboot maan leti hai.

    `buy.routes.js` me likha hai: "yahan `withBuyerTenant` laga hi nahi hai" —
    aur seedha shabd dhoondhne wali jaanch ne usi line ko pakad kar fail kar
    diya. Yaani jitni achhi wajah likhi jati, jaanch utni hi galat hoti.
  */
  const codeOf = (file) => fs.readFileSync(path.join(routesDir, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
  const buyRouters = [
    'catalog.routes.js', 'cart.routes.js', 'myOrder.routes.js',
    'myInvoice.routes.js', 'myKhata.routes.js',
  ];

  for (const file of buyRouters) {
    const src = codeOf(file);
    check(`${file} — naya pehra laga hai`,
      src.includes('requireBuyer') && src.includes('withBuyerTenant'),
      'purana requireRole(ROLES.RETAILER) to nahi rah gaya?');
    check(`${file} — purana retailer-only pehra hata`,
      !src.includes('requireRole(ROLES.RETAILER)'),
      'isse wholesaler ka buy mode chup-chaap band ho jata hai');
  }

  /* ═════════════════ 7. kai dukaanein ek saath (step 2) ═════════════════ */
  console.log(`\n${Y}Kai dukaanein ek saath${N}`);

  const buySrc = codeOf('buy.routes.js');

  check('buy router pe khareedne ka pehra hai', buySrc.includes('requireBuyer'));
  check('buy router pe `withBuyerTenant` JAAN-BOOJH KAR nahi hai',
    !buySrc.includes('withBuyerTenant'),
    'iska kaam "ek dukaan chuno" hai — yahan sab dukaanein ek saath chahiye');
  check('poora cart, ginti aur checkout — teeno raste hain',
    buySrc.includes("'/cart'") && buySrc.includes("'/cart/count'") && buySrc.includes("'/checkout'"));

  // -- checkout ka form --
  const goodBody = { orders: [{ shopId: BIG_BIZ }] };
  const good = checkoutSchema.safeParse(goodBody);
  check('checkout ka saada form manzoor hua', good.success, JSON.stringify(good.error?.issues));
  check('paise ka irada na bataya jaye to UDHAAR hi maana jayega',
    good.data?.orders?.[0]?.paymentMode === 'UDHAAR', `${good.data?.orders?.[0]?.paymentMode}`);

  check('khali list reject hui', !checkoutSchema.safeParse({ orders: [] }).success);
  check('galat shakal ki dukaan id reject hui',
    !checkoutSchema.safeParse({ orders: [{ shopId: 'kuch-bhi' }] }).success);
  check('anjaan paise ka irada reject hua',
    !checkoutSchema.safeParse({ orders: [{ shopId: BIG_BIZ, paymentMode: 'BARTER' }] }).success);
  check('har dukaan ka apna note alag rehta hai',
    checkoutSchema.safeParse({
      orders: [
        { shopId: BIG_BIZ, note: 'jaldi bhejein' },
        { shopId: OTHER_BIZ, paymentMode: 'CASH' },
      ],
    }).data?.orders?.[0]?.note === 'jaldi bhejein');

  // -- dukaan ka card ek hi jagah banta hai --
  const catCtrl = fs.readFileSync(path.join(here, '..', 'src', 'controllers', 'catalog.controller.js'), 'utf8');
  const catSvc = fs.readFileSync(path.join(here, '..', 'src', 'services', 'catalog.service.js'), 'utf8');
  check('shop page ka header ek hi jagah se banta hai',
    catCtrl.includes('getCurrentShopCard'),
    'do jagah banate to search me kuch aur dikhta, page pe kuch aur');
  check('purana doosra card banane wala hata diya gaya',
    !/export async function getShopInfo/.test(catSvc));

  /* ═══════ 8. kharida hua maal apni dukaan me (step 3) ═══════ */
  console.log(`\n${Y}Kharida hua maal apni dukaan me${N}`);

  const intakeSrc = codeOf('intake.routes.js');
  check('intake router APNI dukaan pe chalta hai (withTenant)',
    intakeSrc.includes('withTenant') && !intakeSrc.includes('withBuyerTenant'),
    'maal doosri dukaan se aaya hai par chadhta APNE stock me hai');
  check('ijazat wahi jo kharid ki hai',
    intakeSrc.includes("requirePermission('purchases:create')")
    && intakeSrc.includes("requirePermission('purchases:view')"),
    'isse godown incharge ko ye kaam apne aap milta hai');

  /*
    SABSE ZAROORI JAANCH.

    Intake ko stock KHUD NAHI badhana chahiye. Stock ke saath khep (FIFO ki
    lagat), supplier ka khata, GST ka input credit aur purchase ka number — sab
    ek saath banne chahiye, aur wo poora hisaab `purchase.service.js` me ek hi
    jagah likha hai.

    Kisi ne yahan seedha `applyStockChange` ya `khepBanao` bula liya to wahi
    maal DO baar chadh jayega, aur wo galti screen pe dikhti bhi nahi.
  */
  const intakeSvc = fs.readFileSync(path.join(here, '..', 'src', 'services', 'intake.service.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
  check('intake khud STOCK NAHI chhota — sab kuch createPurchase se',
    intakeSvc.includes('createPurchase')
    && !intakeSvc.includes('applyStockChange')
    && !intakeSvc.includes('khepBanao'),
    'stock, khep, khata aur GST — sab ek hi jagah se banne chahiye');

  // -- ek line ka faisla --
  const skip = decideLineSchema.safeParse({ skip: true });
  check('chhod dene wali line manzoor hui', skip.success, JSON.stringify(skip.error?.issues));

  const withNew = decideLineSchema.safeParse({
    sellingPrice: 1300, newItem: { name: 'Tyre 90/90', unit: 'PCS', gstRate: 18 },
  });
  check('naya item banane wala faisla manzoor hua', withNew.success, JSON.stringify(withNew.error?.issues));

  check('anjaan unit reject hua',
    !decideLineSchema.safeParse({ sellingPrice: 100, newItem: { unit: 'KILO' } }).success);
  check('28% se zyada GST reject hua',
    !decideLineSchema.safeParse({ sellingPrice: 100, newItem: { gstRate: 40 } }).success);
  check('galat shakal ki item id reject hui',
    !decideLineSchema.safeParse({ sellingPrice: 100, itemId: 'kuch-bhi' }).success);
  check('bechne ka rate na ho to 0 hi maana jayega (rok service me hai)',
    decideLineSchema.safeParse({}).data?.sellingPrice === 0);

  check('aakhri kadam bina kuch bataye bhi chal jata hai (poora udhaar)',
    finishIntakeSchema.safeParse({}).data?.paidAmount === 0);
  check('minus me paisa reject hua', !finishIntakeSchema.safeParse({ paidAmount: -5 }).success);

  /*
    BILL KI LINE → KAAM KI LINE.

    Ye poore feature ka sabse PAISE WALA hissa hai. Yahan ki galti screen pe
    dikhti hi nahi: bill ₹9,000 ka rehta aur purchase ₹10,000 ki ban jati.
  */
  const gstLine = lineFromInvoiceItem({
    name: 'Tyre 90/90', qty: 4, rate: 1000, discount: 0,
    taxableValue: 4000, gstRate: 18, cgst: 360, sgst: 360, igst: 0, total: 4720,
    unit: 'PCS', hsn: '4011',
  });
  check('lagat GST ke bina nikli', gstLine.unitCostExTax === 1000, `${gstLine.unitCostExTax}`);
  check('lagat GST ke saath bhi nikli', gstLine.unitCostIncTax === 1180, `${gstLine.unitCostIncTax}`);
  check('teenon tax jud kar ek jagah aaye', gstLine.taxAmount === 720, `${gstLine.taxAmount}`);

  /*
    BILL KE NEECHE WALA DISCOUNT.

    Line ka apna discount 0 hai, par bill ke neeche ₹400 laga hai — wo taxable
    me se ghat chuka hai (4000 - 400 = 3600). Line ke `discount` khaane me wo
    kabhi likha nahi jata, isliye seedha `l.discount` uthana chup-chaap ₹400
    kha jata tha.
  */
  const extraLine = lineFromInvoiceItem({
    name: 'Tyre 90/90', qty: 4, rate: 1000, discount: 0,
    taxableValue: 3600, gstRate: 0, cgst: 0, sgst: 0, igst: 0, total: 3600,
    unit: 'PCS',
  });
  check('BILL KE NEECHE WALA DISCOUNT bhi pakda gaya',
    extraLine.discount === 400, `discount ${extraLine.discount}`);
  check('...aur usse taxable wahi raha jo bill pe tha',
    round2(extraLine.qty * extraLine.rate - extraLine.discount) === extraLine.taxableValue,
    `${extraLine.qty * extraLine.rate - extraLine.discount} vs ${extraLine.taxableValue}`);

  check('line ka apna discount bhi waise hi aaya',
    lineFromInvoiceItem({
      name: 'X', qty: 2, rate: 500, discount: 50,
      taxableValue: 950, gstRate: 0, total: 950, unit: 'PCS',
    }).discount === 50);

  check('qty 0 pe bhaag nahi phata',
    lineFromInvoiceItem({ name: 'X', qty: 0, rate: 0, taxableValue: 0, total: 0 }).unitCostExTax === 0);

  // -- ek bill ka ek hi kaam --
  const intakeIdx = StockIntake.schema.indexes();
  const oneJob = intakeIdx.find(([keys, opts]) => opts?.unique
    && keys.businessId === 1 && keys.sourceInvoiceId === 1);
  check('ek bill ka ek hi kaam ban sakta hai',
    Boolean(oneJob),
    'bina iske wahi maal do baar chadh jata — stock dugna, khata dugna');

  /* ═══════════ 9. OTP — signup aur "password bhool gaye" ═══════════ */
  console.log(`\n${Y}OTP ka pehra${N}`);

  const otpToken = (phone, purpose = 'SIGNUP') =>
    jwt.sign({ phone, purpose, otp: true }, env.jwtSecret, { expiresIn: '15m' });

  const tryOtp = (token, purpose, phone) => {
    try { assertOtpToken(token, purpose, phone); return null; } catch (e) { return e; }
  };

  check('sahi saboot manzoor hua',
    tryOtp(otpToken('9000000001'), 'SIGNUP', '9000000001') === null);

  /*
    SABSE ZAROORI JAANCH.

    Bina iske koi APNA number verify karta aur account KISI AUR ke number pe
    bana leta — token sahi hi hota, bas kisi aur ka. Us aadmi ko kabhi pata bhi
    na chalta ki uske number pe account chal raha hai.
  */
  check('EK NUMBER ka saboot DOOSRE number pe nahi chala',
    tryOtp(otpToken('9000000001'), 'SIGNUP', '9000000002')?.statusCode === 400);

  check('password wale saboot se signup nahi hua',
    tryOtp(otpToken('9000000001', 'RESET'), 'SIGNUP', '9000000001')?.statusCode === 400);
  check('signup wale saboot se password nahi badla',
    tryOtp(otpToken('9000000001', 'SIGNUP'), 'RESET', '9000000001')?.statusCode === 400);

  check('naqli saboot reject hua', tryOtp('kuch-bhi', 'SIGNUP', '9000000001')?.statusCode === 400);
  check('khali saboot reject hua', tryOtp('', 'SIGNUP', '9000000001')?.statusCode === 400);
  check('doosri chaabi se sign kiya token reject hua',
    tryOtp(jwt.sign({ phone: '9000000001', purpose: 'SIGNUP', otp: true }, 'galat-chaabi'),
      'SIGNUP', '9000000001')?.statusCode === 400);
  check('aam login token OTP ka saboot nahi ban sakta',
    tryOtp(jwt.sign({ sub: 'abc', role: 'wholesaler' }, env.jwtSecret), 'SIGNUP', '9000000001')?.statusCode === 400);

  check('mari hui mohlat wala saboot reject hua',
    tryOtp(jwt.sign({ phone: '9000000001', purpose: 'SIGNUP', otp: true }, env.jwtSecret,
      { expiresIn: '-1s' }), 'SIGNUP', '9000000001')?.statusCode === 400);

  // -- form ki jaanch --
  check('OTP mangwane ka saada form manzoor hua',
    sendOtpSchema.safeParse({ phone: '9000000001', purpose: 'SIGNUP' }).success);
  check('anjaan kaam reject hua',
    !sendOtpSchema.safeParse({ phone: '9000000001', purpose: 'KUCHBHI' }).success);
  check('6 ank se kam ka OTP reject hua',
    !verifyOtpSchema.safeParse({ phone: '9000000001', purpose: 'SIGNUP', code: '123' }).success);
  check('ank ki jagah akshar wala OTP reject hua',
    !verifyOtpSchema.safeParse({ phone: '9000000001', purpose: 'SIGNUP', code: 'abcdef' }).success);
  check('signup ab BINA saboot ke ho hi nahi sakta',
    !wholesalerSignupSchema.safeParse({
      name: 'Ramesh', phone: '9000000001', password: 'test1234', businessName: 'Dukaan',
    }).success);
  check('chhota naya password reject hua',
    !resetPasswordSchema.safeParse({ phone: '9000000001', otpToken: 'x'.repeat(20), newPassword: '123' }).success);

  /* ════════════════ 10. PAISE KA SACH — Batch A ════════════════ */
  console.log(`\n${Y}Paise ka hisaab (Batch A)${N}`);

  /*
    WO EK JOD JIS PE POORA BATCH A TIKA HAI.

    "Kitna paisa aaya par kisi bill pe laga hi nahi" — app kahin ye number
    store nahi karti, ulta jod kar nikalti hai:

        jo laga nahi  =  khule bill  −  khata  +  purana hisaab

    Ye jod galat ho jaye to jama paisa bill pe aadha lagega, aur user ki wahi
    purani shikayat wapas aa jayegi. Isliye har halat alag se jaanchte hain.
  */
  check('ASLI BUG: ₹6,000 wapas + ₹5,000 ka naya bill -> poora ₹6,000 khula pada hai',
    unappliedCredit({ balance: -1000, billsDue: 5000, opening: 0 }) === 6000,
    String(unappliedCredit({ balance: -1000, billsDue: 5000, opening: 0 })));

  check('seedha `-balance` dekhte to sirf ₹1,000 milta (yahi purana bug tha)',
    unappliedCredit({ balance: -1000, billsDue: 5000, opening: 0 }) !== 1000);

  check('sab theek ho to lagane ko kuch nahi',
    unappliedCredit({ balance: 5000, billsDue: 5000, opening: 0 }) === 0);

  check('sirf jama paisa, koi bill khula nahi',
    unappliedCredit({ balance: -1000, billsDue: 0, opening: 0 }) === 1000);

  check('purana hisaab chuka dene wala paisa jama nahi ginta',
    unappliedCredit({ balance: 0, billsDue: 0, opening: 3000 }) === 3000);

  check('kabhi minus nahi hota',
    unappliedCredit({ balance: 9000, billsDue: 0, opening: 0 }) === 0);

  /*
    ULTA opening = app se pehle ka JAMA paisa. Ye bhi bill pe lagna chahiye.
    Bina is halat ke, jis graahak ka purana jama migration me daala gaya tha
    uska paisa naye bill pe kabhi lagta hi nahi — usi ek aadmi ke liye purana
    bug zinda reh jata.
  */
  check('app se PEHLE ka jama paisa bhi naye bill pe lagta hai',
    unappliedCredit({ balance: 2000, billsDue: 5000, opening: -3000 }) === 3000,
    String(unappliedCredit({ balance: 2000, billsDue: 5000, opening: -3000 })));

  check('app se pehle ka UDHAAR jama paisa nahi ban jata',
    unappliedCredit({ balance: 8000, billsDue: 5000, opening: 3000 }) === 0,
    String(unappliedCredit({ balance: 8000, billsDue: 5000, opening: 3000 })));

  /*
    Sweep ke BAAD wali halat — yahi ab har waqt sach rehni chahiye:
    ya to bill khula hai, ya paisa jama hai. Dono ek saath kabhi nahi.
  */
  const afterSweep = unappliedCredit({ balance: -1000, billsDue: 0, opening: 0 });
  check('sweep ke baad phir se kuch lagane ko nahi bachta (jod ghoomta nahi)',
    Math.min(afterSweep, 0) === 0);

  const s1 = splitBalance(5000, 5000);
  check('poora baaki bill ka hi ho to "bill ke bahar" khaali',
    s1.billsDue === 5000 && s1.otherDue === 0 && s1.advance === 0);

  const s2 = splitBalance(8000, 5000);
  check('purana hisaab alag dikhta hai (8000 me se 3000 bill ke bahar)',
    s2.billsDue === 5000 && s2.otherDue === 3000);

  const s3 = splitBalance(-2000, 0);
  check('ulta khata = jama paisa, aur "lena hai" tab 0',
    s3.advance === 2000 && s3.netDue === 0 && s3.settled === true);

  check('jama paisa "bill ke bahar wale udhaar" me DOBARA nahi ginta',
    splitBalance(-2000, 0).otherDue === 0);

  /* ── jama paisa ab TICK ka mohtaaj nahi ── */
  const srcOf = (f) => fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', f), 'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const invSrc = srcOf('services/invoice.service.js');
  check('bill banate waqt jama paisa APNE AAP lagta hai (opt-in tick hataya)',
    !invSrc.includes('useAdvance === true') && invSrc.includes('sweepAdvance'));
  check('rokne wala ULTA tick maujood hai (keepAdvance)',
    invSrc.includes('keepAdvance !== true'));

  const purSrc = srcOf('services/purchase.service.js');
  check('supplier ka advance bhi nayi kharid pe apne aap lagta hai',
    purSrc.includes('sweepAdvance'));

  const paySrc = srcOf('services/payment.service.js');
  check('payment ki hadd ab khata AUR khule bill dono dekhti hai',
    paySrc.includes('outstandingFor') && !paySrc.includes("outstanding: round2(party.balance"));
  check('payment banne/confirm/delete — teeno ke baad hisaab seedha hota hai',
    (paySrc.match(/sweepAdvance\(/g) || []).length >= 3);

  const retSrc = srcOf('services/return.service.js');
  check('wapasi banne aur mitne — dono ke baad hisaab seedha hota hai',
    (retSrc.match(/sweepAdvance\(/g) || []).length >= 2);

  /* ── wapasi ka paisa wapas (item 18) ── */
  const payRoutes = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'routes', 'payment.routes.js'),
    'utf8',
  );
  check('paisa wapas karne ka rasta bana hua hai',
    payRoutes.includes("post('/refund/:id'"));
  check('"dena hai" wali list ka rasta bana hua hai',
    payRoutes.includes("get('/we-owe'"));
  check('/we-owe aur /refund dono `/:id` se PEHLE hain (warna 400 "Galat id")',
    payRoutes.indexOf("'/we-owe'") < payRoutes.indexOf("'/:id'")
    && payRoutes.indexOf("'/refund/:id'") < payRoutes.indexOf("get('/:id'"));

  /* ── har page ka jawab ek hi jagah se ── */
  for (const [f, label] of [
    ['services/dashboard.service.js', 'Home'],
    ['services/khata.service.js', 'Khata aur Mera Khata'],
    ['services/payment.service.js', 'Payments'],
  ]) {
    const src = srcOf(f);
    check(`${label} ka "baaki" wahi ek jagah se aata hai (balance.service)`,
      src.includes("from './balance.service.js'"));
  }

  /* ════════════ 11. Dono taraf ka rishta — Batch B ════════════ */
  console.log(`\n${Y}Dono taraf ka rishta (Batch B)${N}`);

  const invSrc2 = srcOf('services/invoice.service.js');
  const purSrc2 = srcOf('services/purchase.service.js');
  const intSrc = srcOf('services/intake.service.js');
  const dashSrc = srcOf('services/dashboard.service.js');

  /* ── 11: taar dono taraf jata hai ── */
  check('kharidaar ki purchase pe bechne wale ka bill likha jata hai',
    purSrc2.includes('sourceInvoiceId: payload.sourceInvoiceId')
    && purSrc2.includes('sourceBusinessId: payload.sourceBusinessId'));
  check('stock intake wahi taar aage bhejta hai',
    intSrc.includes('sourceInvoiceId: found.sourceInvoiceId')
    && intSrc.includes('sourceBusinessId: found.sellerBusinessId'));
  check('bechne wale ko dikhta hai ki maal stock me gaya ya nahi',
    invSrc2.includes('buyerIntake'));
  check('kharidaar ko dikhta hai ki maal kis dukaan se aaya',
    purSrc2.includes('source = {') && purSrc2.includes('shopName: seller.name'));

  /*
    Ye rok utni hi zaroori hai jitna rishta khud: kharidaar ko doosri dukaan
    ke bill ka POORA kagaz nahi dikhna chahiye. Sirf naam aur number jata hai.
  */
  const srcBlock = purSrc2.slice(purSrc2.indexOf('source = {'), purSrc2.indexOf('source = {') + 300);
  check('doosri dukaan ka bill khud nahi bhejte — sirf naam aur number',
    !/items|grandTotal|rate/.test(srcBlock), srcBlock.slice(0, 120));

  /* ── 7: bill pe kharidaar ki adhoori detail ── */
  check('bill ke saath bata dete hain ki kharidaar ki kya detail chhoot rahi hai',
    invSrc2.includes('partyMissing'));
  check('warning bill ke SNAPSHOT se banti hai, party se nahi (purana bill na badle)',
    invSrc2.includes('const snap = invoice.partySnapshot'));
  check('GSTIN sirf GST wale bill pe maanga jata hai',
    invSrc2.includes("invoice.gstEnabled && !snap.gstin"));

  /* ── 16: is mahine kitna kharida ── */
  check('dashboard pe "is mahine kitna kharida" ka jod jata hai',
    dashSrc.includes('purchaseAgg') && dashSrc.includes('monthCount'));
  check('kharid ka number bina ijazat wale staff ko nahi jata',
    dashSrc.includes("if (!can('purchases:view')) delete full.purchase"));

  /* ── Purchase model ka index ── */
  const purIdx = (await import('../src/models/Purchase.js')).default.schema.indexes();
  check('purchase pe source wala index laga hai (warna lookup poori table padhega)',
    purIdx.some(([k]) => k.sourceInvoiceId !== undefined));

  /* ════════════ 12. Staff ki hadd, ek phone ek login — Batch C ════════════ */
  console.log(`\n${Y}Staff ki hadd aur login (Batch C)${N}`);

  /* ── 24: ek number, ek jagah ── */
  const authSrc = srcOf('services/auth.service.js');
  const guardSrc = srcOf('middleware/auth.js');
  const userSrc = srcOf('models/User.js');

  check('user pe login ki ginti rakhi jati hai',
    userSrc.includes('sessionSeq'));
  check('token me wahi ginti likhi jati hai',
    authSrc.includes('ss: user.sessionSeq'));
  check('naya login ginti BADHATA hai — aur wo bhi atomically ($inc)',
    authSrc.includes('$inc: { sessionSeq: 1 }'));
  check('naya token DATABASE wali nayi ginti se banta hai (khud ko bahar na kare)',
    authSrc.includes('signToken(fresh)'));
  check('har request pe ginti milayi jati hai',
    guardSrc.includes('Number(decoded.ss) !== Number(user.sessionSeq'));

  /*
    Ye jaanch utni hi zaroori hai jitna khud fix: is fix se PEHLE bane token
    me `ss` hai hi nahi. Unhe rokte to update lagte hi har chalu login ek
    saath toot jata — sab ko bina wajah dobara login karna padta.
  */
  check('purane token (jinme ginti hai hi nahi) bina wajah nahi tootte',
    guardSrc.includes('decoded.ss !== undefined'));

  /* ── 22: munafa/lagat wali report alag chaabi ke peeche ── */
  const permSrc = srcOf('config/permissions.js');
  const repCtrl = srcOf('controllers/report.controller.js');

  check('reports me `profit` naam ki alag chaabi hai',
    permSrc.includes("'view', 'export', 'profit'"));
  check('cashier ko wo chaabi nahi milti',
    permissionsForRole(STAFF_ROLES.CASHIER).includes('reports:view')
    && !permissionsForRole(STAFF_ROLES.CASHIER).includes('reports:profit'));
  check('manager ko milti hai (poori dukaan wahi chalata hai)',
    permissionsForRole(STAFF_ROLES.MANAGER).includes('reports:profit'));
  check('salesman ko report hi nahi milti',
    !permissionsForRole(STAFF_ROLES.SALESMAN).includes('reports:view'));

  check('"pl" AUR "stock" dono roki gayi hain (stock me lagat hoti hai)',
    repCtrl.includes("new Set(['pl', 'stock'])"));
  check('CSV wala rasta bhi wahi rok maanta hai (warna wahi sabse aasan chor darwaza)',
    (repCtrl.match(/assertCanSeeProfit\(req\)/g) || []).length >= 2);

  /* ── 9: item ki poori pehchan, maal aate waqt ── */
  const intakeSrc2 = srcOf('services/intake.service.js');
  const intakeVal = srcOf('validators/intake.validator.js');

  for (const f of ['mrp', 'brand', 'imageUrl', 'warrantyMonths', 'warrantyNote']) {
    check(`naya item banate waqt "${f}" bhi bhara ja sakta hai`,
      intakeVal.includes(`${f}:`) && intakeSrc2.includes(`payload.newItem?.${f}`));
  }

  /*
    Sabse zaroori rok: purane item ka pehle se bhara hua MRP/warranty upar se
    likh dena seedha nuksan hai — wo soch-samajh kar bhara gaya tha, aur ye
    supplier ki parchi se aaya andaza hai.
  */
  check('purane item ke SIRF KHALI khaane bharte hain, bhare hue nahi',
    intakeSrc2.includes('if (!old?.mrp && n.mrp)')
    && intakeSrc2.includes('if (!old?.warrantyMonths && n.warrantyMonths)'));

  /* ── Batch A ka bacha hua: kharid ke saath diya paisa ── */
  const purSrc3 = srcOf('services/purchase.service.js');
  check('kharid ke saath diya hua paisa ab Payment list me bhi dikhta hai',
    purSrc3.includes('sourcePurchaseId: purchase._id'));
  check('purchase mitne pe wo payment bhi hat jati hai (anaath entry na bache)',
    purSrc3.includes('Payment.deleteMany({ businessId, sourcePurchaseId'));
  check('uski khata entry DOBARA ulti nahi hoti (ek credit do baar na kate)',
    purSrc3.indexOf('reverseEntriesFor') < purSrc3.indexOf('Payment.deleteMany'));

  /*
    Bahar hone ki WAJAH aadmi tak pahunchti hai ya nahi.

    Bina wajah bataye aadmi khud ko achanak login page pe paata hai, dobara
    login karta hai, aur DOOSRA phone bahar ho jata hai. Do log baari baari
    ek doosre ko bahar karte rehte hain — aur ye bug asli fix se bhi zyada
    uljhan wala hai.
  */
  const clientDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'src');
  if (fs.existsSync(clientDir)) {
    const apiSrc = fs.readFileSync(path.join(clientDir, 'lib', 'api.js'), 'utf8');
    const loginSrc = fs.readFileSync(path.join(clientDir, 'pages', 'auth', 'Login.jsx'), 'utf8');
    check('bahar hone ki wajah sambhal kar rakhi jati hai',
      apiSrc.includes('rr_logout_reason'));
    check('aur login page pe dikh bhi jati hai',
      loginSrc.includes('rr_logout_reason'));
  }

  /* ════════════ 13. Billing ka switch — Step 1 ════════════ */
  console.log(`\n${Y}Billing ka switch (Step 1)${N}`);

  const { PLANS, PLAN_BY_CODE, seatsOf, seatsAllow, rupees } =
    await import('../src/config/billing.js');
  const { statusOf, isUsable, planCatalog } = await import('../src/services/billing.service.js');

  /* ── daam wahi jo tay hua ── */
  const want = { CHOTI: [50, 3], BADHTI: [100, 10], BADI: [500, 20], ASEEM: [2000, null] };
  for (const [code, [rs, seats]] of Object.entries(want)) {
    const p = PLAN_BY_CODE[code];
    check(`${code}: ₹${rs}/mahina, ${seats === null ? 'jitne chahein' : `${seats} account`}`,
      p && rupees(p.pricePaise) === rs && p.seats === seats,
      p ? `₹${rupees(p.pricePaise)} · ${p.seats}` : 'plan hi nahi mila');
  }

  /*
    Daam PAISE me rakhe jate hain, rupaye me nahi — Razorpay bhi paise me hi
    kaam karta hai. Poore system me ek hi ikai rakhne se wo galti hoti hi
    nahi jisme ₹50 ka bill ₹0.50 ya ₹5,000 ban jata hai.
  */
  check('daam paise me store hote hain (₹50 = 5000)',
    PLAN_BY_CODE.CHOTI.pricePaise === 5000);

  /* ── seat ki ginti ── */
  check('CHOTI me 3 aate hain, 4 nahi',
    seatsAllow('CHOTI', 3) && !seatsAllow('CHOTI', 4));
  check('ASEEM me koi ginti nahi',
    seatsOf('ASEEM') === null && seatsAllow('ASEEM', 5000));
  check('"jitne chahein" ko bada NUMBER banakar nahi bheja jata (null hi rehta hai)',
    PLAN_BY_CODE.ASEEM.seats === null);

  /* ── haalat TAREEKH se nikalti hai, kisi field se nahi ── */
  const day = 86400000;
  const mk = (daysFromNow) => ({ paidTill: new Date(Date.now() + daysFromNow * day) });

  check('mohlat baaki hai -> chalu',
    statusOf(mk(5)) === 'active');
  check('mohlat khatam par grace ke andar -> grace (dukaan band NAHI hoti)',
    statusOf(mk(-3)) === 'grace');
  check('grace bhi nikal gaya -> khatam',
    statusOf(mk(-30)) === 'expired');
  check('kabhi plan liya hi nahi -> khatam',
    statusOf(null) === 'expired');
  check('grace me bhi kaam chalta rehta hai',
    isUsable('grace') && isUsable('active') && !isUsable('expired'));

  /* ── FREE MODE: is poore system ka koi asar nahi ── */
  check('abhi BILLING_MODE=free hai, isliye kisi pe rok nahi',
    planCatalog().mode === 'free' && planCatalog().chargingNow === false);

  /* ── kaun sa rasta paise maangta hai ── */
  const gated = fs.readdirSync(routesDir).filter((f) => codeOf(f).includes('requirePaidSeller'));
  const open = fs.readdirSync(routesDir).filter((f) => f.endsWith('.routes.js') && !gated.includes(f));

  for (const f of ['invoice.routes.js', 'item.routes.js', 'khata.routes.js', 'payment.routes.js',
    'staff.routes.js', 'purchase.routes.js', 'report.routes.js']) {
    check(`bechne ka rasta plan maangta hai — ${f}`, gated.includes(f));
  }

  /*
    Ye jaanch upar wali se ZYADA zaroori hai.

    Kharidne wala hissa galti se rok liya jaye to poora dhanda hi mar jata
    hai: retailer maal dekh hi nahi paayega, aur uske bina wholesaler ke liye
    app ka koi matlab nahi. Ye galti ek line se ho sakti hai, isliye uska
    apna test hai.
  */
  for (const f of ['catalog.routes.js', 'cart.routes.js', 'buy.routes.js', 'shop.routes.js',
    'myInvoice.routes.js', 'myKhata.routes.js', 'myOrder.routes.js']) {
    check(`KHARIDNA FREE HI RAHA — ${f}`, open.includes(f));
  }

  /*
    Aur ye teesri jaanch: jiska plan khatam hua hai use ANDAR aakar plan lena
    hai. Usi aadmi ko billing ke raste se bahar rok dena wo bug hai jisme
    system khud ko band kar leta hai — aur wo tab pakda jata hai jab pehla
    graahak paisa dene ki koshish karke nahi kar paata.
  */
  check('billing ka rasta khud plan nahi maangta (warna koi plan le hi nahi payega)',
    open.includes('billing.routes.js'));
  check('profile/settings khula rehta hai (aadmi andar to aa sake)',
    open.includes('business.routes.js'));

  const billRoutes = codeOf('billing.routes.js');
  check('daam ki list BINA LOGIN ke khulti hai (gateway khud ye page kholta hai)',
    billRoutes.indexOf("get('/plans'") < billRoutes.indexOf('router.use(protect'));

  /* ── policy ke kagaz bhi bina login ke ── */
  const routesJsx = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'src', 'routes', 'AppRoutes.jsx'),
    'utf8',
  );
  const guardAt = routesJsx.indexOf('<AppLayout');
  for (const page of ['/privacy', '/terms', '/refund', '/delivery', '/contact', '/pricing']) {
    const at = routesJsx.indexOf(`path="${page}"`);
    check(`${page} bina login ke khulta hai`, at > 0 && (guardAt < 0 || at < guardAt));
  }

  /* ════════════ 14. Razorpay — Step 2 ════════════ */
  console.log(`\n${Y}Razorpay (Step 2)${N}`);

  const { env: liveEnv } = await import('../src/config/env.js');
  liveEnv.razorpay.keySecret = 'secret_for_test';
  liveEnv.razorpay.webhookSecret = 'hook_for_test';

  const rzp = await import('../src/services/razorpay.service.js');
  const nodeCrypto = await import('node:crypto');
  const sigOf = (secret, text) =>
    nodeCrypto.createHmac('sha256', secret).update(text).digest('hex');

  const okSig = sigOf('secret_for_test', 'order_A|pay_A');
  check('sahi signature manzoor hota hai',
    rzp.verifyCheckoutSignature({ orderId: 'order_A', paymentId: 'pay_A', signature: okSig }));
  check('galat signature reject hota hai',
    !rzp.verifyCheckoutSignature({ orderId: 'order_A', paymentId: 'pay_A', signature: 'deadbeef' }));

  /*
    Ek order ka saboot doosre order pe nahi chalna chahiye — warna koi apne
    ₹50 wale payment ka saboot ₹2000 wale plan pe chipka de.
  */
  check('EK order ka saboot DOOSRE order pe nahi chalta',
    !rzp.verifyCheckoutSignature({ orderId: 'order_B', paymentId: 'pay_A', signature: okSig }));
  check('khali saboot reject hota hai',
    !rzp.verifyCheckoutSignature({ orderId: 'order_A', paymentId: 'pay_A', signature: '' }));

  const hookBody = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
  check('webhook ka sahi saboot manzoor',
    rzp.verifyWebhookSignature(hookBody, sigOf('hook_for_test', hookBody)));
  check('webhook ka galat saboot reject',
    !rzp.verifyWebhookSignature(hookBody, sigOf('kisi_aur_ka_secret', hookBody)));

  const badBody = Buffer.from(JSON.stringify({ event: 'payment.captured', extra: 1 }));
  check('body ek byte badalte hi webhook ka saboot toot jata hai',
    !rzp.verifyWebhookSignature(badBody, sigOf('hook_for_test', hookBody)));

  const appSrc = srcOf('app.js');
  const rawAt = appSrc.indexOf("'/api/billing/webhook'");
  const jsonAt = appSrc.indexOf('express.json(');
  check('webhook ka RAW body parser express.json() se PEHLE laga hai',
    rawAt > 0 && rawAt < jsonAt, `raw@${rawAt} json@${jsonAt}`);
  check('paid mode me key na ho to server shuru hi nahi hota',
    appSrc.includes('assertBillingReady()'));

  const billSrc = srcOf('services/billing.service.js');
  check('order ka status FILTER me hai (verify aur webhook dono aayein to bhi ek hi baar chale)',
    billSrc.includes("{ _id: orderDoc._id, status: 'created' }"));
  check('rakam SERVER pe tay hoti hai, client se aayi rakam nahi',
    billSrc.includes('plan.pricePaise * m'));
  check('12 mahine se zyada ek baar me nahi',
    srcOf('validators/billing.validator.js').includes('max(12)'));

  const billRoutes2 = codeOf('billing.routes.js');
  check('webhook `protect` ke BAHAR hai (Razorpay ke paas token hota hi nahi)',
    billRoutes2.indexOf("post('/webhook'") < billRoutes2.indexOf('router.use(protect'));

  /* ════════════ 15. Phone pe notification aur OTP — Step 3 ════════════ */
  console.log(`\n${Y}Phone pe notification (Step 3)${N}`);

  const notifSrc = srcOf('services/notification.service.js');
  const pushSrc = srcOf('services/push.service.js');
  const smsSrc = srcOf('services/sms.service.js');

  check('har notification phone pe bhi jati hai (ek hi darwaze se)',
    notifSrc.includes('pushToUser(userId'));
  check('push fail hone se asli kaam (bill/payment) nahi rukta',
    /pushToUser\([\s\S]{0,200}\.catch\(/.test(notifSrc));

  /*
    Mari hui subscription turant hatna zaroori hai — warna wo har notification
    pe ek bekaar HTTP call banti rehti hai, aur ek lakh user pe wo seedha paisa
    aur waqt dono ka nuksan hai.
  */
  check('mara hua device (404/410) turant hata diya jata hai',
    pushSrc.includes('err.statusCode === 404') && pushSrc.includes('deleteMany'));
  check('ek user ke device ki hadd lagi hai (fan-out kaabu me)',
    pushSrc.includes('.limit(10)'));
  check('VAPID key na ho to push chup-chaap band rehta hai, crash nahi',
    pushSrc.includes('if (!ready'));

  check('OTP ka provider .env se chunta hai (apitxt / fast2sms)',
    smsSrc.includes("env.sms.provider === 'apitxt'"));
  check('APITxT ka URL .env se aata hai (dashboard wala exact URL paste ho sake)',
    smsSrc.includes('env.sms.apitxtUrl'));

  const swPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'public', 'sw.js',
  );
  check('service worker maujood hai', fs.existsSync(swPath));
  if (fs.existsSync(swPath)) {
    const sw = fs.readFileSync(swPath, 'utf8');
    check('push aate hi notification dikhati hai', sw.includes("addEventListener('push'"));
    check('dabane par app khulti hai', sw.includes("addEventListener('notificationclick'"));
    check('ek hi cheez ke alert dher nahi lagate (tag)', sw.includes('tag:'));
    check('app pehle se khuli ho to usi tab me jata hai',
      sw.includes('matchAll') && sw.includes('focus'));
  }

  const appSrc2 = srcOf('app.js');
  check('service worker kabhi cache nahi hota (purana sw chipakna sabse chhupa hua bug hai)',
    appSrc2.includes("filePath.endsWith('sw.js')") && appSrc2.includes('no-store'));

  /* ════════════ 16. Ek lakh user — Step 4 ════════════ */
  console.log(`\n${Y}Ek lakh user (Step 4)${N}`);

  const allModels = await import('../src/models/index.js');
  let idxTotal = 0;
  const heavy = [];
  for (const [name, M] of Object.entries(allModels)) {
    if (!M?.schema) continue;
    const n = M.schema.indexes().length + 1;
    idxTotal += n;
    if (n > 9) heavy.push(`${name}:${n}`);
  }

  /*
    Har naya doc likhne pe utne hi index update hote hain. Ye ginti seedha
    likhne ki raftaar aur mahine ke bill se judi hai, isliye uspe hadd hai.
  */
  check('kul index kaabu me hain (150 se kam)', idxTotal < 150, `${idxTotal} index`);
  check('kisi ek model pe 9 se zyada index nahi', heavy.length === 0, heavy.join(' '));

  /* ── garam query ke liye index maujood hai ── */
  const hasIdx = (M, ...cols) => M.schema.indexes()
    .some(([k]) => cols.every((c) => c in k));

  check('khule bill FIFO se dhoondhna covered hai (sweepAdvance ki jaan)',
    hasIdx(allModels.Invoice, 'businessId', 'partyId', 'dueAmount'));
  check('khata ki entry ref se dhoondhna covered hai (bill cancel / payment delete)',
    hasIdx(allModels.LedgerEntry, 'businessId', 'refType', 'refId'));
  check('bill pe lagi payments dhoondhna covered hai',
    hasIdx(allModels.Payment, 'businessId', 'allocations.invoiceId'));
  check('stock ka movement ref se covered hai',
    hasIdx(allModels.StockMovement, 'businessId', 'refType', 'refId'));

  /* ── purana data apne aap saaf ── */
  const ttlOf = (M) => M.schema.indexes().find(([, o]) => o?.expireAfterSeconds !== undefined);
  check('purani notification apne aap hat jati hai', Boolean(ttlOf(allModels.Notification)));
  check('purana audit log apne aap hat jata hai', Boolean(ttlOf(allModels.AuditLog)));
  check('OTP apne aap hat jata hai', Boolean(ttlOf(allModels.Otp)));

  /* ── request ki hadd ── */
  const appSrc3 = srcOf('app.js');
  check('OTP wale raste pe alag aur sakht hadd (har call ek SMS = paisa)',
    appSrc3.includes("'/api/auth/otp'") && appSrc3.includes('rateLimit'));
  check('aam API pe bhi hadd lagi hai', appSrc3.includes("app.use('/api', rateLimit"));
  check('webhook hadd se bahar hai (wo Razorpay se aata hai, aadmi se nahi)',
    appSrc3.includes("req.path === '/billing/webhook'"));
  check('jawab dabaya jata hai (compression)', appSrc3.includes('compression()'));

  const dbSrc = srcOf('config/db.js');
  check('connection pool pe hadd hai', dbSrc.includes('maxPoolSize'));
  check('live pe index apne aap nahi bante (boot minaton nahi atakta)',
    dbSrc.includes('autoIndex'));

  /* ── cache ── */
  const { cacheSet, cacheGet, cacheBust, cacheSize } = await import('../src/utils/cache.js');
  cacheSet('t:1', { a: 1 }, 1000);
  check('cache me rakha hua wapas milta hai', cacheGet('t:1')?.a === 1);
  cacheSet('t:2', 'x', -1);
  check('mohlat khatam hone par cache khud hata deta hai', cacheGet('t:2') === undefined);
  cacheSet('t:3', 'y', 1000);
  cacheBust('t:');
  check('naam se cache saaf hota hai', cacheGet('t:1') === undefined && cacheGet('t:3') === undefined);

  /*
    Cache ki hadd zaroori hai: bina iske ek galat key chupchap badhti rehti hai
    aur ek din server ki memory kha jati hai — aur wo crash 3 baje raat ko aata
    hai.
  */
  for (let i = 0; i < 2600; i += 1) cacheSet(`big:${i}`, i, 60000);
  check('cache ki hadd lagi hai (memory kabhi khatam na ho)',
    cacheSize() <= 2000, `${cacheSize()} entry`);
  cacheBust('big:');

  const authSrc2 = srcOf('middleware/auth.js');
  check('har request pe user dobara database se nahi aata',
    authSrc2.includes('cacheGet(ckey)') && authSrc2.includes('cacheSet(ckey'));
  check('naya login karte hi wo cache saaf hota hai (ek number ek jagah sach rahe)',
    srcOf('services/auth.service.js').includes('cacheBust('));

  /* ════════════════════ 17. Membership ke index ════════════════════ */
  console.log(`\n${Y}Membership ke index${N}`);

  const indexes = Membership.schema.indexes();
  const uniqueOnes = indexes.filter(([, opts]) => opts?.unique);

  check('ek kharidaar + ek dukaan = ek hi entry (do rok)',
    uniqueOnes.length === 2, `${uniqueOnes.length} unique index`);

  check('dono rok me chhalni lagi hai (khali khaane takrayein nahi)',
    uniqueOnes.every(([, opts]) => Boolean(opts.partialFilterExpression)),
    JSON.stringify(uniqueOnes.map(([, o]) => o.partialFilterExpression)));

  console.log('\n' + results.join('\n'));
  console.log(`\n${failed === 0 ? G : R}${passed} pass, ${failed} fail${N}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`${R}Self check crash:${N}`, err);
  process.exit(1);
});
