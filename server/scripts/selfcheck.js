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

  // -- ek bill ka ek hi kaam --
  const intakeIdx = StockIntake.schema.indexes();
  const oneJob = intakeIdx.find(([keys, opts]) => opts?.unique
    && keys.businessId === 1 && keys.sourceInvoiceId === 1);
  check('ek bill ka ek hi kaam ban sakta hai',
    Boolean(oneJob),
    'bina iske wahi maal do baar chadh jata — stock dugna, khata dugna');

  /* ═════════════════════ 9. Membership ke index ═════════════════════ */
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
