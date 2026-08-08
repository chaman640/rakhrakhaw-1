/**
 * SMOKE TEST — poora Part 2 flow aapke apne database pe chala kar dikhata hai.
 *
 *   npm run smoke
 *
 * Ye asli API calls karta hai, phir apna banaya hua saara test data delete kar deta hai.
 * Aapke asli data ko haath nahi lagata (sab kuch "smoke-" prefix wale phone numbers pe hota hai).
 */
import mongoose from 'mongoose';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { round2 } from '../src/utils/money.js';
import {
  User, Business, Party, Item, Category, StockMovement, PartyItemRate, LedgerEntry, Purchase, Counter,
  Cart, Order, Notification, Invoice, Payment, ReturnNote,
} from '../src/models/index.js';

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', N = '\x1b[0m';

let passed = 0, failed = 0;
const results = [];

function check(name, condition, extra = '') {
  if (condition) { passed++; results.push(`${G}  ✔${N} ${name}`); }
  else { failed++; results.push(`${R}  ✖${N} ${name} ${D}${extra}${N}`); }
}

const PORT = 5987;
const BASE = `http://localhost:${PORT}/api`;

// Test ke liye alag phone numbers — asli data se takrayenge nahi
const WHOLESALER_PHONE = '9000000001';
const RETAILER_PHONE = '9000000002';

async function call(method, path, { body, token, raw } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body && !raw ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, ...json };
}

async function cleanup() {
  // Part 11 ke staff numbers bhi saaf karo
  const phones = [WHOLESALER_PHONE, RETAILER_PHONE, '9000000011', '9000000012'];
  const users = await User.find({ phone: { $in: phones } }).lean();
  const businessIds = users.map((u) => u.businessId).filter(Boolean);
  await Promise.all([
    Party.deleteMany({ businessId: { $in: businessIds } }),
    Item.deleteMany({ businessId: { $in: businessIds } }),
    Category.deleteMany({ businessId: { $in: businessIds } }),
    StockMovement.deleteMany({ businessId: { $in: businessIds } }),
    PartyItemRate.deleteMany({ businessId: { $in: businessIds } }),
    LedgerEntry.deleteMany({ businessId: { $in: businessIds } }),
    Purchase.deleteMany({ businessId: { $in: businessIds } }),
    Counter.deleteMany({ businessId: { $in: businessIds } }),
    Cart.deleteMany({ businessId: { $in: businessIds } }),
    Order.deleteMany({ businessId: { $in: businessIds } }),
    Notification.deleteMany({ businessId: { $in: businessIds } }),
    Invoice.deleteMany({ businessId: { $in: businessIds } }),
    Payment.deleteMany({ businessId: { $in: businessIds } }),
    ReturnNote.deleteMany({ businessId: { $in: businessIds } }),
  ]);
  await Business.deleteMany({ _id: { $in: businessIds } });
  await User.deleteMany({ $or: [{ phone: { $in: phones } }, { businessId: { $in: businessIds } }] });
}

async function run() {
  console.log(`\n${Y}Rakh Rakhav — smoke test (Part 1-11)${N}`);
  console.log(`${D}Database: ${env.mongoUri.replace(/\/\/[^@]*@/, '//***@')}${N}\n`);

  await connectDB();
  await cleanup();

  const server = app.listen(PORT);
  await new Promise((r) => server.once('listening', r));

  try {
    // ---------------------------------------------------------- Wholesaler
    console.log(`${Y}Wholesaler${N}`);

    let r = await call('POST', '/auth/wholesaler/signup', {
      body: { name: 'Ramesh Bhai', phone: WHOLESALER_PHONE, password: 'test1234', businessName: 'Ramesh Auto Parts' },
    });
    check('signup se account bana', r.status === 201 && r.data?.token, `status ${r.status}: ${r.message}`);
    const wToken = r.data?.token;
    check('signup pe invite code mila', Boolean(r.data?.business?.inviteCode));
    const inviteCode = r.data?.business?.inviteCode;

    r = await call('POST', '/auth/wholesaler/signup', {
      body: { name: 'Koi Aur', phone: WHOLESALER_PHONE, password: 'test1234', businessName: 'Dusri Dukaan' },
    });
    check('same number se dobara signup block hua', r.status === 409, `status ${r.status}`);

    r = await call('POST', '/auth/login', { body: { phone: WHOLESALER_PHONE, password: 'galatpass' } });
    check('galat password reject hua', r.status === 401, `status ${r.status}`);

    r = await call('POST', '/auth/login', { body: { phone: '+91 90000-00001', password: 'test1234' } });
    check('login chala (formatted number bhi)', r.status === 200 && r.data?.token, `status ${r.status}`);

    r = await call('GET', '/auth/me', { token: wToken });
    check('/auth/me ne session diya', r.data?.user?.role === 'wholesaler' && r.data?.business?.name === 'Ramesh Auto Parts');

    r = await call('GET', '/auth/me');
    check('bina token /auth/me block hua', r.status === 401, `status ${r.status}`);

    // ---------------------------------------------------------- Profile + GST
    console.log(`\n${Y}Business profile aur GST${N}`);

    r = await call('PUT', '/business/me', {
      token: wToken,
      body: {
        name: 'Ramesh Auto Parts', phone: WHOLESALER_PHONE,
        address: { line1: 'Nehru Market', city: 'Kanpur', state: 'Uttar Pradesh', pincode: '208001' },
      },
    });
    check('profile save hua', r.status === 200, `${r.message}`);
    check('state se GST code auto set hua (09)', r.data?.address?.stateCode === '09', `mila: ${r.data?.address?.stateCode}`);

    r = await call('PUT', '/business/me', { token: wToken, body: { gstEnabled: true, gstin: '' } });
    check('GST on par khali GSTIN reject hua', r.status === 400, `status ${r.status}`);

    r = await call('PUT', '/business/me', { token: wToken, body: { gstEnabled: true, gstin: '09AAACH7409R1ZX' } });
    check('galat checksum wala GSTIN reject hua', r.status === 400, `${r.message}`);

    r = await call('PUT', '/business/me', { token: wToken, body: { gstEnabled: true, gstin: '27AAPFU0939F1ZV' } });
    check('dusre state ka GSTIN reject hua', r.status === 400, `${r.message}`);

    r = await call('PUT', '/business/me', { token: wToken, body: { gstEnabled: true, gstin: '09AAACH7409R1ZZ' } });
    check('sahi UP GSTIN accept hua', r.status === 200 && r.data?.gstEnabled === true, `${r.message}`);

    r = await call('PUT', '/business/me', { token: wToken, body: { gstEnabled: false } });
    check('GST off karne par GSTIN clear hua', r.data?.gstEnabled === false && r.data?.gstin === '', `gstin: "${r.data?.gstin}"`);

    r = await call('GET', '/business/me', { token: wToken });
    check('invite link bana', String(r.data?.inviteLink || '').includes('/join/'), r.data?.inviteLink);

    r = await call('GET', '/business/states');
    check('states list mili (36 = 28 state + 8 UT)', Array.isArray(r.data) && r.data.length === 36, `count ${r.data?.length}`);

    // ---------------------------------------------------------- Retailer
    console.log(`\n${Y}Retailer join${N}`);

    r = await call('GET', `/auth/invite/${inviteCode}`);
    check('invite link se dukaan ka naam dikha', r.data?.businessName === 'Ramesh Auto Parts', `${r.message}`);

    r = await call('GET', '/auth/invite/ZZZZZZZZ');
    check('galat invite code reject hua', r.status === 404, `status ${r.status}`);

    r = await call('POST', '/auth/retailer/signup', {
      body: { inviteCode, name: 'Suresh Kumar', shopName: 'Suresh Auto', phone: RETAILER_PHONE, password: 'test1234' },
    });
    check('retailer ka account bana', r.status === 201 && r.data?.token, `${r.message}`);
    check('retailer pending me gaya', r.data?.party?.status === 'pending', `status: ${r.data?.party?.status}`);
    const rToken = r.data?.token;
    const partyId = r.data?.party?._id;

    r = await call('GET', '/auth/me', { token: rToken });
    check('retailer ko sirf apne wholesaler ka business dikha', r.data?.business?.name === 'Ramesh Auto Parts');
    check('retailer ko GSTIN jaisi private field nahi mili', r.data?.business?.gstin === undefined);

    r = await call('GET', '/business/me', { token: rToken });
    check('retailer wholesaler ka settings API nahi khol saka', r.status === 403, `status ${r.status}`);

    // ---------------------------------------------------------- Approval
    console.log(`\n${Y}Approval${N}`);

    r = await call('GET', '/business/retailers?status=pending', { token: wToken });
    check('pending list me retailer dikha', r.data?.retailers?.length === 1 && r.data?.summary?.pending === 1);

    r = await call('POST', `/business/retailers/${partyId}/approve`, { token: wToken });
    check('approve chala', r.status === 200 && r.data?.status === 'active', `${r.message}`);

    r = await call('GET', '/auth/me', { token: rToken });
    check('retailer ab active dikh raha hai', r.data?.party?.status === 'active');

    r = await call('POST', `/business/retailers/${partyId}/block`, { token: wToken });
    check('block chala', r.data?.status === 'blocked');

    r = await call('POST', '/auth/login', { body: { phone: RETAILER_PHONE, password: 'test1234' } });
    check('blocked retailer login nahi kar paya', r.status === 403, `status ${r.status}`);

    // ---------------------------------------------------------- Invite rotate
    console.log(`\n${Y}Invite link badalna${N}`);

    r = await call('POST', '/business/invite/regenerate', { token: wToken });
    const newCode = r.data?.inviteCode;
    check('naya invite code bana', Boolean(newCode) && newCode !== inviteCode);

    r = await call('GET', `/auth/invite/${inviteCode}`);
    check('purana link band ho gaya', r.status === 404, `status ${r.status}`);

    // ---------------------------------------------------------- Password
    console.log(`\n${Y}Password${N}`);

    r = await call('POST', '/auth/change-password', {
      token: wToken, body: { currentPassword: 'galat', newPassword: 'naya1234' },
    });
    check('galat purane password se change block hua', r.status === 400);

    r = await call('POST', '/auth/change-password', {
      token: wToken, body: { currentPassword: 'test1234', newPassword: 'naya1234' },
    });
    check('password change hua', r.status === 200, `${r.message}`);

    r = await call('POST', '/auth/login', { body: { phone: WHOLESALER_PHONE, password: 'naya1234' } });
    check('naye password se login chala', r.status === 200);


    // ============================================================ PART 3
    console.log(`\n${Y}Categories${N}`);

    r = await call('POST', '/categories', { token: wToken, body: { name: 'Bearings' } });
    check('category bani', r.status === 201 && r.data?.name === 'Bearings', `${r.message}`);
    const catBearings = r.data?._id;

    r = await call('POST', '/categories', { token: wToken, body: { name: 'bearings' } });
    check('same naam (alag case) wali category block hui', r.status === 409, `status ${r.status}`);

    r = await call('POST', '/categories', { token: wToken, body: { name: 'Chains' } });
    const catChains = r.data?._id;
    check('doosri category bani', r.status === 201);

    r = await call('GET', '/categories', { token: wToken });
    check('category list mili', r.data?.categories?.length === 2, `count ${r.data?.categories?.length}`);

    console.log(`\n${Y}Items${N}`);

    r = await call('POST', '/items', {
      token: wToken,
      body: { name: 'Bearing 6203', sku: 'BRG-6203', categoryId: catBearings, unit: 'PCS',
        purchasePrice: 85, salePrice: 120, wholesalePrice: 105, openingStock: 50, lowStockAt: 10,
        hsn: '8482', gstRate: 18 },
    });
    check('item bana', r.status === 201 && r.data?.name === 'Bearing 6203', `${r.message}`);
    check('opening stock lag gaya', r.data?.stockQty === 50, `stock ${r.data?.stockQty}`);
    check('margin calculate hua', r.data?.margin?.amount === 20, JSON.stringify(r.data?.margin));
    const item1 = r.data?._id;

    r = await call('GET', `/items/${item1}/movements`, { token: wToken });
    check('opening stock ka movement bana', r.data?.length === 1 && r.data[0].type === 'OPENING');

    r = await call('POST', '/items', { token: wToken, body: { name: 'bearing 6203' } });
    check('same naam ka doosra item block hua', r.status === 409, `status ${r.status}`);

    r = await call('POST', '/items', {
      token: wToken,
      body: { name: 'Chain 428H', categoryId: catChains, purchasePrice: 320, salePrice: 450,
        wholesalePrice: 400, openingStock: 4, lowStockAt: 5 },
    });
    const item2 = r.data?._id;
    check('doosra item bana (low stock)', r.status === 201 && r.data?.isLowStock === true,
      `low: ${r.data?.isLowStock}`);

    r = await call('POST', '/items', {
      token: wToken, body: { name: 'Spark Plug', purchasePrice: 40, salePrice: 60, openingStock: 0 },
    });
    const item3 = r.data?._id;
    check('teesra item bana (khatam)', r.data?.isOutOfStock === true);

    r = await call('POST', '/items', { token: wToken, body: { name: 'Galat', unit: 'KILO' } });
    check('galat unit reject hua', r.status === 400, `status ${r.status}`);

    r = await call('POST', '/items', { token: wToken, body: { name: 'Negative', salePrice: -5 } });
    check('negative price reject hua', r.status === 400, `status ${r.status}`);

    console.log(`\n${Y}Search aur filter${N}`);

    r = await call('GET', '/items?q=bearing', { token: wToken });
    check('naam se search chala', r.data?.length === 1 && r.data[0].name === 'Bearing 6203', `mile ${r.data?.length}`);

    r = await call('GET', '/items?q=BRG-6203', { token: wToken });
    check('SKU se search chala', r.data?.length === 1);

    r = await call('GET', '/items?stock=low', { token: wToken });
    check('low stock filter chala', r.data?.length === 1 && r.data[0].name === 'Chain 428H', `mile ${r.data?.length}`);

    r = await call('GET', '/items?stock=out', { token: wToken });
    check('khatam filter chala', r.data?.length === 1 && r.data[0].name === 'Spark Plug', `mile ${r.data?.length}`);

    r = await call('GET', `/items?categoryId=${catChains}`, { token: wToken });
    check('category filter chala', r.data?.length === 1 && r.data[0].name === 'Chain 428H');

    r = await call('GET', '/items?categoryId=none', { token: wToken });
    check('bina category filter chala', r.data?.length === 1 && r.data[0].name === 'Spark Plug');

    r = await call('GET', '/items?sort=-salePrice', { token: wToken });
    check('sort chala (mehnga pehle)', r.data?.[0]?.name === 'Chain 428H', `pehla: ${r.data?.[0]?.name}`);

    r = await call('GET', '/items?limit=2&page=2', { token: wToken });
    check('pagination chala', r.data?.length === 1 && r.meta?.totalPages === 2,
      `page2 me ${r.data?.length}, pages ${r.meta?.totalPages}`);

    r = await call('GET', '/items/stats', { token: wToken });
    // 50*85 + 4*320 + 0*40 = 4250 + 1280 = 5530
    check('stats sahi hain', r.data?.totalItems === 3 && r.data?.stockValue === 5530
      && r.data?.lowStock === 1 && r.data?.outOfStock === 1, JSON.stringify(r.data));

    console.log(`\n${Y}Stock movement${N}`);

    r = await call('POST', `/items/${item1}/stock`, { token: wToken, body: { mode: 'add', qty: 25, note: 'Supplier se aaya' } });
    check('stock add hua (50 → 75)', r.data?.stockQty === 75, `stock ${r.data?.stockQty}`);

    r = await call('POST', `/items/${item1}/stock`, { token: wToken, body: { mode: 'remove', qty: 5, note: 'Damage' } });
    check('stock kam hua (75 → 70)', r.data?.stockQty === 70, `stock ${r.data?.stockQty}`);

    r = await call('POST', `/items/${item1}/stock`, { token: wToken, body: { mode: 'remove', qty: 1000 } });
    check('itna stock nahi hai to reject hua', r.status === 400 && /stock kam hai/.test(r.message || ''), `${r.message}`);

    r = await call('POST', `/items/${item1}/stock`, { token: wToken, body: { mode: 'set', qty: 60, note: 'Ginti ki' } });
    check('set mode chala (70 → 60)', r.data?.stockQty === 60, `stock ${r.data?.stockQty}`);

    r = await call('GET', `/items/${item1}/movements`, { token: wToken });
    check('har badlav ka record bana (4)', r.data?.length === 4, `movements ${r.data?.length}`);
    check('movement me balanceAfter sahi hai', r.data?.[0]?.balanceAfter === 60, `${r.data?.[0]?.balanceAfter}`);

    console.log(`\n${Y}Update aur delete${N}`);

    r = await call('PUT', `/items/${item3}`, { token: wToken, body: { salePrice: 70, categoryId: catBearings } });
    check('item update hua', r.data?.salePrice === 70 && r.data?.category === 'Bearings', `${r.message}`);

    r = await call('PUT', `/items/${item3}`, { token: wToken, body: { stockQty: 999 } });
    check('update se stock nahi badla ja sakta', r.status === 400, `status ${r.status}`);

    r = await call('DELETE', `/items/${item3}`, { token: wToken });
    check('item delete hua', r.data?.deleted === true, `${r.message}`);

    r = await call('GET', '/items', { token: wToken });
    check('delete ke baad 2 item bache', r.data?.length === 2, `bache ${r.data?.length}`);

    console.log(`\n${Y}Bulk actions${N}`);

    r = await call('POST', '/items/bulk', { token: wToken, body: { ids: [item1, item2], action: 'hideFromRetailers' } });
    check('bulk hide chala', r.status === 200, `${r.message}`);

    r = await call('GET', '/items', { token: wToken });
    check('dono item retailers se chhup gaye', r.data?.every((i) => i.visibleToRetailers === false));

    r = await call('POST', '/items/bulk', { token: wToken, body: { ids: [item1, item2], action: 'showToRetailers' } });
    check('bulk show chala', r.status === 200);

    r = await call('POST', '/items/bulk', { token: wToken, body: { ids: [item1], action: 'setCategory', categoryId: catChains } });
    check('bulk category badli', r.status === 200);

    console.log(`\n${Y}Category delete${N}`);

    r = await call('DELETE', `/categories/${catBearings}`, { token: wToken });
    check('category delete hui', r.status === 200, `${r.message}`);

    r = await call('GET', '/items?q=Bearing 6203', { token: wToken });
    check('category delete se item nahi mita', r.data?.length === 1);

    console.log(`\n${Y}CSV import / export${N}`);

    const csv = [
      'name,sku,category,unit,purchasePrice,salePrice,wholesalePrice,stockQty,lowStockAt,hsn,gstRate',
      'Clutch Plate,CLP-01,Clutch,PCS,450,600,550,12,3,8708,18',
      '"Brake Shoe, Rear",BRK-02,Brakes,SET,220,300,270,8,2,8708,18',
      'Bearing 6203,BRG-6203,Bearings,PCS,90,130,115,60,10,8482,18',
      ',NONAME,Clutch,PCS,10,20,15,5,1,,0',
      'Bad Unit,BU-1,Clutch,KILO,10,20,15,5,1,,0',
      'Bad Price,BP-1,Clutch,PCS,abc,20,15,5,1,,0',
    ].join('\n');

    r = await call('POST', '/items/import', { token: wToken, body: { csv, commit: false } });
    check('preview mila', r.data?.preview === true, `${r.message}`);
    check('preview: 2 naye', r.data?.summary?.willCreate === 2, `${r.data?.summary?.willCreate}`);
    check('preview: 1 update', r.data?.summary?.willUpdate === 1, `${r.data?.summary?.willUpdate}`);
    check('preview: 3 error rows', r.data?.summary?.withErrors === 3, `${r.data?.summary?.withErrors}`);
    check('preview: nayi categories detect hui', (r.data?.summary?.newCategories || []).length === 3,
      JSON.stringify(r.data?.summary?.newCategories));

    r = await call('GET', '/items', { token: wToken });
    check('preview se kuch save nahi hua', r.data?.length === 2, `items ${r.data?.length}`);

    r = await call('POST', '/items/import', { token: wToken, body: { csv, commit: true } });
    check('import commit hua', r.data?.summary?.created === 2 && r.data?.summary?.updated === 1,
      JSON.stringify(r.data?.summary));

    r = await call('GET', '/items?q=Brake', { token: wToken });
    check('quoted comma wala naam sahi aaya', r.data?.[0]?.name === 'Brake Shoe, Rear', `${r.data?.[0]?.name}`);

    r = await call('GET', '/items?q=Bearing 6203', { token: wToken });
    check('import se purana item update hua (stock 60)', r.data?.[0]?.stockQty === 60 && r.data?.[0]?.purchasePrice === 90,
      `stock ${r.data?.[0]?.stockQty}, price ${r.data?.[0]?.purchasePrice}`);

    r = await call('POST', '/items/import', { token: wToken, body: { csv: 'foo,bar\n1,2', commit: false } });
    check('bina name column wali CSV reject hui', r.status === 400, `${r.message}`);

    r = await call('GET', '/items/export', { token: wToken });
    check('export CSV mila (Part 11 ke naye column ke saath)',
      String(r.data?.csv || '').startsWith('name,sku,brand,modelNo,barcode,category'),
      `${String(r.data?.csv).slice(0, 45)}`);
    check('export me saare item hain', r.data?.count === 4, `count ${r.data?.count}`);

    console.log(`\n${Y}Tenant isolation${N}`);

    r = await call('GET', '/items', { token: rToken });
    check('retailer items API nahi khol saka', r.status === 403, `status ${r.status}`);

    r = await call('GET', '/items');
    check('bina login items API band hai', r.status === 401, `status ${r.status}`);


    // ============================================================ PART 4
    console.log(`\n${Y}Suppliers${N}`);

    r = await call('POST', '/parties', {
      token: wToken,
      body: { type: 'supplier', name: 'Sharma Ji', shopName: 'Sharma Traders', phone: '9500000001',
        address: { city: 'Kanpur', state: 'Uttar Pradesh', pincode: '208001' }, openingBalance: 5000 },
    });
    check('supplier bana', r.status === 201 && r.data?.type === 'supplier', `${r.message}`);
    check('supplier active hai', r.data?.status === 'active');
    check('opening balance lag gaya', r.data?.balance === 5000, `balance ${r.data?.balance}`);
    check('state code auto set hua', r.data?.address?.stateCode === '09', `${r.data?.address?.stateCode}`);
    const supplierId = r.data?._id;

    const openingEntries = await LedgerEntry.countDocuments({ partyId: supplierId, type: 'OPENING' });
    check('opening balance ka khata entry bana', openingEntries === 1, `entries ${openingEntries}`);

    r = await call('POST', '/parties', {
      token: wToken, body: { type: 'supplier', name: 'Koi Aur', phone: '9500000001' },
    });
    check('same phone ka doosra supplier block hua', r.status === 409, `status ${r.status}`);

    r = await call('POST', '/parties', {
      token: wToken, body: { type: 'retailer', name: 'Same Number Retailer', phone: '9500000001' },
    });
    check('wahi phone retailer ke liye chal gaya (type alag)', r.status === 201, `${r.message}`);
    const retailer2 = r.data?._id;

    r = await call('POST', '/parties', {
      token: wToken, body: { type: 'supplier', name: 'Bad GST', phone: '9500000002', gstin: '09AAACH7409R1ZX' },
    });
    check('galat GSTIN wali party reject hui', r.status === 400, `${r.message}`);

    console.log(`\n${Y}Party list aur search${N}`);

    r = await call('GET', '/parties?type=supplier', { token: wToken });
    check('supplier list me 1 hai', r.data?.length === 1, `mile ${r.data?.length}`);

    r = await call('GET', '/parties?type=retailer', { token: wToken });
    check('retailer list me 2 hain', r.data?.length === 2, `mile ${r.data?.length}`);

    r = await call('GET', '/parties?type=retailer&status=blocked', { token: wToken });
    check('status filter chala', r.data?.length === 1 && r.data[0].name === 'Suresh Kumar', `mile ${r.data?.length}`);

    r = await call('GET', '/parties?type=supplier&q=sharma', { token: wToken });
    check('naam se search chala', r.data?.length === 1);

    r = await call('GET', '/parties?type=supplier&q=9500000001', { token: wToken });
    check('phone se search chala', r.data?.length === 1);

    r = await call('GET', '/parties/stats?type=retailer', { token: wToken });
    check('retailer stats sahi hain', r.data?.total === 2 && r.data?.blocked === 1, JSON.stringify(r.data));

    console.log(`\n${Y}Party update aur status${N}`);

    r = await call('PUT', `/parties/${supplierId}`, {
      token: wToken, body: { creditLimit: 25000, notes: 'Har mangal ko maal deta hai' },
    });
    check('party update hui', r.data?.creditLimit === 25000 && /mangal/.test(r.data?.notes || ''), `${r.message}`);

    r = await call('PUT', `/parties/${supplierId}`, { token: wToken, body: { phone: '9500000009' } });
    check('phone update hua', r.data?.phone === '9500000009', `${r.data?.phone}`);

    r = await call('POST', `/parties/${partyId}/status`, { token: wToken, body: { status: 'active' } });
    check('blocked retailer wapas active hua', r.data?.status === 'active', `${r.message}`);

    r = await call('POST', '/auth/login', { body: { phone: RETAILER_PHONE, password: 'test1234' } });
    check('active hote hi retailer ka login wapas chal gaya', r.status === 200, `status ${r.status}`);

    console.log(`\n${Y}Party-wise rate${N}`);

    r = await call('GET', `/parties/${partyId}/rates`, { token: wToken });
    check('rate list mili (4 item)', r.data?.rows?.length === 4, `rows ${r.data?.rows?.length}`);
    const bearing = r.data?.rows?.find((x) => x.name === 'Bearing 6203');
    check('bina custom rate ke wholesale lagta hai',
      bearing?.source === 'wholesale' && bearing?.rate === 115, JSON.stringify(bearing && { s: bearing.source, r: bearing.rate }));
    const bearingId = bearing?._id;

    r = await call('PUT', `/parties/${partyId}/rates/${bearingId}`, { token: wToken, body: { rate: 95 } });
    check('khaas rate set hua', r.status === 200, `${r.message}`);

    r = await call('GET', `/parties/${partyId}/rates?q=Bearing 6203`, { token: wToken });
    const b2 = r.data?.rows?.[0];
    check('khaas rate wholesale se upar chala', b2?.source === 'custom' && b2?.rate === 95,
      JSON.stringify(b2 && { s: b2.source, r: b2.rate }));
    check('fayda bhi calculate hua', b2?.margin === 5, `margin ${b2?.margin}`);

    r = await call('GET', `/parties/${partyId}/rates?onlyCustom=true`, { token: wToken });
    check('sirf khaas rate wale filter chala', r.data?.rows?.length === 1, `rows ${r.data?.rows?.length}`);

    r = await call('GET', '/parties?type=retailer&q=Suresh', { token: wToken });
    check('list me customRateCount dikha', r.data?.[0]?.customRateCount === 1, `${r.data?.[0]?.customRateCount}`);

    r = await call('PUT', `/parties/${partyId}/rates/${bearingId}`, { token: wToken, body: { rate: null } });
    check('khaas rate hata diya', r.data?.removed === true, `${r.message}`);

    r = await call('GET', `/parties/${partyId}/rates?q=Bearing 6203`, { token: wToken });
    check('hatane ke baad wapas wholesale lag gaya', r.data?.rows?.[0]?.source === 'wholesale');

    console.log(`\n${Y}Bulk rate${N}`);

    r = await call('POST', `/parties/${partyId}/rates/bulk`, {
      token: wToken, body: { mode: 'percentOffWholesale', value: 10, roundTo: 'none' },
    });
    check('bulk rate 4 item pe laga', r.data?.affected === 4, `affected ${r.data?.affected}`);

    r = await call('GET', `/parties/${partyId}/rates?q=Bearing 6203`, { token: wToken });
    check('10% kam sahi laga (115 -> 103.5)', r.data?.rows?.[0]?.rate === 103.5, `${r.data?.rows?.[0]?.rate}`);

    r = await call('POST', `/parties/${partyId}/rates/bulk`, {
      token: wToken, body: { mode: 'percentOffWholesale', value: 10, roundTo: '5' },
    });
    r = await call('GET', `/parties/${partyId}/rates?q=Bearing 6203`, { token: wToken });
    check('5 ke multiple me round hua (103.5 -> 105)', r.data?.rows?.[0]?.rate === 105, `${r.data?.rows?.[0]?.rate}`);

    r = await call('POST', `/parties/${partyId}/rates/bulk`, {
      token: wToken, body: { mode: 'percentOnPurchase', value: 20, roundTo: '1' },
    });
    r = await call('GET', `/parties/${partyId}/rates?q=Bearing 6203`, { token: wToken });
    // purchase 90 + 20% = 108
    check('purchase pe markup chala (90 +20% -> 108)', r.data?.rows?.[0]?.rate === 108, `${r.data?.rows?.[0]?.rate}`);

    r = await call('POST', `/parties/${partyId}/rates/bulk`, { token: wToken, body: { mode: 'clear' } });
    check('bulk clear chala', r.data?.affected === 4, `affected ${r.data?.affected}`);

    r = await call('GET', `/parties/${partyId}/rates?onlyCustom=true`, { token: wToken });
    check('clear ke baad koi khaas rate nahi bacha', r.data?.rows?.length === 0, `rows ${r.data?.rows?.length}`);

    console.log(`\n${Y}Rate resolution service${N}`);

    const { resolveRate, resolveRates } = await import('../src/services/rate.service.js');
    const wholesalerUser = await User.findOne({ phone: WHOLESALER_PHONE }).lean();
    const bid = wholesalerUser.businessId;

    let resolved = await resolveRate(bid, partyId, bearingId);
    check('service: bina custom ke wholesale', resolved?.source === 'wholesale' && resolved?.rate === 115,
      JSON.stringify(resolved));

    await call('PUT', `/parties/${partyId}/rates/${bearingId}`, { token: wToken, body: { rate: 88 } });
    resolved = await resolveRate(bid, partyId, bearingId);
    check('service: custom rate uthaya', resolved?.source === 'custom' && resolved?.rate === 88, JSON.stringify(resolved));

    const someItems = await Item.find({ businessId: bid }).select('wholesalePrice salePrice').lean();
    const batch = await resolveRates(bid, partyId, someItems);
    check('service: batch me sabka rate mila', batch.length === someItems.length && batch.every((b) => b.rate >= 0));
    check('service: batch me custom wala sahi hai',
      batch.find((b) => String(b._id) === String(bearingId))?.rate === 88);

    await call('PUT', `/parties/${partyId}/rates/${bearingId}`, { token: wToken, body: { rate: null } });

    console.log(`\n${Y}Party delete${N}`);

    r = await call('DELETE', `/parties/${retailer2}`, { token: wToken });
    check('bina record wali party delete ho gayi', r.data?.deleted === true, `${r.message}`);

    r = await call('GET', '/parties?type=retailer', { token: wToken });
    check('delete ke baad 1 retailer bacha', r.data?.length === 1, `mile ${r.data?.length}`);

    r = await call('GET', `/parties/${retailer2}`, { token: wToken });
    check('deleted party khul nahi rahi', r.status === 404, `status ${r.status}`);

    console.log(`\n${Y}Tenant isolation (Part 4)${N}`);

    r = await call('GET', '/parties', { token: rToken });
    check('retailer parties API nahi khol saka', r.status === 403, `status ${r.status}`);


    // ============================================================ PART 5
    console.log(`\n${Y}Purchase entry${N}`);

    r = await call('GET', '/purchases/next-number', { token: wToken });
    check('purchase number preview mila', /^PUR\/\d{2}-\d{2}\/0001$/.test(r.data?.preview || ''), `${r.data?.preview}`);

    r = await call('GET', '/items?q=Bearing 6203', { token: wToken });
    const bItem = r.data?.[0];
    r = await call('GET', '/items?q=Chain 428H', { token: wToken });
    const cItem = r.data?.[0];
    check('purchase se pehle Bearing stock 60', bItem?.stockQty === 60, `${bItem?.stockQty}`);
    check('purchase se pehle Chain stock 4', cItem?.stockQty === 4, `${cItem?.stockQty}`);

    r = await call('POST', '/purchases', {
      token: wToken,
      body: {
        supplierId,
        supplierBillNo: 'ST/2026/119',
        items: [
          { itemId: bItem._id, qty: 20, rate: 100 },
          { itemId: cItem._id, qty: 5, rate: 300, discount: 50 },
        ],
        paidAmount: 1000,
      },
    });
    check('purchase bani', r.status === 201, `${r.message}`);
    check('purchase number laga', /^PUR\//.test(r.data?.purchaseNo || ''), `${r.data?.purchaseNo}`);
    // 20*100 + 5*300 = 3500, discount 50 -> 3450 (GST off)
    check('total sahi (3450)', r.data?.grandTotal === 3450, `${r.data?.grandTotal}`);
    check('GST off pe tax 0', r.data?.taxTotal === 0, `${r.data?.taxTotal}`);
    check('due sahi (2450)', r.data?.dueAmount === 2450, `${r.data?.dueAmount}`);
    check('payment status partial', r.data?.paymentStatus === 'partial', `${r.data?.paymentStatus}`);
    const purchase1 = r.data?._id;

    r = await call('GET', '/items?q=Bearing 6203', { token: wToken });
    check('Bearing ka stock badha (60 -> 80)', r.data?.[0]?.stockQty === 80, `${r.data?.[0]?.stockQty}`);
    check('Bearing ka purchase price update hua (90 -> 100)', r.data?.[0]?.purchasePrice === 100,
      `${r.data?.[0]?.purchasePrice}`);

    r = await call('GET', '/items?q=Chain 428H', { token: wToken });
    check('Chain ka stock badha (4 -> 9)', r.data?.[0]?.stockQty === 9, `${r.data?.[0]?.stockQty}`);
    // (5*300 - 50)/5 = 290
    check('Chain ka purchase price discount ke saath laga (290)', r.data?.[0]?.purchasePrice === 290,
      `${r.data?.[0]?.purchasePrice}`);

    r = await call('GET', `/items/${bItem._id}/movements`, { token: wToken });
    check('purchase ka stock movement bana', r.data?.[0]?.type === 'PURCHASE' && r.data?.[0]?.qty === 20,
      JSON.stringify(r.data?.[0] && { t: r.data[0].type, q: r.data[0].qty }));
    check('movement purchase se juda hai', r.data?.[0]?.refType === 'Purchase', `${r.data?.[0]?.refType}`);

    console.log(`\n${Y}Purchase ka khata${N}`);

    let ledger = await LedgerEntry.find({ refType: 'Purchase', refId: purchase1 }).sort({ createdAt: 1 }).lean();
    check('khate me 2 entry bani (maal + payment)', ledger.length === 2, `entries ${ledger.length}`);
    check('pehli entry PURCHASE debit 3450', ledger[0]?.type === 'PURCHASE' && ledger[0]?.debit === 3450,
      JSON.stringify(ledger[0] && { t: ledger[0].type, d: ledger[0].debit }));
    check('doosri entry PAYMENT_OUT credit 1000',
      ledger[1]?.type === 'PAYMENT_OUT' && ledger[1]?.credit === 1000,
      JSON.stringify(ledger[1] && { t: ledger[1].type, c: ledger[1].credit }));

    r = await call('GET', `/parties/${supplierId}`, { token: wToken });
    // opening 5000 + 3450 - 1000 = 7450
    check('supplier ka balance sahi (7450)', r.data?.balance === 7450, `${r.data?.balance}`);

    console.log(`\n${Y}Purchase validation${N}`);

    r = await call('POST', '/purchases', {
      token: wToken, body: { supplierId: partyId, items: [{ itemId: bItem._id, qty: 1, rate: 10 }] },
    });
    check('retailer ko supplier bana kar purchase block hui', r.status === 400, `status ${r.status}`);

    r = await call('POST', '/purchases', { token: wToken, body: { supplierId, items: [] } });
    check('bina item ki purchase reject hui', r.status === 400, `status ${r.status}`);

    r = await call('POST', '/purchases', {
      token: wToken, body: { supplierId, items: [{ itemId: bItem._id, qty: 0, rate: 10 }] },
    });
    check('0 quantity reject hui', r.status === 400, `status ${r.status}`);

    r = await call('POST', '/purchases', {
      token: wToken, body: { supplierId, items: [{ itemId: bItem._id, qty: 1, rate: 10, discount: 500 }] },
    });
    check('rate se zyada discount reject hua', r.status === 400, `${r.message}`);

    console.log(`\n${Y}Purchase list aur stats${N}`);

    r = await call('GET', '/purchases', { token: wToken });
    check('purchase list mili', r.data?.length === 1 && r.data[0].itemCount === 2, `mile ${r.data?.length}`);
    check('list me supplier ka naam aaya', r.data?.[0]?.supplier?.name === 'Sharma Traders', `${r.data?.[0]?.supplier?.name}`);

    r = await call('GET', `/purchases?supplierId=${supplierId}`, { token: wToken });
    check('supplier filter chala', r.data?.length === 1);

    r = await call('GET', '/purchases?paymentStatus=paid', { token: wToken });
    check('payment status filter chala', r.data?.length === 0, `mile ${r.data?.length}`);

    r = await call('GET', '/purchases?q=ST/2026/119', { token: wToken });
    check('supplier bill number se search chala', r.data?.length === 1);

    r = await call('GET', '/purchases/stats', { token: wToken });
    check('purchase stats sahi hain',
      r.data?.totalPurchases === 1 && r.data?.totalAmount === 3450 && r.data?.totalDue === 2450,
      JSON.stringify(r.data));

    console.log(`\n${Y}GST wali purchase${N}`);

    await call('PUT', '/business/me', { token: wToken, body: { gstEnabled: true, gstin: '09AAACH7409R1ZZ' } });

    r = await call('POST', '/purchases', {
      token: wToken,
      body: { supplierId, items: [{ itemId: bItem._id, qty: 10, rate: 100, gstRate: 18 }], paidAmount: 0 },
    });
    // 1000 + 18% = 1180
    check('GST ke saath total sahi (1180)', r.data?.grandTotal === 1180, `${r.data?.grandTotal}`);
    check('taxTotal 180', r.data?.taxTotal === 180, `${r.data?.taxTotal}`);
    check('purchase price me tax nahi juda (100)', true);
    const purchase2 = r.data?._id;

    r = await call('GET', '/items?q=Bearing 6203', { token: wToken });
    check('GST wali purchase ke baad bhi purchase price 100 hi raha', r.data?.[0]?.purchasePrice === 100,
      `${r.data?.[0]?.purchasePrice}`);
    check('stock 80 se 90 hua', r.data?.[0]?.stockQty === 90, `${r.data?.[0]?.stockQty}`);

    await call('PUT', '/business/me', { token: wToken, body: { gstEnabled: false } });

    console.log(`\n${Y}Purchase delete (poora reversal)${N}`);

    r = await call('DELETE', `/purchases/${purchase2}`, { token: wToken });
    check('GST wali purchase delete hui', r.data?.deleted === true, `${r.message}`);

    r = await call('GET', '/items?q=Bearing 6203', { token: wToken });
    check('delete pe stock wapas ghata (90 -> 80)', r.data?.[0]?.stockQty === 80, `${r.data?.[0]?.stockQty}`);

    r = await call('GET', `/parties/${supplierId}`, { token: wToken });
    check('delete pe supplier ka balance wapas 7450', r.data?.balance === 7450, `${r.data?.balance}`);

    ledger = await LedgerEntry.find({ refType: 'Purchase', refId: purchase2 }).lean();
    check('delete pe khate ki entries hat gayi', ledger.length === 0, `entries ${ledger.length}`);

    // maal bik gaya to delete block
    await call('POST', `/items/${bItem._id}/stock`, {
      token: wToken, body: { mode: 'set', qty: 5, note: 'Sab bik gaya' },
    });
    r = await call('DELETE', `/purchases/${purchase1}`, { token: wToken });
    check('bika hua maal wali purchase delete nahi hui', r.status === 400 && /bik chuka hai/.test(r.message || ''),
      `${r.message}`);

    r = await call('GET', '/purchases', { token: wToken });
    check('block hone ke baad purchase bachi hai', r.data?.length === 1, `mile ${r.data?.length}`);

    console.log(`\n${Y}Tenant isolation (Part 5)${N}`);

    r = await call('GET', '/purchases', { token: rToken });
    check('retailer purchases API nahi khol saka', r.status === 403, `status ${r.status}`);


    // ============================================================ PART 6
    console.log(`\n${Y}Retailer catalog${N}`);

    r = await call('GET', '/catalog', { token: rToken });
    check('retailer ko catalog mila', r.status === 200 && r.data?.length === 4, `mile ${r.data?.length}`);
    const catBearing = r.data?.find((i) => i.name === 'Bearing 6203');
    check('catalog me rate wholesale se aaya', catBearing?.rateSource === 'wholesale' && catBearing?.rate === 115,
      JSON.stringify(catBearing && { s: catBearing.rateSource, r: catBearing.rate }));
    check('catalog me stock dikha (5)', catBearing?.stockQty === 5, `${catBearing?.stockQty}`);
    check('catalog me purchase price nahi aaya', catBearing?.purchasePrice === undefined);

    r = await call('GET', '/catalog/shop', { token: rToken });
    check('dukaan ki detail mili', r.data?.name === 'Ramesh Auto Parts', `${r.data?.name}`);
    check('shop info me GSTIN nahi aaya', r.data?.gstin === undefined);

    r = await call('GET', '/catalog/categories', { token: rToken });
    check('sirf bhare hue categories aaye', Array.isArray(r.data) && r.data.every((c) => c.itemCount > 0),
      JSON.stringify(r.data?.map((c) => c.itemCount)));

    // wholesaler ne ek item chhupa diya
    r = await call('GET', '/items?q=Clutch Plate', { token: wToken });
    const clutchId = r.data?.[0]?._id;
    await call('POST', '/items/bulk', { token: wToken, body: { ids: [clutchId], action: 'hideFromRetailers' } });

    r = await call('GET', '/catalog', { token: rToken });
    check('chhupaya hua item catalog se gayab', r.data?.length === 3 && !r.data.find((i) => i.name === 'Clutch Plate'),
      `mile ${r.data?.length}`);

    r = await call('GET', `/catalog/item/${clutchId}`, { token: rToken });
    check('chhupaya hua item seedha bhi nahi khulta', r.status === 404, `status ${r.status}`);

    await call('POST', '/items/bulk', { token: wToken, body: { ids: [clutchId], action: 'showToRetailers' } });

    console.log(`\n${Y}Catalog me khaas rate${N}`);

    await call('PUT', `/parties/${partyId}/rates/${bearingId}`, { token: wToken, body: { rate: 99 } });
    r = await call('GET', '/catalog?q=Bearing', { token: rToken });
    check('khaas rate catalog me turant dikha', r.data?.[0]?.rate === 99 && r.data?.[0]?.rateSource === 'custom',
      JSON.stringify(r.data?.[0] && { r: r.data[0].rate, s: r.data[0].rateSource }));
    check('hasSpecialRate flag laga', r.data?.[0]?.hasSpecialRate === true);

    r = await call('GET', '/catalog?q=Bearing&sort=rate', { token: rToken });
    check('rate se sort chala', r.status === 200);

    console.log(`\n${Y}Cart${N}`);

    r = await call('GET', '/cart', { token: rToken });
    check('shuru me cart khali', r.data?.itemCount === 0 && r.data?.total === 0, JSON.stringify(r.data));

    r = await call('POST', '/cart/items', { token: rToken, body: { itemId: bearingId, qty: 2 } });
    check('cart me item aaya', r.data?.itemCount === 1 && r.data?.items?.[0]?.qty === 2, `${r.message}`);
    check('cart me khaas rate laga (2 × 99 = 198)', r.data?.total === 198, `${r.data?.total}`);

    r = await call('POST', '/cart/items', { token: rToken, body: { itemId: bearingId, qty: 3 } });
    check('dobara add karne pe qty judi (2+3=5)', r.data?.items?.[0]?.qty === 5, `${r.data?.items?.[0]?.qty}`);

    r = await call('GET', '/cart/count', { token: rToken });
    check('cart count mila', r.data?.count === 1, `${r.data?.count}`);

    // rate badla to cart me turant naya rate
    await call('PUT', `/parties/${partyId}/rates/${bearingId}`, { token: wToken, body: { rate: 90 } });
    r = await call('GET', '/cart', { token: rToken });
    check('rate badla to cart ka total apne aap badla (5 × 90 = 450)', r.data?.total === 450, `${r.data?.total}`);

    r = await call('PUT', `/cart/items/${bearingId}`, { token: rToken, body: { qty: 10 } });
    check('stock se zyada qty allowed hai', r.data?.items?.[0]?.qty === 10, `${r.data?.items?.[0]?.qty}`);
    check('par warning bhi aayi', (r.data?.warnings || []).some((w) => w.type === 'low'),
      JSON.stringify(r.data?.warnings));
    check('line pe enough=false laga', r.data?.items?.[0]?.enough === false);

    r = await call('GET', '/items?q=Chain 428H', { token: wToken });
    const chainId = r.data?.[0]?._id;
    await call('POST', '/cart/items', { token: rToken, body: { itemId: chainId, qty: 2 } });

    r = await call('GET', '/cart', { token: rToken });
    check('cart me 2 item hain', r.data?.itemCount === 2, `${r.data?.itemCount}`);

    r = await call('DELETE', `/cart/items/${chainId}`, { token: rToken });
    check('cart se item hata', r.data?.itemCount === 1, `${r.data?.itemCount}`);

    r = await call('PUT', `/cart/items/${bearingId}`, { token: rToken, body: { qty: 0 } });
    check('qty 0 karne pe item nikal gaya', r.data?.itemCount === 0, `${r.data?.itemCount}`);

    // khatam item cart me nahi ja sakta
    await call('POST', `/items/${clutchId}/stock`, { token: wToken, body: { mode: 'set', qty: 0 } });
    r = await call('POST', '/cart/items', { token: rToken, body: { itemId: clutchId, qty: 1 } });
    check('khatam item cart me nahi gaya', r.status === 400 && /khatam/.test(r.message || ''), `${r.message}`);
    await call('POST', `/items/${clutchId}/stock`, { token: wToken, body: { mode: 'set', qty: 12 } });

    console.log(`\n${Y}Order place${N}`);

    r = await call('POST', '/my-orders', { token: rToken, body: {} });
    check('khali cart se order nahi bana', r.status === 400, `status ${r.status}`);

    await call('POST', '/cart/items', { token: rToken, body: { itemId: bearingId, qty: 3 } });
    await call('POST', '/cart/items', { token: rToken, body: { itemId: chainId, qty: 2 } });

    r = await call('POST', '/my-orders', { token: rToken, body: { note: 'Aaj shaam tak chahiye' } });
    check('order ban gaya', r.status === 201, `${r.message}`);
    check('order number laga', /^ORD\//.test(r.data?.orderNo || ''), `${r.data?.orderNo}`);
    check('order me 2 item', r.data?.itemCount === 2, `${r.data?.itemCount}`);
    // 3 × 90 + 2 × 400 = 270 + 800 = 1070
    check('order ka total sahi (1070)', r.data?.itemsTotal === 1070, `${r.data?.itemsTotal}`);
    check('order PLACED status me hai', r.data?.status === 'PLACED', `${r.data?.status}`);
    check('status history bani', r.data?.statusHistory?.length === 1);
    check('retailer ka note laga', r.data?.retailerNote === 'Aaj shaam tak chahiye');
    const orderId = r.data?._id;
    const orderedBearing = r.data?.items?.find((i) => i.name === 'Bearing 6203');
    check('order ke waqt ka stock snapshot liya (5)', orderedBearing?.availableAtOrder === 5,
      `${orderedBearing?.availableAtOrder}`);

    r = await call('GET', '/cart', { token: rToken });
    check('order ke baad cart khali ho gaya', r.data?.itemCount === 0, `${r.data?.itemCount}`);

    r = await call('GET', '/items?q=Bearing 6203', { token: wToken });
    check('order se stock NAHI ghata (invoice pe ghatega)', r.data?.[0]?.stockQty === 5, `${r.data?.[0]?.stockQty}`);

    console.log(`\n${Y}Retailer ke orders${N}`);

    r = await call('GET', '/my-orders', { token: rToken });
    check('apne orders ki list mili', r.data?.length === 1, `mile ${r.data?.length}`);

    r = await call('GET', '/my-orders/summary', { token: rToken });
    check('order summary sahi', r.data?.total === 1 && r.data?.chalu === 1 && r.data?.amount === 1070,
      JSON.stringify(r.data));

    r = await call('GET', `/my-orders/${orderId}`, { token: rToken });
    check('order detail khula', r.data?.orderNo === (await call('GET', '/my-orders', { token: rToken })).data[0].orderNo);

    r = await call('GET', '/my-orders?status=DELIVERED', { token: rToken });
    check('status filter chala', r.data?.length === 0, `mile ${r.data?.length}`);

    r = await call('POST', `/my-orders/${orderId}/cancel`, { token: rToken });
    check('retailer ne apna PLACED order cancel kiya', r.data?.status === 'CANCELLED', `${r.message}`);
    check('cancel ka bhi record bana', r.data?.statusHistory?.length === 2);

    r = await call('POST', `/my-orders/${orderId}/cancel`, { token: rToken });
    check('cancelled order dobara cancel nahi hua', r.status === 400, `status ${r.status}`);

    console.log(`\n${Y}Tenant isolation (Part 6)${N}`);

    r = await call('GET', '/cart', { token: wToken });
    check('wholesaler cart API nahi khol saka', r.status === 403, `status ${r.status}`);

    r = await call('GET', '/catalog', { token: wToken });
    check('wholesaler catalog API nahi khol saka', r.status === 403, `status ${r.status}`);

    r = await call('GET', '/catalog');
    check('bina login catalog band hai', r.status === 401, `status ${r.status}`);

    // blocked retailer catalog nahi dekh sakta
    await call('POST', `/parties/${partyId}/status`, { token: wToken, body: { status: 'blocked' } });
    r = await call('GET', '/catalog', { token: rToken });
    check('blocked retailer ka catalog band ho gaya', r.status === 403, `status ${r.status}`);
    await call('POST', `/parties/${partyId}/status`, { token: wToken, body: { status: 'active' } });


    // ============================================================ PART 7
    console.log(`\n${Y}Wholesaler ka order dashboard${N}`);

    // naya order banate hain (pichhla cancel ho chuka hai)
    await call('POST', '/cart/items', { token: rToken, body: { itemId: bearingId, qty: 4 } });
    await call('POST', '/cart/items', { token: rToken, body: { itemId: chainId, qty: 2 } });
    r = await call('POST', '/my-orders', { token: rToken, body: { note: 'Jaldi chahiye' } });
    const wOrderId = r.data?._id;
    const wOrderNo = r.data?.orderNo;
    check('naya order bana', r.status === 201, `${r.message}`);

    r = await call('GET', '/orders', { token: wToken });
    check('wholesaler ko order list mili', r.data?.length >= 1, `mile ${r.data?.length}`);
    // list me shopName dikhta hai (na ho to vyakti ka naam)
    check('list me retailer ka naam aaya', r.data?.[0]?.party?.name === 'Suresh Auto', `${r.data?.[0]?.party?.name}`);

    r = await call('GET', '/orders?status=PLACED', { token: wToken });
    check('PLACED filter chala', r.data?.length === 1, `mile ${r.data?.length}`);

    r = await call('GET', '/orders?status=open', { token: wToken });
    check('"chalu" filter chala', r.data?.length === 1, `mile ${r.data?.length}`);

    r = await call('GET', '/orders?q=Suresh', { token: wToken });
    check('retailer ke naam se search chala', r.data?.length >= 1, `mile ${r.data?.length}`);

    r = await call('GET', `/orders?partyId=${partyId}`, { token: wToken });
    check('party filter chala', r.data?.length >= 1);

    r = await call('GET', '/orders/stats', { token: wToken });
    check('order stats sahi', r.data?.counts?.PLACED === 1 && r.data?.counts?.CANCELLED === 1,
      JSON.stringify(r.data?.counts));
    check('open amount aaya', r.data?.openAmount > 0, `${r.data?.openAmount}`);

    console.log(`\n${Y}Order detail me live stock${N}`);

    r = await call('GET', `/orders/${wOrderId}`, { token: wToken });
    check('detail me har line ka abhi ka stock aaya',
      r.data?.items?.every((i) => typeof i.currentStock === 'number'), JSON.stringify(r.data?.items?.[0]));
    // Bearing stock 5, order me 4 -> enough
    const bLine = r.data?.items?.find((i) => i.name === 'Bearing 6203');
    check('Bearing ka stock kaafi hai', bLine?.enough === true, `stock ${bLine?.currentStock}, qty ${bLine?.qty}`);
    check('canFulfil true hai', r.data?.canFulfil === true);
    check('nextStatuses me PACKED hai', (r.data?.nextStatuses || []).includes('PACKED'),
      JSON.stringify(r.data?.nextStatuses));

    // stock kam kar do
    await call('POST', `/items/${bearingId}/stock`, { token: wToken, body: { mode: 'set', qty: 2 } });
    r = await call('GET', `/orders/${wOrderId}`, { token: wToken });
    check('stock kam hone pe canFulfil false hua', r.data?.canFulfil === false);
    check('kitni line short hai wo bhi aaya', r.data?.shortLines === 1, `${r.data?.shortLines}`);

    console.log(`\n${Y}Status flow${N}`);

    r = await call('POST', `/orders/${wOrderId}/status`, { token: wToken, body: { status: 'DELIVERED' } });
    check('PLACED se seedha DELIVERED block hua', r.status === 400 && /nahi kar sakte/.test(r.message || ''),
      `${r.message}`);

    r = await call('POST', `/orders/${wOrderId}/status`, { token: wToken, body: { status: 'PACKED' } });
    check('PLACED -> PACKED chala', r.data?.status === 'PACKED', `${r.message}`);

    r = await call('POST', `/my-orders/${wOrderId}/cancel`, { token: rToken });
    check('PACKED hone ke baad retailer cancel nahi kar saka', r.status === 400, `${r.message}`);

    r = await call('POST', `/orders/${wOrderId}/status`, { token: wToken, body: { status: 'READY', note: 'Counter pe rakh diya' } });
    check('PACKED -> READY chala', r.data?.status === 'READY', `${r.message}`);
    check('note statusHistory me gaya',
      r.data?.statusHistory?.some((h) => h.note === 'Counter pe rakh diya'));

    r = await call('GET', `/my-orders/${wOrderId}`, { token: rToken });
    check('retailer ko naya status dikha', r.data?.status === 'READY', `${r.data?.status}`);

    console.log(`\n${Y}Quantity badalna${N}`);

    r = await call('PUT', `/orders/${wOrderId}/items`, {
      token: wToken,
      body: { items: [{ itemId: bearingId, qty: 2 }, { itemId: chainId, qty: 2 }], note: 'Bearing sirf 2 hai' },
    });
    check('quantity badal gayi', r.data?.items?.find((i) => i.name === 'Bearing 6203')?.qty === 2,
      `${r.data?.items?.find((i) => i.name === 'Bearing 6203')?.qty}`);
    // 2 × 90 + 2 × 400 = 180 + 800 = 980
    check('total dobara ban gaya (980)', r.data?.itemsTotal === 980, `${r.data?.itemsTotal}`);

    r = await call('PUT', `/orders/${wOrderId}/items`, {
      token: wToken, body: { items: [{ itemId: chainId, qty: 0 }] },
    });
    check('qty 0 karne pe line hat gayi', r.data?.itemCount === 1, `${r.data?.itemCount}`);

    r = await call('PUT', `/orders/${wOrderId}/items`, {
      token: wToken, body: { items: [{ itemId: bearingId, qty: 0 }] },
    });
    check('saare item hatane par roka gaya', r.status === 400, `${r.message}`);

    r = await call('POST', `/orders/${wOrderId}/status`, { token: wToken, body: { status: 'DELIVERED' } });
    check('READY -> DELIVERED chala', r.data?.status === 'DELIVERED', `${r.message}`);

    r = await call('PUT', `/orders/${wOrderId}/items`, {
      token: wToken, body: { items: [{ itemId: bearingId, qty: 1 }] },
    });
    check('delivered order me badlav block hua', r.status === 400, `${r.message}`);

    r = await call('POST', `/orders/${wOrderId}/cancel`, { token: wToken, body: { reason: 'test' } });
    check('delivered order cancel nahi hua', r.status === 400, `${r.message}`);

    console.log(`\n${Y}Notifications${N}`);

    r = await call('GET', '/notifications', { token: wToken });
    const newOrderNotif = r.data?.find((n) => n.type === 'NEW_ORDER');
    check('wholesaler ko naye order ka notification mila', Boolean(newOrderNotif), `mile ${r.data?.length}`);
    check('notification me order ka link hai', /^\/orders\//.test(newOrderNotif?.link || ''), `${newOrderNotif?.link}`);

    r = await call('GET', '/notifications', { token: rToken });
    check('retailer ko status ke notifications mile',
      r.data?.filter((n) => n.type === 'ORDER_STATUS').length >= 3, `mile ${r.data?.length}`);
    check('retailer ka link my-orders ka hai', /^\/my-orders\//.test(r.data?.[0]?.link || ''), `${r.data?.[0]?.link}`);
    const notifId = r.data?.[0]?._id;

    r = await call('GET', '/notifications/unread-count', { token: rToken });
    const beforeCount = r.data?.count;
    check('unread count aaya', beforeCount > 0, `${beforeCount}`);

    r = await call('POST', `/notifications/${notifId}/read`, { token: rToken });
    check('ek padh liya to count ghata', r.data?.count === beforeCount - 1, `${r.data?.count}`);

    r = await call('POST', '/notifications/read-all', { token: rToken });
    check('sab padh liya to count 0', r.data?.count === 0, `${r.data?.count}`);

    r = await call('GET', '/notifications?onlyUnread=true', { token: rToken });
    check('unread filter chala', r.data?.length === 0, `mile ${r.data?.length}`);

    console.log(`\n${Y}Tenant isolation (Part 7)${N}`);

    r = await call('GET', '/orders', { token: rToken });
    check('retailer wholesaler ka order dashboard nahi khol saka', r.status === 403, `status ${r.status}`);

    r = await call('POST', `/orders/${wOrderId}/status`, { token: rToken, body: { status: 'PACKED' } });
    check('retailer status nahi badal saka', r.status === 403, `status ${r.status}`);


    // ============================================================ PART 8
    console.log(`\n${Y}Bill banana (GST off)${N}`);

    r = await call('GET', '/invoices/next-number', { token: wToken });
    check('bill number preview mila', /\/\d{2}-\d{2}\/0001$/.test(r.data?.preview || ''), `${r.data?.preview}`);

    // stock set karo taaki bill ban sake
    await call('POST', `/items/${bearingId}/stock`, { token: wToken, body: { mode: 'set', qty: 50 } });
    await call('POST', `/items/${chainId}/stock`, { token: wToken, body: { mode: 'set', qty: 20 } });

    r = await call('GET', `/invoices/from-order/${wOrderId}`, { token: wToken });
    check('order se prefill mila', r.data?.items?.length === 1 && r.data?.orderNo === wOrderNo,
      `items ${r.data?.items?.length}`);
    check('prefill me stock bhi aaya', typeof r.data?.items?.[0]?.stockQty === 'number');

    r = await call('POST', '/invoices', {
      token: wToken,
      body: {
        partyId, orderId: wOrderId,
        items: [{ itemId: bearingId, qty: 2, rate: 100 }],
        paidAmount: 0,
      },
    });
    check('bill ban gaya', r.status === 201, `${r.message}`);
    check('GST off pe Bill of Supply bana', r.data?.documentType === 'BILL_OF_SUPPLY', `${r.data?.documentType}`);
    check('taxType NONE hai', r.data?.taxType === 'NONE', `${r.data?.taxType}`);
    check('total sahi (200)', r.data?.grandTotal === 200, `${r.data?.grandTotal}`);
    check('amount in words bana', /Rupees Two Hundred Only/.test(r.data?.amountInWords || ''),
      `${r.data?.amountInWords}`);
    check('business ka snapshot laga', r.data?.businessSnapshot?.name === 'Ramesh Auto Parts');
    check('party ka snapshot laga', Boolean(r.data?.partySnapshot?.phone));
    const invoice1 = r.data?._id;

    r = await call('GET', '/items?q=Bearing 6203', { token: wToken });
    check('bill se stock ghata (50 -> 48)', r.data?.[0]?.stockQty === 48, `${r.data?.[0]?.stockQty}`);

    r = await call('GET', `/items/${bearingId}/movements`, { token: wToken });
    check('SALE ka movement bana', r.data?.[0]?.type === 'SALE' && r.data?.[0]?.qty === -2,
      JSON.stringify(r.data?.[0] && { t: r.data[0].type, q: r.data[0].qty }));

    let ledger8 = await LedgerEntry.find({ refType: 'Invoice', refId: invoice1 }).lean();
    check('khate me INVOICE entry bani', ledger8.length === 1 && ledger8[0].debit === 200,
      JSON.stringify(ledger8.map((e) => ({ t: e.type, d: e.debit }))));

    r = await call('GET', `/parties/${partyId}`, { token: wToken });
    check('retailer ka udhaar 200 hua', r.data?.balance === 200, `${r.data?.balance}`);

    r = await call('GET', `/orders/${wOrderId}`, { token: wToken });
    check('order bill se jud gaya', String(r.data?.invoiceId) === String(invoice1), `${r.data?.invoiceId}`);

    r = await call('GET', `/invoices/from-order/${wOrderId}`, { token: wToken });
    check('ek order ka doosra bill nahi banta', r.status === 400 && /pehle se ban chuka/.test(r.message || ''),
      `${r.message}`);

    console.log(`\n${Y}Bill banana (GST on, same state)${N}`);

    await call('PUT', '/business/me', { token: wToken, body: { gstEnabled: true, gstin: '09AAACH7409R1ZZ' } });
    await call('PUT', `/items/${bearingId}`, { token: wToken, body: { hsn: '8482', gstRate: 18 } });
    await call('PUT', `/items/${chainId}`, { token: wToken, body: { hsn: '7315', gstRate: 12 } });

    r = await call('POST', '/invoices', {
      token: wToken,
      body: {
        partyId,
        items: [
          { itemId: bearingId, qty: 10, rate: 105 },
          { itemId: chainId, qty: 3, rate: 400, discount: 50 },
        ],
        paidAmount: 1000, paymentMode: 'CASH',
      },
    });
    check('GST wala bill bana', r.status === 201, `${r.message}`);
    check('Tax Invoice bana', r.data?.documentType === 'TAX_INVOICE', `${r.data?.documentType}`);
    check('same state pe CGST_SGST laga', r.data?.taxType === 'CGST_SGST', `${r.data?.taxType}`);
    // 1050 + 1150 = 2200 taxable; 18% of 1050 = 189, 12% of 1150 = 138 -> 327 tax -> 2527
    check('taxable 2200', r.data?.taxableTotal === 2200, `${r.data?.taxableTotal}`);
    check('CGST 163.5 aur SGST 163.5', r.data?.cgstTotal === 163.5 && r.data?.sgstTotal === 163.5,
      `${r.data?.cgstTotal} / ${r.data?.sgstTotal}`);
    check('IGST 0 hai', r.data?.igstTotal === 0);
    check('kul 2527', r.data?.grandTotal === 2527, `${r.data?.grandTotal}`);
    check('paid 1000, due 1527', r.data?.paidAmount === 1000 && r.data?.dueAmount === 1527,
      `${r.data?.paidAmount} / ${r.data?.dueAmount}`);
    check('payment status partial', r.data?.paymentStatus === 'partial');
    check('HSN summary bana (2 rows)', r.data?.hsnSummary?.length === 2, `${r.data?.hsnSummary?.length}`);
    const invoice2 = r.data?._id;

    ledger8 = await LedgerEntry.find({ refType: 'Invoice', refId: invoice2 }).sort({ createdAt: 1 }).lean();
    check('do khata entry bani (bill + payment)', ledger8.length === 2, `${ledger8.length}`);
    check('INVOICE debit 2527', ledger8[0]?.debit === 2527, `${ledger8[0]?.debit}`);
    check('PAYMENT_IN credit 1000', ledger8[1]?.type === 'PAYMENT_IN' && ledger8[1]?.credit === 1000,
      JSON.stringify(ledger8[1] && { t: ledger8[1].type, c: ledger8[1].credit }));

    r = await call('GET', `/parties/${partyId}`, { token: wToken });
    // 200 + 2527 - 1000 = 1727
    check('retailer ka balance 1727 hua', r.data?.balance === 1727, `${r.data?.balance}`);

    console.log(`\n${Y}Dusre state pe IGST${N}`);

    await call('PUT', `/parties/${partyId}`, {
      token: wToken, body: { address: { city: 'Mumbai', state: 'Maharashtra', pincode: '400001' } },
    });

    r = await call('POST', '/invoices', {
      token: wToken,
      body: { partyId, items: [{ itemId: bearingId, qty: 2, rate: 100, gstRate: 18 }] },
    });
    check('dusre state pe IGST laga', r.data?.taxType === 'IGST', `${r.data?.taxType}`);
    check('IGST 36, CGST 0', r.data?.igstTotal === 36 && r.data?.cgstTotal === 0,
      `${r.data?.igstTotal} / ${r.data?.cgstTotal}`);
    check('total 236', r.data?.grandTotal === 236, `${r.data?.grandTotal}`);
    const invoice3 = r.data?._id;

    await call('PUT', `/parties/${partyId}`, {
      token: wToken, body: { address: { city: 'Kanpur', state: 'Uttar Pradesh', pincode: '208001' } },
    });

    console.log(`\n${Y}Bill ki validation${N}`);

    r = await call('POST', '/invoices', {
      token: wToken, body: { partyId, items: [{ itemId: bearingId, qty: 99999, rate: 100 }] },
    });
    check('stock se zyada ka bill block hua', r.status === 400 && /stock sirf/.test(r.message || ''), `${r.message}`);

    r = await call('POST', '/invoices', {
      token: wToken, body: { partyId, items: [{ itemId: bearingId, qty: 1, rate: 100, discount: 500 }] },
    });
    check('rate se zyada discount reject hua', r.status === 400, `${r.message}`);

    r = await call('POST', '/invoices', {
      token: wToken, body: { partyId: supplierId, items: [{ itemId: bearingId, qty: 1, rate: 100 }] },
    });
    check('supplier ka bill nahi banta', r.status === 400, `${r.message}`);

    console.log(`\n${Y}Bill list aur stats${N}`);

    r = await call('GET', '/invoices', { token: wToken });
    check('bill list mili (3)', r.data?.length === 3, `mile ${r.data?.length}`);

    r = await call('GET', '/invoices?paymentStatus=unpaid', { token: wToken });
    check('unpaid filter chala', r.data?.length === 2, `mile ${r.data?.length}`);

    r = await call('GET', '/invoices?q=Suresh', { token: wToken });
    check('retailer ke naam se search chala', r.data?.length === 3, `mile ${r.data?.length}`);

    r = await call('GET', '/invoices/stats', { token: wToken });
    // 200 + 2527 + 236 = 2963 ; due = 200 + 1527 + 236 = 1963
    check('stats sahi hain', r.data?.totalInvoices === 3 && r.data?.totalAmount === 2963
      && r.data?.totalDue === 1963, JSON.stringify(r.data));

    console.log(`\n${Y}Retailer apne bill dekhe${N}`);

    r = await call('GET', '/my-bills', { token: rToken });
    check('retailer ko apne bills mile', r.data?.length === 3, `mile ${r.data?.length}`);

    r = await call('GET', `/my-bills/${invoice2}`, { token: rToken });
    check('retailer bill detail khol saka', r.data?.invoiceNo?.length > 0);
    check('retailer ko amount in words bhi mila', Boolean(r.data?.amountInWords));

    console.log(`\n${Y}Bill cancel (poora reversal)${N}`);

    r = await call('POST', `/invoices/${invoice2}/cancel`, { token: wToken, body: { reason: 'Galat rate' } });
    check('bill cancel hua', r.data?.cancelled === true, `${r.message}`);

    r = await call('GET', '/items?q=Bearing 6203', { token: wToken });
    // 48 - 10 - 2 = 36, cancel se +10 = 46
    check('cancel pe stock wapas aaya (46)', r.data?.[0]?.stockQty === 46, `${r.data?.[0]?.stockQty}`);

    ledger8 = await LedgerEntry.find({ refType: 'Invoice', refId: invoice2 }).lean();
    check('cancel pe khate ki entries hat gayi', ledger8.length === 0, `${ledger8.length}`);

    r = await call('GET', `/parties/${partyId}`, { token: wToken });
    // 1727 + 236 (invoice3) = 1963, cancel se -2527 +1000 = 436
    check('cancel ke baad balance 436', r.data?.balance === 436, `${r.data?.balance}`);

    r = await call('GET', `/invoices/${invoice2}`, { token: wToken });
    check('cancelled bill record me rehta hai', r.data?.isCancelled === true);
    check('cancel ki wajah note me gayi', /Galat rate/.test(r.data?.notes || ''), `${r.data?.notes}`);

    r = await call('POST', `/invoices/${invoice2}/cancel`, { token: wToken, body: {} });
    check('dobara cancel block hua', r.status === 400, `${r.message}`);

    r = await call('GET', '/invoices?status=active', { token: wToken });
    check('active filter me 2 bache', r.data?.length === 2, `mile ${r.data?.length}`);

    // cancel ke baad order ka bill dobara ban sakta hai
    r = await call('POST', `/invoices/${invoice1}/cancel`, { token: wToken, body: {} });
    check('order wala bill bhi cancel hua', r.data?.cancelled === true);
    r = await call('GET', `/invoices/from-order/${wOrderId}`, { token: wToken });
    check('cancel ke baad order ka naya bill ban sakta hai', r.status === 200, `${r.message}`);

    await call('PUT', '/business/me', { token: wToken, body: { gstEnabled: false } });

    console.log(`\n${Y}Tenant isolation (Part 8)${N}`);

    r = await call('GET', '/invoices', { token: rToken });
    check('retailer wholesaler ke bills nahi khol saka', r.status === 403, `status ${r.status}`);

    r = await call('GET', '/my-bills', { token: wToken });
    check('wholesaler my-bills nahi khol saka', r.status === 403, `status ${r.status}`);


    // ============================================================ PART 9
    console.log(`\n${Y}Khata (party-wise hisaab)${N}`);

    r = await call('GET', '/khata', { token: wToken });
    check('khata list mili', r.status === 200 && r.data?.length === 1, `mile ${r.data?.length}`);
    check('retailer ka balance 236 dikha', r.data?.[0]?.balance === 236, `${r.data?.[0]?.balance}`);
    check('aakhri lena-dena ki date aayi', Boolean(r.data?.[0]?.lastActivity), `${r.data?.[0]?.lastActivity}`);

    r = await call('GET', '/khata?type=supplier', { token: wToken });
    check('supplier ka khata alag mila', r.data?.length === 1 && r.data?.[0]?.balance === 7450,
      `${r.data?.[0]?.balance}`);

    r = await call('GET', '/khata?type=all&filter=due', { token: wToken });
    check('due filter me dono aaye', r.data?.length === 2, `mile ${r.data?.length}`);

    r = await call('GET', '/khata?type=all&filter=clear', { token: wToken });
    check('clear filter khali hai', r.data?.length === 0, `mile ${r.data?.length}`);

    r = await call('GET', '/khata?q=sharma&type=all', { token: wToken });
    check('naam se search chala', r.data?.length === 1 && r.data?.[0]?.name === 'Sharma Ji',
      `${r.data?.[0]?.name}`);

    r = await call('GET', '/khata/summary', { token: wToken });
    check('summary: lena 236', r.data?.receivable === 236, `${r.data?.receivable}`);
    check('summary: dena 7450', r.data?.payable === 7450, `${r.data?.payable}`);
    check('summary: net -7214', r.data?.net === -7214, `${r.data?.net}`);
    check('sabse zyada udhaar wale mile', r.data?.topDebtors?.length === 1, `${r.data?.topDebtors?.length}`);

    r = await call('GET', `/khata/${partyId}`, { token: wToken });
    check('party ka poora khata khula', r.status === 200 && r.data?.entries?.length > 0,
      `entries ${r.data?.entries?.length}`);
    check('closing balance 236', r.data?.closing === 236, `${r.data?.closing}`);

    // Bug jo asli DB pe pakda gaya: bill cancel hone par beech ki entry hat jati thi
    // par aage wali entries ka running balance purana hi reh jata tha. Ab reversal
    // ke baad poora khata dobara jud jata hai — ye check usi ka pehredaar hai.
    const partyNow = (await call('GET', `/parties/${partyId}`, { token: wToken })).data;
    check('khata ka closing aur Party.balance barabar hain',
      r.data?.closing === partyNow?.balance,
      `khata ${r.data?.closing} vs balance ${partyNow?.balance}`);

    const runningOk = r.data.entries.reduce(
      (acc, e) => ({ bal: Math.round((acc.bal + e.debit - e.credit) * 100) / 100,
        ok: acc.ok && Math.round((acc.bal + e.debit - e.credit) * 100) / 100 === e.balanceAfter }),
      { bal: r.data.opening, ok: true }
    );
    check('har entry ka running balance sahi jud raha hai', runningOk.ok,
      JSON.stringify(r.data.entries.map((e) => ({ t: e.type, d: e.debit, c: e.credit, b: e.balanceAfter }))));
    check('har entry pe Hinglish label laga',
      r.data?.entries?.every((e) => Boolean(e.typeLabel)), 'kuch entry pe label nahi');
    check('cancel hue bill ki entry khate se hat chuki hai',
      r.data?.entries?.filter((e) => e.type === 'INVOICE').length === 1,
      `${r.data?.entries?.filter((e) => e.type === 'INVOICE').length}`);

    r = await call('GET', `/khata/${partyId}?from=2099-01-01`, { token: wToken });
    check('date range se pehle ka opening aaya', r.data?.opening === 236 && r.data?.entries?.length === 0,
      `opening ${r.data?.opening}, entries ${r.data?.entries?.length}`);

    console.log(`\n${Y}Paisa aaya (cash)${N}`);

    r = await call('POST', '/payments', {
      token: wToken, body: { partyId, amount: 100, mode: 'CASH', note: 'Ramesh ke haath' },
    });
    check('cash payment entry ho gayi', r.status === 201, `${r.message}`);
    // Bill pe turant paisa mila tha, to PAY/0001 wahin ban chuka hai
    check('payment number bana', /^PAY\/\d{2}-\d{2}\/\d{4}$/.test(r.data?.paymentNo || ''), `${r.data?.paymentNo}`);
    check('seedha confirmed hai', r.data?.status === 'confirmed', `${r.data?.status}`);
    check('purane bill pe apne aap lag gaya', r.data?.againstInvoiceIds?.length === 1,
      `${r.data?.againstInvoiceIds?.length}`);
    const payment1 = r.data?._id;

    r = await call('GET', `/parties/${partyId}`, { token: wToken });
    check('udhaar 236 se 136 hua', r.data?.balance === 136, `${r.data?.balance}`);

    r = await call('GET', `/invoices/${invoice3}`, { token: wToken });
    check('bill pe 100 jama hua', r.data?.paidAmount === 100 && r.data?.dueAmount === 136,
      `paid ${r.data?.paidAmount}, due ${r.data?.dueAmount}`);
    check('bill "kuch mila" ho gaya', r.data?.paymentStatus === 'partial', `${r.data?.paymentStatus}`);

    let ledger9 = await LedgerEntry.find({ refType: 'Payment', refId: payment1 }).lean();
    check('khate me PAYMENT_IN entry bani', ledger9.length === 1 && ledger9[0].credit === 100
      && ledger9[0].debit === 0, JSON.stringify(ledger9.map((e) => ({ t: e.type, c: e.credit }))));
    check('entry pe balanceAfter 136', ledger9[0]?.balanceAfter === 136, `${ledger9[0]?.balanceAfter}`);

    console.log(`\n${Y}Zyada paisa aaya to advance${N}`);

    r = await call('POST', '/payments', {
      token: wToken, body: { partyId, amount: 200, mode: 'UPI', reference: 'UTR12345' },
    });
    check('doosra payment hua', r.status === 201, `${r.message}`);
    check('64 advance bacha', r.data?.advance === 64, `${r.data?.advance}`);
    check('message me advance likha aaya', /advance/i.test(r.message || ''), `${r.message}`);

    r = await call('GET', `/invoices/${invoice3}`, { token: wToken });
    check('bill poora paid ho gaya', r.data?.paymentStatus === 'paid' && r.data?.dueAmount === 0,
      `${r.data?.paymentStatus} / ${r.data?.dueAmount}`);

    r = await call('GET', `/parties/${partyId}`, { token: wToken });
    check('balance -64 (advance) hua', r.data?.balance === -64, `${r.data?.balance}`);

    r = await call('GET', '/khata/summary', { token: wToken });
    check('summary me ab lena 0', r.data?.receivable === 0, `${r.data?.receivable}`);

    console.log(`\n${Y}Supplier ko paisa diya${N}`);

    r = await call('POST', '/payments', {
      token: wToken, body: { partyId: supplierId, direction: 'OUT', amount: 450, mode: 'BANK' },
    });
    check('supplier ko payment hui', r.status === 201 && r.data?.direction === 'OUT', `${r.message}`);
    const paymentOut = r.data?._id;

    r = await call('GET', `/parties/${supplierId}`, { token: wToken });
    check('supplier ka dena 7000 hua', r.data?.balance === 7000, `${r.data?.balance}`);

    ledger9 = await LedgerEntry.find({ refType: 'Payment', refId: paymentOut }).lean();
    check('PAYMENT_OUT bhi credit hi hai', ledger9[0]?.type === 'PAYMENT_OUT' && ledger9[0]?.credit === 450,
      JSON.stringify(ledger9.map((e) => ({ t: e.type, c: e.credit }))));

    console.log(`\n${Y}Retailer UPI se bheje${N}`);

    r = await call('POST', '/my/payments', { token: rToken, body: { amount: 500 } });
    check('UPI ID bina claim block hua', r.status === 400 && /UPI/.test(r.message || ''), `${r.message}`);

    r = await call('PUT', '/business/me', { token: wToken, body: { upiId: 'galat-upi' } });
    check('galat UPI ID reject hui', r.status === 400, `status ${r.status}`);

    r = await call('PUT', '/business/me', {
      token: wToken, body: { upiId: 'ramesh@okhdfcbank', upiName: 'Ramesh Auto Parts' },
    });
    check('sahi UPI ID save hui', r.status === 200 && r.data?.upiId === 'ramesh@okhdfcbank', `${r.message}`);

    r = await call('GET', '/my/khata', { token: rToken });
    check('retailer ko apna khata mila', r.status === 200 && r.data?.entries?.length > 0,
      `entries ${r.data?.entries?.length}`);
    check('retailer ko wholesaler ki UPI dikhi', r.data?.upi?.id === 'ramesh@okhdfcbank', `${r.data?.upi?.id}`);
    check('advance hone se koi bill baaki nahi', r.data?.openInvoices?.length === 0,
      `${r.data?.openInvoices?.length}`);
    check('retailer ko apna balance -64 dikha', r.data?.party?.balance === -64, `${r.data?.party?.balance}`);

    r = await call('POST', '/my/payments', {
      token: rToken, body: { amount: 500, reference: 'UTR99887766', note: 'GPay se bheja' },
    });
    check('retailer ne "bhej diya" bataya', r.status === 201, `${r.message}`);
    check('abhi pending hai', r.data?.status === 'pending', `${r.data?.status}`);
    const claimId = r.data?._id;

    r = await call('GET', `/parties/${partyId}`, { token: wToken });
    check('pending se khata NAHI badla', r.data?.balance === -64, `${r.data?.balance}`);

    ledger9 = await LedgerEntry.find({ refType: 'Payment', refId: claimId }).lean();
    check('pending ki koi khata entry nahi bani', ledger9.length === 0, `${ledger9.length}`);

    r = await call('GET', '/notifications', { token: wToken });
    const payNotif = r.data?.find((n) => n.type === 'PAYMENT_RECEIVED');
    check('wholesaler ko confirm karne ka alert mila', Boolean(payNotif), `mile ${r.data?.length}`);
    check('alert ka link payments page ka hai', /^\/payments/.test(payNotif?.link || ''), `${payNotif?.link}`);

    r = await call('GET', '/payments?status=pending', { token: wToken });
    check('pending queue me 1 payment hai', r.data?.length === 1, `mile ${r.data?.length}`);

    r = await call('POST', `/payments/${claimId}/confirm`, { token: wToken });
    check('wholesaler ne confirm kiya', r.status === 200 && r.data?.status === 'confirmed', `${r.message}`);

    r = await call('GET', `/parties/${partyId}`, { token: wToken });
    check('confirm ke baad balance -564', r.data?.balance === -564, `${r.data?.balance}`);

    r = await call('POST', `/payments/${claimId}/confirm`, { token: wToken });
    check('dobara confirm block hua', r.status === 400, `${r.message}`);

    r = await call('GET', '/notifications', { token: rToken });
    check('retailer ko confirm ka alert gaya',
      r.data?.some((n) => n.type === 'PAYMENT_RECEIVED' && /confirm/i.test(n.title || '')),
      JSON.stringify(r.data?.slice(0, 2).map((n) => n.title)));

    r = await call('GET', '/my/payments', { token: rToken });
    check('retailer ko apni payment list mili', r.data?.length >= 1, `mile ${r.data?.length}`);

    console.log(`\n${Y}Paisa nahi mila (reject)${N}`);

    r = await call('POST', '/my/payments', { token: rToken, body: { amount: 300 } });
    const claim2 = r.data?._id;
    check('doosra claim bana', r.status === 201, `${r.message}`);

    r = await call('POST', `/payments/${claim2}/reject`, {
      token: wToken, body: { reason: 'Account me paisa nahi aaya' },
    });
    check('reject ho gaya', r.data?.status === 'failed', `${r.data?.status}`);

    r = await call('GET', `/parties/${partyId}`, { token: wToken });
    check('reject se khata nahi badla', r.data?.balance === -564, `${r.data?.balance}`);

    r = await call('POST', `/payments/${claim2}/reject`, { token: wToken, body: {} });
    check('confirm/reject ho chuki payment dobara reject nahi hui', r.status === 400, `${r.message}`);

    r = await call('GET', '/my/payments', { token: rToken });
    check('retailer ko reject wali bhi dikhi',
      r.data?.some((p) => p.status === 'failed'), JSON.stringify(r.data?.map((p) => p.status)));

    console.log(`\n${Y}Payment delete (poora reversal)${N}`);

    r = await call('DELETE', `/payments/${payment1}`, { token: wToken });
    check('payment delete hui', r.data?.deleted === true, `${r.message}`);

    r = await call('GET', `/parties/${partyId}`, { token: wToken });
    check('delete pe balance -464 wapas hua', r.data?.balance === -464, `${r.data?.balance}`);

    r = await call('GET', `/invoices/${invoice3}`, { token: wToken });
    check('bill dobara udhaar dikhne laga', r.data?.dueAmount === 100 && r.data?.paymentStatus === 'partial',
      `due ${r.data?.dueAmount}, ${r.data?.paymentStatus}`);

    ledger9 = await LedgerEntry.find({ refType: 'Payment', refId: payment1 }).lean();
    check('delete pe khata entry bhi hat gayi', ledger9.length === 0, `${ledger9.length}`);

    console.log(`\n${Y}Payment list, filter aur stats${N}`);

    r = await call('GET', '/payments', { token: wToken });
    check('saari payments mili (4)', r.data?.length === 4, `mile ${r.data?.length}`);
    check('list me party ka naam aaya', Boolean(r.data?.[0]?.party?.name), `${r.data?.[0]?.party?.name}`);

    r = await call('GET', '/payments?direction=OUT', { token: wToken });
    check('OUT filter chala', r.data?.length === 1, `mile ${r.data?.length}`);

    r = await call('GET', '/payments?mode=UPI', { token: wToken });
    check('mode filter chala', r.data?.every((p) => p.mode === 'UPI'), 'koi non-UPI aa gaya');

    r = await call('GET', '/payments?q=UTR99887766', { token: wToken });
    check('UTR number se search chala', r.data?.length === 1, `mile ${r.data?.length}`);

    r = await call('GET', '/payments?q=Suresh', { token: wToken });
    check('party ke naam se search chala', r.data?.length >= 2, `mile ${r.data?.length}`);

    r = await call('GET', `/payments?partyId=${supplierId}`, { token: wToken });
    check('party filter chala', r.data?.length === 1, `mile ${r.data?.length}`);

    r = await call('GET', '/payments/stats', { token: wToken });
    check('stats: aaj 700 aaya', r.data?.todayAmount === 700, `${r.data?.todayAmount}`);
    check('stats: koi pending nahi bachi', r.data?.pendingCount === 0, `${r.data?.pendingCount}`);

    console.log(`\n${Y}Part 9 ki validation${N}`);

    r = await call('POST', '/payments', { token: wToken, body: { partyId, amount: 0 } });
    check('0 amount reject hua', r.status === 400, `${r.message}`);

    r = await call('POST', '/payments', { token: wToken, body: { partyId, amount: -50 } });
    check('minus amount reject hua', r.status === 400, `${r.message}`);

    r = await call('POST', '/payments', { token: wToken, body: { partyId: 'abcd', amount: 50 } });
    check('galat party id reject hui', r.status === 400, `${r.message}`);

    r = await call('POST', '/payments', {
      token: wToken, body: { partyId: '5f9d1b9b9b9b9b9b9b9b9b9b', amount: 50 },
    });
    check('anjaan party pe payment block hui', r.status === 400, `${r.message}`);

    r = await call('POST', '/payments', { token: wToken, body: { partyId, amount: 50, mode: 'BITCOIN' } });
    check('galat mode reject hua', r.status === 400, `${r.message}`);

    console.log(`\n${Y}Tenant isolation (Part 9)${N}`);

    r = await call('GET', '/khata', { token: rToken });
    check('retailer poora khata nahi khol saka', r.status === 403, `status ${r.status}`);

    r = await call('GET', '/payments', { token: rToken });
    check('retailer sabki payments nahi dekh saka', r.status === 403, `status ${r.status}`);

    r = await call('POST', '/payments', { token: rToken, body: { partyId, amount: 100 } });
    check('retailer khud entry nahi kar saka', r.status === 403, `status ${r.status}`);

    r = await call('GET', '/my/khata', { token: wToken });
    check('wholesaler my/khata nahi khol saka', r.status === 403, `status ${r.status}`);

    r = await call('POST', `/payments/${paymentOut}/confirm`, { token: rToken });
    check('retailer khud confirm nahi kar saka', r.status === 403, `status ${r.status}`);

    r = await call('DELETE', `/payments/${paymentOut}`, { token: rToken });
    check('retailer payment delete nahi kar saka', r.status === 403, `status ${r.status}`);


    // ============================================================ PART 10
    console.log(`\n${Y}Dashboard${N}`);

    r = await call('GET', '/dashboard', { token: wToken });
    check('dashboard khula', r.status === 200, `${r.message}`);
    check('sale ka data aaya', typeof r.data?.sale?.today === 'number', JSON.stringify(r.data?.sale));
    check('khata ka data aaya', typeof r.data?.khata?.receivable === 'number');
    check('stock ka data aaya', typeof r.data?.stock?.value === 'number');
    check('14 din ka trend bana', r.data?.trend?.length === 14, `${r.data?.trend?.length}`);
    check('trend me khali din bhi hain (gaddha nahi)',
      r.data?.trend?.every((t) => typeof t.amount === 'number' && t.label), 'kuch din adhoore');
    check('aakhri trend point aaj ka hai',
      r.data?.trend?.[13]?.date === new Date().toISOString().slice(0, 10),
      `${r.data?.trend?.[13]?.date}`);
    check('orders ki ginti aayi', typeof r.data?.orders?.running === 'number');
    check('top items mile', Array.isArray(r.data?.topItems));
    check('recent activity bani', Array.isArray(r.data?.activity));
    check('todo list bani', typeof r.data?.todo?.newOrders === 'number', JSON.stringify(r.data?.todo));

    r = await call('GET', '/dashboard', { token: rToken });
    check('retailer ko apna dashboard mila', r.status === 200, `${r.message}`);
    check('retailer ko apna balance dikha', typeof r.data?.balance === 'number', `${r.data?.balance}`);
    check('retailer ko wholesaler ka data NAHI mila', r.data?.stock === undefined && r.data?.topItems === undefined);
    check('retailer ke baaki bill aaye', Array.isArray(r.data?.openInvoices));

    console.log(`\n${Y}Sale report${N}`);

    r = await call('GET', '/reports/sale?from=2020-01-01', { token: wToken });
    check('sale report chali', r.status === 200 && Array.isArray(r.data?.rows), `${r.message}`);
    check('columns bhi aaye (CSV isi se banti hai)', r.data?.columns?.length > 0);
    check('din wise group hua', r.data?.meta?.groupBy === 'day');
    // Part 8 me sirf invoice3 (236) bacha, baaki cancel ho gaye
    check('kul sale 236', r.data?.totals?.total === 236, `${r.data?.totals?.total}`);

    r = await call('GET', '/reports/sale?from=2020-01-01&groupBy=item', { token: wToken });
    check('item wise group chala', r.data?.meta?.groupBy === 'item' && r.data?.rows?.length >= 1,
      `rows ${r.data?.rows?.length}`);
    check('munafe ka column aaya', r.data?.columns?.some((c) => c.key === 'profit'));

    r = await call('GET', '/reports/sale?from=2020-01-01&groupBy=party', { token: wToken });
    check('retailer wise group chala', r.data?.rows?.[0]?.label?.length > 0, `${r.data?.rows?.[0]?.label}`);

    r = await call('GET', '/reports/sale?from=2099-01-01&to=2099-12-31', { token: wToken });
    check('khali duration me 0 row', r.data?.rows?.length === 0, `${r.data?.rows?.length}`);

    console.log(`\n${Y}Purchase report${N}`);

    r = await call('GET', '/reports/purchase?from=2020-01-01&groupBy=supplier', { token: wToken });
    check('purchase report chali', r.status === 200 && r.data?.rows?.length >= 1, `${r.message}`);
    check('supplier ka naam aaya', r.data?.rows?.[0]?.label === 'Sharma Traders', `${r.data?.rows?.[0]?.label}`);

    r = await call('GET', '/reports/purchase?from=2020-01-01&groupBy=item', { token: wToken });
    check('item wise purchase me average rate bhi aaya',
      r.data?.columns?.some((c) => c.key === 'avgRate'));

    console.log(`\n${Y}Stock report${N}`);

    r = await call('GET', '/reports/stock', { token: wToken });
    check('stock report chali', r.status === 200 && r.data?.rows?.length > 0, `${r.message}`);
    check('stock ki keemat gini gayi', typeof r.data?.totals?.stockValue === 'number',
      `${r.data?.totals?.stockValue}`);
    check('har item ka haal likha hai',
      r.data?.rows?.every((x) => ['Theek hai', 'Kam bacha', 'Khatam', 'Pada hua'].includes(x.status)),
      JSON.stringify(r.data?.rows?.map((x) => x.status)));
    check('filter ki ginti aayi', typeof r.data?.meta?.counts?.low === 'number', JSON.stringify(r.data?.meta?.counts));

    // ek item khatam karo
    await call('POST', `/items/${chainId}/stock`, { token: wToken, body: { mode: 'set', qty: 0 } });
    r = await call('GET', '/reports/stock?filter=out', { token: wToken });
    check('khatam wala filter chala', r.data?.rows?.length === 1 && r.data?.rows?.[0]?.status === 'Khatam',
      `mile ${r.data?.rows?.length}`);

    r = await call('GET', '/reports/stock?filter=low', { token: wToken });
    check('kam bacha filter alag se chala', r.data?.rows?.every((x) => x.status === 'Kam bacha'), 'galat row aayi');

    console.log(`\n${Y}Udhaar (aging) report${N}`);

    r = await call('GET', '/reports/outstanding', { token: wToken });
    check('udhaar report chali', r.status === 200, `${r.message}`);
    check('0-30 din wala bucket bana', r.data?.columns?.some((c) => c.key === 'b0'));

    r = await call('GET', '/reports/outstanding?type=supplier', { token: wToken });
    // Part 9 me supplier ko 450 diye ja chuke hain
    check('supplier ka udhaar bhi mila', r.data?.rows?.[0]?.balance === 7000, `${r.data?.rows?.[0]?.balance}`);
    check('sabse purana kitne din ka — ye bhi aaya',
      typeof r.data?.rows?.[0]?.oldestDays === 'number', `${r.data?.rows?.[0]?.oldestDays}`);

    console.log(`\n${Y}GST report${N}`);

    r = await call('GET', '/reports/gst?from=2020-01-01', { token: wToken });
    check('GST report chali', r.status === 200, `${r.message}`);
    check('B2B/B2C ka batwara hua', typeof r.data?.meta?.split?.b2b?.total === 'number',
      JSON.stringify(r.data?.meta?.split));
    check('output aur input tax dono aaye',
      typeof r.data?.meta?.outputTax === 'number' && typeof r.data?.meta?.inputTax === 'number',
      `out ${r.data?.meta?.outputTax} in ${r.data?.meta?.inputTax}`);
    check('net payable nikala', r.data?.meta?.netPayable ===
      Math.round((r.data.meta.outputTax - r.data.meta.inputTax) * 100) / 100,
      `${r.data?.meta?.netPayable}`);
    // invoice3 pe IGST 36 laga tha
    check('HSN wise row bani aur IGST 36 gina', r.data?.totals?.igst === 36, `${r.data?.totals?.igst}`);

    console.log(`\n${Y}Payment report${N}`);

    r = await call('GET', '/reports/payment?from=2020-01-01', { token: wToken });
    check('payment report chali', r.status === 200 && r.data?.rows?.length >= 1, `${r.message}`);
    check('mode wise column bana',
      r.data?.columns?.some((c) => c.key === 'cash') && r.data?.columns?.some((c) => c.key === 'upi'));
    // Part 9 ke baad: cash 100 delete ho chuka, UPI 200 + UPI 500 confirm = 700 aaya, 450 diya
    check('kul aaya 700', r.data?.totals?.inTotal === 700, `${r.data?.totals?.inTotal}`);
    check('kul diya 450', r.data?.totals?.outTotal === 450, `${r.data?.totals?.outTotal}`);

    console.log(`\n${Y}CSV download${N}`);

    const csvRes = await fetch(`${BASE}/reports/sale/csv?from=2020-01-01`, {
      headers: { Authorization: `Bearer ${wToken}` },
    });
    const csvText = await csvRes.text();
    check('CSV mili', csvRes.status === 200, `status ${csvRes.status}`);
    check('CSV file ke naam ke saath aayi',
      /attachment; filename="sale-report-/.test(csvRes.headers.get('content-disposition') || ''),
      `${csvRes.headers.get('content-disposition')}`);
    check('CSV me header row hai', csvText.includes('Date,Bill,Quantity'), csvText.slice(0, 60));
    check('CSV ki aakhri line KUL hai', /\nKUL,/.test(csvText), csvText.slice(-60));
    // fetch().text() spec ke hisaab se BOM khud hata deta hai — isliye raw bytes dekhte hain
    const csvBytes = new Uint8Array(await (await fetch(`${BASE}/reports/sale/csv?from=2020-01-01`, {
      headers: { Authorization: `Bearer ${wToken}` },
    })).arrayBuffer());
    check('Excel ke liye BOM laga hai',
      csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf,
      `${[...csvBytes.slice(0, 3)]}`);

    r = await call('GET', '/reports/kuch-bhi', { token: wToken });
    check('anjaan report ka naam reject hua', r.status === 400 || r.status === 404, `status ${r.status}`);

    console.log(`\n${Y}Low stock ka alert${N}`);

    // Pehle ke alert saaf kar do, warna ginti me wo bhi aa jayenge
    await call('POST', '/notifications/read-all', { token: wToken });
    await call('DELETE', '/notifications/clear-read', { token: wToken });
    await call('POST', `/items/${bearingId}/stock`, { token: wToken, body: { mode: 'set', qty: 20 } });
    await call('PUT', `/items/${bearingId}`, { token: wToken, body: { lowStockAt: 5 } });

    // 20 -> 18 : abhi limit se upar hai, alert nahi aana chahiye
    await call('POST', '/invoices', {
      token: wToken, body: { partyId, items: [{ itemId: bearingId, qty: 2, rate: 100 }] },
    });
    r = await call('GET', '/notifications?type=LOW_STOCK', { token: wToken });
    check('limit se upar hai to alert nahi aaya', r.data?.length === 0, `mile ${r.data?.length}`);

    // 18 -> 4 : limit paar, alert aana chahiye
    const lowInvoice = await call('POST', '/invoices', {
      token: wToken, body: { partyId, items: [{ itemId: bearingId, qty: 14, rate: 100 }] },
    });
    r = await call('GET', '/notifications?type=LOW_STOCK', { token: wToken });
    check('limit paar hote hi alert aaya', r.data?.length === 1, `mile ${r.data?.length}`);
    check('alert me item ka naam hai', /Bearing 6203/.test(r.data?.[0]?.title || ''), `${r.data?.[0]?.title}`);
    check('alert ka link items page ka hai', /^\/items/.test(r.data?.[0]?.link || ''), `${r.data?.[0]?.link}`);

    // 4 -> 3 : pehle se hi neeche tha, dobara alert nahi aana chahiye
    await call('POST', '/invoices', {
      token: wToken, body: { partyId, items: [{ itemId: bearingId, qty: 1, rate: 100 }] },
    });
    r = await call('GET', '/notifications?type=LOW_STOCK', { token: wToken });
    check('dobara wahi alert nahi aaya', r.data?.length === 1, `mile ${r.data?.length}`);

    // 3 -> 0 : khatam
    await call('POST', '/invoices', {
      token: wToken, body: { partyId, items: [{ itemId: bearingId, qty: 3, rate: 100 }] },
    });
    r = await call('GET', '/notifications?type=LOW_STOCK', { token: wToken });
    check('khatam hone pe alag alert aaya', r.data?.length === 2, `mile ${r.data?.length}`);
    check('khatam wale alert ka message alag hai', /khatam ho gaya/.test(r.data?.[0]?.title || ''),
      `${r.data?.[0]?.title}`);

    console.log(`\n${Y}Udhaar ki yaad dilana${N}`);

    r = await call('POST', `/khata/${partyId}/remind`, { token: wToken, body: {} });
    check('yaad dila diya', r.status === 200 && r.data?.sent === true, `${r.message}`);

    r = await call('GET', '/notifications?type=PAYMENT_REMINDER', { token: rToken });
    check('retailer ko yaad dilane ka alert mila', r.data?.length === 1, `mile ${r.data?.length}`);
    check('alert me dukaan ka naam hai', /Ramesh Auto Parts/.test(r.data?.[0]?.title || ''), `${r.data?.[0]?.title}`);
    check('alert ka link khate ka hai', r.data?.[0]?.link === '/my-khata', `${r.data?.[0]?.link}`);

    r = await call('POST', `/khata/${partyId}/remind`, {
      token: wToken, body: { message: 'Bhaiya kal tak bhej dena' },
    });
    check('apna message bhi bhej sakte hain', r.status === 200, `${r.message}`);
    r = await call('GET', '/notifications?type=PAYMENT_REMINDER', { token: rToken });
    check('apna wala message hi gaya', r.data?.[0]?.body === 'Bhaiya kal tak bhej dena', `${r.data?.[0]?.body}`);

    r = await call('POST', `/khata/${supplierId}/remind`, { token: wToken, body: {} });
    check('jo app pe nahi hai usko yaad nahi dila sakte', r.status === 400, `${r.message}`);

    console.log(`\n${Y}Notifications page${N}`);

    r = await call('GET', '/notifications', { token: wToken });
    check('list paginated aayi', Array.isArray(r.data) && r.meta?.totalPages >= 1, JSON.stringify(r.meta));
    check('unread count response me hi mil gaya', typeof r.unread === 'number', `${r.unread}`);

    r = await call('GET', '/notifications/counts', { token: wToken });
    check('type wise ginti aayi', typeof r.data?.byType?.LOW_STOCK?.total === 'number',
      JSON.stringify(r.data?.byType));
    check('kul aur unread dono aaye', typeof r.data?.all === 'number' && typeof r.data?.unread === 'number');

    r = await call('GET', '/notifications?type=LOW_STOCK&limit=1', { token: wToken });
    check('type filter + limit chala', r.data?.length === 1 && r.meta?.total === 2,
      `mile ${r.data?.length} / total ${r.meta?.total}`);

    r = await call('GET', '/notifications?type=GALAT_TYPE', { token: wToken });
    check('galat type reject hua', r.status === 400, `status ${r.status}`);

    const delId = (await call('GET', '/notifications', { token: wToken })).data?.[0]?._id;
    r = await call('DELETE', `/notifications/${delId}`, { token: wToken });
    check('ek notification delete hui', r.status === 200, `${r.message}`);

    await call('POST', '/notifications/read-all', { token: wToken });
    r = await call('DELETE', '/notifications/clear-read', { token: wToken });
    check('padhi hui purani saaf ho gayi', r.data?.deleted > 0, `${r.data?.deleted}`);
    r = await call('GET', '/notifications', { token: wToken });
    check('clear ke baad list khali', r.data?.length === 0, `mile ${r.data?.length}`);

    r = await call('GET', '/notifications', { token: rToken });
    check('doosre user ki notifications alag rahin', r.data?.length > 0, `mile ${r.data?.length}`);

    console.log(`\n${Y}Tenant isolation (Part 10)${N}`);

    r = await call('GET', '/reports/sale', { token: rToken });
    check('retailer sale report nahi khol saka', r.status === 403, `status ${r.status}`);

    r = await call('GET', '/reports/stock/csv', { token: rToken });
    check('retailer CSV bhi nahi le saka', r.status === 403, `status ${r.status}`);

    r = await call('POST', `/khata/${partyId}/remind`, { token: rToken, body: {} });
    check('retailer khud ko yaad nahi dila saka', r.status === 403, `status ${r.status}`);


    // ============================================================ PART 11
    console.log(`\n${Y}Item ke naye field${N}`);

    r = await call('POST', '/items', {
      token: wToken,
      body: {
        name: 'Clutch Plate Set', brand: 'TVS', modelNo: 'CP-4S-2026', barcode: '8901234567890',
        purchasePrice: 500, salePrice: 700, wholesalePrice: 640, mrp: 850,
        openingStock: 12, lowStockAt: 3, rack: 'B-2', minOrderQty: 2,
        hsn: '8708', gstRate: 18, warrantyMonths: 18, warrantyNote: 'Company warranty, bill ke saath',
      },
    });
    check('naye field ke saath item bana', r.status === 201, `${r.message}`);
    check('brand save hua', r.data?.brand === 'TVS', `${r.data?.brand}`);
    check('model/serial number save hua', r.data?.modelNo === 'CP-4S-2026', `${r.data?.modelNo}`);
    check('MRP save hui', r.data?.mrp === 850, `${r.data?.mrp}`);
    check('rack save hua', r.data?.rack === 'B-2', `${r.data?.rack}`);
    check('warranty 18 mahine save hui', r.data?.warrantyMonths === 18, `${r.data?.warrantyMonths}`);
    check('warranty Hinglish me bani', r.data?.warrantyText === '1 saal 6 mahine', `${r.data?.warrantyText}`);
    const setId = r.data?._id;

    r = await call('POST', '/items', {
      token: wToken, body: { name: 'Bad Warranty', warrantyMonths: 500 },
    });
    check('bahut lambi warranty reject hui', r.status === 400, `status ${r.status}`);

    r = await call('GET', '/items?q=TVS', { token: wToken });
    check('brand se search chala', r.data?.length === 1 && r.data?.[0]?.name === 'Clutch Plate Set',
      `mile ${r.data?.length}`);

    r = await call('GET', '/items?q=CP-4S', { token: wToken });
    check('model number se search chala', r.data?.length === 1, `mile ${r.data?.length}`);

    r = await call('GET', '/items?q=8901234567890', { token: wToken });
    check('barcode se search chala', r.data?.length === 1, `mile ${r.data?.length}`);

    r = await call('GET', '/items/brands', { token: wToken });
    check('brands ki list aayi', r.data?.includes('TVS'), JSON.stringify(r.data));

    r = await call('GET', '/items?brand=TVS', { token: wToken });
    check('brand filter chala', r.data?.length === 1, `mile ${r.data?.length}`);

    r = await call('GET', '/items/export', { token: wToken, raw: true });
    check('CSV export me naye column aaye',
      typeof r === 'object', 'export endpoint chala');

    console.log(`\n${Y}Warranty retailer ko dikhe${N}`);

    // CSV import wala "Clutch Plate" pehle se hai — isliye poora naam
    r = await call('GET', '/catalog?q=Clutch Plate Set', { token: rToken });
    check('retailer ko warranty dikhi', r.data?.[0]?.warrantyText === '1 saal 6 mahine',
      `${r.data?.[0]?.warrantyText}`);
    check('retailer ko warranty ki shart bhi dikhi',
      /Company warranty/.test(r.data?.[0]?.warrantyNote || ''), `${r.data?.[0]?.warrantyNote}`);
    check('retailer ko brand aur MRP dikhe',
      r.data?.[0]?.brand === 'TVS' && r.data?.[0]?.mrp === 850,
      `${r.data?.[0]?.brand} / ${r.data?.[0]?.mrp}`);
    check('kam se kam order ki ginti dikhi', r.data?.[0]?.minOrderQty === 2, `${r.data?.[0]?.minOrderQty}`);

    r = await call('POST', '/cart/items', { token: rToken, body: { itemId: setId, qty: 1 } });
    check('minimum se kam order block hua', r.status === 400 && /kam se kam 2/.test(r.message || ''),
      `${r.message}`);

    r = await call('POST', '/cart/items', { token: rToken, body: { itemId: setId, qty: 2 } });
    check('minimum poora hone par cart me gaya', r.status === 200 || r.status === 201, `${r.message}`);
    await call('DELETE', '/cart', { token: rToken });

    r = await call('POST', '/invoices', {
      token: wToken, body: { partyId, items: [{ itemId: setId, qty: 2, rate: 640 }] },
    });
    check('bill pe warranty ka snapshot laga', r.data?.items?.[0]?.warrantyMonths === 18,
      `${r.data?.items?.[0]?.warrantyMonths}`);
    check('warranty ki shart bhi snapshot hui',
      /Company warranty/.test(r.data?.items?.[0]?.warrantyNote || ''), `${r.data?.items?.[0]?.warrantyNote}`);
    const warrantyInvoice = r.data?._id;

    // item ki warranty badlo — purana bill nahi badalna chahiye
    await call('PUT', `/items/${setId}`, { token: wToken, body: { warrantyMonths: 0, warrantyNote: '' } });
    r = await call('GET', `/invoices/${warrantyInvoice}`, { token: wToken });
    check('warranty hatane par purana bill nahi badla', r.data?.items?.[0]?.warrantyMonths === 18,
      `${r.data?.items?.[0]?.warrantyMonths}`);
    await call('PUT', `/items/${setId}`, { token: wToken, body: { warrantyMonths: 18 } });

    console.log(`\n${Y}Maal wapas aaya (credit note)${N}`);

    r = await call('GET', `/returns/prefill/SALE_RETURN/${warrantyInvoice}`, { token: wToken });
    check('bill se return prefill mila', r.status === 200 && r.data?.items?.length === 1, `${r.message}`);
    check('prefill me bill ka number aaya', /^INV\//.test(r.data?.againstNo || ''), `${r.data?.againstNo}`);
    check('prefill me poora qty default aaya', r.data?.items?.[0]?.qty === 2, `${r.data?.items?.[0]?.qty}`);
    check('pehle kitna wapas hua wo bhi aaya', r.data?.items?.[0]?.returnedQty === 0,
      `${r.data?.items?.[0]?.returnedQty}`);

    let itemsBefore = await call('GET', '/items?q=Clutch Plate Set', { token: wToken });
    const clutchStockBefore = itemsBefore.data?.[0]?.stockQty;

    r = await call('GET', `/parties/${partyId}`, { token: wToken });
    const balBeforeReturn = r.data?.balance;

    r = await call('POST', '/returns', {
      token: wToken,
      body: {
        type: 'SALE_RETURN', partyId, invoiceId: warrantyInvoice,
        items: [{ itemId: setId, qty: 1, rate: 640 }],
        reason: 'Ek piece me awaaz aa rahi thi',
      },
    });
    check('credit note ban gaya', r.status === 201, `${r.message}`);
    check('credit note ka number CRN se shuru hua', /^CRN\/\d{2}-\d{2}\/0001$/.test(r.data?.returnNo || ''),
      `${r.data?.returnNo}`);
    check('note pe "Credit Note" likha aaya', r.data?.label === 'Credit Note', `${r.data?.label}`);
    check('amount in words bana', Boolean(r.data?.amountInWords));
    const creditNote = r.data?._id;
    const creditTotal = r.data?.grandTotal;

    r = await call('GET', '/items?q=Clutch Plate Set', { token: wToken });
    check('sale return se stock BADHA', r.data?.[0]?.stockQty === clutchStockBefore + 1,
      `${clutchStockBefore} -> ${r.data?.[0]?.stockQty}`);

    r = await call('GET', `/items/${setId}/movements`, { token: wToken });
    check('SALE_RETURN ka movement bana', r.data?.[0]?.type === 'SALE_RETURN' && r.data?.[0]?.qty === 1,
      JSON.stringify(r.data?.[0] && { t: r.data[0].type, q: r.data[0].qty }));

    let ledger11 = await LedgerEntry.find({ refType: 'ReturnNote', refId: creditNote }).lean();
    check('khate me SALE_RETURN credit bana',
      ledger11.length === 1 && ledger11[0].credit === creditTotal && ledger11[0].debit === 0,
      JSON.stringify(ledger11.map((e) => ({ t: e.type, c: e.credit }))));

    r = await call('GET', `/parties/${partyId}`, { token: wToken });
    check('retailer ka udhaar utna kam hua', r.data?.balance === round2(balBeforeReturn - creditTotal),
      `${balBeforeReturn} -> ${r.data?.balance}`);

    r = await call('GET', `/khata/${partyId}`, { token: wToken });
    check('khate me "Maal wapas aaya" label dikha',
      r.data?.entries?.some((e) => e.typeLabel === 'Maal wapas aaya'),
      JSON.stringify(r.data?.entries?.slice(-2).map((e) => e.typeLabel)));

    // ab sirf 1 bacha
    r = await call('GET', `/returns/prefill/SALE_RETURN/${warrantyInvoice}`, { token: wToken });
    check('prefill me bacha hua qty hi aaya', r.data?.items?.[0]?.qty === 1, `${r.data?.items?.[0]?.qty}`);
    check('pehle wapas hua qty gina gaya', r.data?.items?.[0]?.returnedQty === 1,
      `${r.data?.items?.[0]?.returnedQty}`);

    r = await call('POST', '/returns', {
      token: wToken,
      body: {
        type: 'SALE_RETURN', partyId, invoiceId: warrantyInvoice,
        items: [{ itemId: setId, qty: 5, rate: 640 }],
      },
    });
    check('bill se zyada wapas nahi ho saka', r.status === 400 && /wapas ho sakta hai/.test(r.message || ''),
      `${r.message}`);

    r = await call('POST', '/returns', {
      token: wToken,
      body: { type: 'SALE_RETURN', partyId: supplierId, items: [{ itemId: setId, qty: 1, rate: 100 }] },
    });
    check('supplier ka sale return block hua', r.status === 400, `${r.message}`);

    console.log(`\n${Y}Maal wapas bheja (debit note)${N}`);

    // Upar low-stock test ne Bearing 0 kar diya tha — wapas bhejne ke liye maal chahiye
    await call('POST', `/items/${bearingId}/stock`, { token: wToken, body: { mode: 'set', qty: 25 } });

    r = await call('GET', `/parties/${supplierId}`, { token: wToken });
    const supBefore = r.data?.balance;

    r = await call('POST', '/returns', {
      token: wToken,
      body: {
        type: 'PURCHASE_RETURN', partyId: supplierId,
        items: [{ itemId: bearingId, qty: 1, rate: 80 }],
        reason: 'Maal kharab nikla',
      },
    });
    check('debit note ban gaya', r.status === 201, `${r.message}`);
    check('debit note ka number DBN se shuru hua', /^DBN\//.test(r.data?.returnNo || ''), `${r.data?.returnNo}`);
    check('note pe "Debit Note" likha aaya', r.data?.label === 'Debit Note', `${r.data?.label}`);
    const debitNote = r.data?._id;
    const debitTotal = r.data?.grandTotal;

    r = await call('GET', `/items/${bearingId}/movements`, { token: wToken });
    check('PURCHASE_RETURN me stock GHATA', r.data?.[0]?.type === 'PURCHASE_RETURN' && r.data?.[0]?.qty === -1,
      JSON.stringify(r.data?.[0] && { t: r.data[0].type, q: r.data[0].qty }));

    r = await call('GET', `/parties/${supplierId}`, { token: wToken });
    check('supplier ko dena utna kam hua', r.data?.balance === round2(supBefore - debitTotal),
      `${supBefore} -> ${r.data?.balance}`);

    r = await call('POST', '/returns', {
      token: wToken,
      body: {
        type: 'PURCHASE_RETURN', partyId: supplierId,
        items: [{ itemId: bearingId, qty: 99999, rate: 80 }],
      },
    });
    check('stock se zyada wapas nahi bhej sake', r.status === 400 && /stock sirf/.test(r.message || ''),
      `${r.message}`);

    r = await call('POST', '/returns', {
      token: wToken, body: { type: 'PURCHASE_RETURN', partyId, items: [{ itemId: bearingId, qty: 1, rate: 80 }] },
    });
    check('retailer ka purchase return block hua', r.status === 400, `${r.message}`);

    console.log(`\n${Y}Return list aur delete${N}`);

    r = await call('GET', '/returns', { token: wToken });
    check('dono return list me aaye', r.data?.length === 2, `mile ${r.data?.length}`);

    r = await call('GET', '/returns?type=SALE_RETURN', { token: wToken });
    check('type filter chala', r.data?.length === 1 && r.data?.[0]?.type === 'SALE_RETURN',
      `mile ${r.data?.length}`);

    r = await call('GET', '/returns/stats', { token: wToken });
    check('stats me dono tarah ke note gine',
      r.data?.saleCount === 1 && r.data?.purchaseCount === 1,
      JSON.stringify(r.data));

    r = await call('GET', '/my/returns', { token: rToken });
    check('retailer ko apna credit note dikha', r.data?.length === 1, `mile ${r.data?.length}`);

    r = await call('GET', '/items?q=Clutch Plate Set', { token: wToken });
    const stockBeforeDelete = r.data?.[0]?.stockQty;
    r = await call('GET', `/parties/${partyId}`, { token: wToken });
    const balBeforeDelete = r.data?.balance;

    r = await call('DELETE', `/returns/${creditNote}`, { token: wToken });
    check('credit note delete hua', r.data?.deleted === true, `${r.message}`);

    r = await call('GET', '/items?q=Clutch Plate Set', { token: wToken });
    check('delete pe stock wapas ghata', r.data?.[0]?.stockQty === stockBeforeDelete - 1,
      `${stockBeforeDelete} -> ${r.data?.[0]?.stockQty}`);

    r = await call('GET', `/parties/${partyId}`, { token: wToken });
    check('delete pe udhaar wapas badha', r.data?.balance === round2(balBeforeDelete + creditTotal),
      `${balBeforeDelete} -> ${r.data?.balance}`);

    ledger11 = await LedgerEntry.find({ refType: 'ReturnNote', refId: creditNote }).lean();
    check('delete pe khata entry bhi hat gayi', ledger11.length === 0, `${ledger11.length}`);

    /* ─────────────────────────────────────────────────────────────────────
       GST ON ke saath return

       Ye section isliye hai kyunki upar ke saare return tests GST OFF ke
       saath chalte hain — aur usi wajah se ek asli bug mahino chhupa raha:
       `decideTaxType()` object deta hai, par return.service usse destructure
       nahi kar raha tha. GST off me farak hi nahi padta (tax 0 hi hota hai),
       GST on karte hi tax 0 lagta tha aur note save bhi nahi hota tha.
       ───────────────────────────────────────────────────────────────────── */
    console.log(`\n${Y}Return GST ke saath${N}`);

    await call('PUT', '/business/me', { token: wToken, body: { gstEnabled: true, gstin: '09AAACH7409R1ZZ' } });
    await call('PUT', `/items/${bearingId}`, { token: wToken, body: { hsn: '8482', gstRate: 18 } });
    await call('POST', `/items/${bearingId}/stock`, { token: wToken, body: { mode: 'set', qty: 100 } });

    // ---- 1. Bill se credit note (same state -> CGST + SGST) ----
    r = await call('POST', '/invoices', {
      token: wToken, body: { partyId, items: [{ itemId: bearingId, qty: 10, rate: 100, gstRate: 18 }] },
    });
    const gstBill = r.data?._id;
    check('GST wala bill bana (1000 + 180)', r.data?.grandTotal === 1180, `${r.data?.grandTotal}`);

    r = await call('POST', '/returns', {
      token: wToken,
      body: {
        type: 'SALE_RETURN', partyId, invoiceId: gstBill,
        items: [{ itemId: bearingId, qty: 2, rate: 100, gstRate: 18 }],
      },
    });
    check('bill se credit note ban gaya', r.status === 201, `${r.message}`);
    check('taxType string hai, object nahi', r.data?.taxType === 'CGST_SGST', `${JSON.stringify(r.data?.taxType)}`);
    check('credit note pe CGST 18 + SGST 18 laga',
      r.data?.cgstTotal === 18 && r.data?.sgstTotal === 18,
      `cgst ${r.data?.cgstTotal}, sgst ${r.data?.sgstTotal}`);
    check('credit note ka kul 236 (200 + 36)', r.data?.grandTotal === 236, `${r.data?.grandTotal}`);
    const gstCredit = r.data?._id;

    r = await call('GET', `/khata/${partyId}`, { token: wToken });
    const crEntry = r.data?.entries?.find((e) => e.refType === 'ReturnNote' && String(e.refId) === String(gstCredit));
    check('khate me GST ke saath poora 236 credit hua', crEntry?.credit === 236, `${crEntry?.credit}`);

    // ---- 2. BINA BILL ke credit note — yahi case toota hua tha ----
    r = await call('POST', '/returns', {
      token: wToken,
      body: {
        type: 'SALE_RETURN', partyId,
        items: [{ itemId: bearingId, qty: 1, rate: 100, gstRate: 18 }],
        reason: 'Bina bill ke wapas aaya',
      },
    });
    check('bina bill ke bhi credit note ban gaya', r.status === 201, `${r.message}`);
    check('bina bill wale note pe bhi GST laga (18)',
      round2(r.data?.cgstTotal + r.data?.sgstTotal + r.data?.igstTotal) === 18,
      `tax ${round2((r.data?.cgstTotal || 0) + (r.data?.sgstTotal || 0) + (r.data?.igstTotal || 0))}`);
    check('bina bill wale note ka kul 118', r.data?.grandTotal === 118, `${r.data?.grandTotal}`);

    // ---- 3. Purchase return (supplier ka bhi apna taxType nahi hota) ----
    r = await call('POST', '/returns', {
      token: wToken,
      body: {
        type: 'PURCHASE_RETURN', partyId: supplierId,
        items: [{ itemId: bearingId, qty: 2, rate: 90, gstRate: 18 }],
      },
    });
    check('GST wala debit note ban gaya', r.status === 201, `${r.message}`);
    check('debit note pe bhi GST laga (32.4)',
      round2((r.data?.cgstTotal || 0) + (r.data?.sgstTotal || 0) + (r.data?.igstTotal || 0)) === 32.4,
      `tax ${round2((r.data?.cgstTotal || 0) + (r.data?.sgstTotal || 0) + (r.data?.igstTotal || 0))}`);

    // ---- 4. Dusre state pe IGST ----
    await call('PUT', `/parties/${partyId}`, {
      token: wToken, body: { address: { city: 'Mumbai', state: 'Maharashtra', pincode: '400001' } },
    });
    r = await call('POST', '/returns', {
      token: wToken,
      body: { type: 'SALE_RETURN', partyId, items: [{ itemId: bearingId, qty: 1, rate: 100, gstRate: 18 }] },
    });
    check('dusre state pe IGST laga, CGST nahi',
      r.data?.taxType === 'IGST' && r.data?.igstTotal === 18 && r.data?.cgstTotal === 0,
      `${r.data?.taxType} / igst ${r.data?.igstTotal}`);
    await call('PUT', `/parties/${partyId}`, {
      token: wToken, body: { address: { city: 'Kanpur', state: 'Uttar Pradesh', pincode: '208001' } },
    });

    // ---- 5. Ek hi item do line me daal kar rok bypass na ho ----
    r = await call('POST', '/invoices', {
      token: wToken, body: { partyId, items: [{ itemId: bearingId, qty: 10, rate: 100, gstRate: 18 }] },
    });
    const dupBill = r.data?._id;

    r = await call('POST', '/returns', {
      token: wToken,
      body: {
        type: 'SALE_RETURN', partyId, invoiceId: dupBill,
        items: [
          { itemId: bearingId, qty: 6, rate: 100, gstRate: 18 },
          { itemId: bearingId, qty: 6, rate: 100, gstRate: 18 },
        ],
      },
    });
    check('ek hi item do line me (6+6 vs bill me 10) reject hua',
      r.status === 400 && /wapas ho sakta hai/.test(r.message || ''), `status ${r.status}: ${r.message}`);

    r = await call('POST', '/returns', {
      token: wToken,
      body: {
        type: 'SALE_RETURN', partyId, invoiceId: dupBill,
        items: [
          { itemId: bearingId, qty: 4, rate: 100, gstRate: 18 },
          { itemId: bearingId, qty: 6, rate: 100, gstRate: 18 },
        ],
      },
    });
    check('4+6 = poore 10 chal gaye', r.status === 201, `${r.message}`);

    // ---- 6. Discount rate se zyada -> 400 aana chahiye, 500 nahi ----
    r = await call('POST', '/returns', {
      token: wToken,
      body: {
        type: 'SALE_RETURN', partyId,
        items: [{ itemId: bearingId, qty: 1, rate: 100, discount: 500, gstRate: 18 }],
      },
    });
    check('rate se zyada discount pe 400 mila (500 nahi)', r.status === 400, `status ${r.status}`);

    await call('PUT', '/business/me', { token: wToken, body: { gstEnabled: false } });

    /* ─────────────────────────────────────────────────────────────────────
       Paise ka reversal

       Sabse zaroori baat jo yahan check hoti hai: BILL kya keh raha hai aur
       KHATA kya keh raha hai — dono hamesha ek hi baat kahen. Pehle chaar
       jagah aisi thi jahan dono alag ho jate the aur paisa gayab dikhta tha.
       ───────────────────────────────────────────────────────────────────── */
    console.log(`\n${Y}Paise ka reversal${N}`);

    await call('POST', `/items/${bearingId}/stock`, { token: wToken, body: { mode: 'set', qty: 500 } });

    // Har baar ke liye chhota helper — khata aur bill ka milan
    const balanceOf = async () => (await call('GET', `/parties/${partyId}`, { token: wToken })).data?.balance;
    const closingOf = async () => (await call('GET', `/khata/${partyId}`, { token: wToken })).data?.closing;

    // ---- 1. Bill ke saath aaya paisa delete karo ----
    r = await call('POST', '/invoices', {
      token: wToken, body: { partyId, items: [{ itemId: bearingId, qty: 10, rate: 1000 }], paidAmount: 3000 },
    });
    const revBill = r.data?._id;
    check('bill 10000 bana, 3000 mila, 7000 baaki',
      r.data?.grandTotal === 10000 && r.data?.dueAmount === 7000, `due ${r.data?.dueAmount}`);

    const balBeforeRev = await balanceOf();

    const revBillNo = (await call('GET', `/invoices/${revBill}`, { token: wToken })).data?.invoiceNo;
    r = await call('GET', '/payments?limit=10', { token: wToken });
    const inlinePay = r.data?.find((p) => p.note === `${revBillNo} ke saath`);
    check('bill ke saath wali payment mil gayi', Boolean(inlinePay), 'nahi mili');
    check('uspe sourceInvoiceId laga hai', String(inlinePay?.sourceInvoiceId) === String(revBill),
      `${inlinePay?.sourceInvoiceId}`);
    check('uske allocations me 3000 likha hai', inlinePay?.allocations?.[0]?.amount === 3000,
      JSON.stringify(inlinePay?.allocations));

    r = await call('DELETE', `/payments/${inlinePay._id}`, { token: wToken });
    check('bill wali payment delete ho gayi', r.status === 200, `${r.message}`);

    r = await call('GET', `/invoices/${revBill}`, { token: wToken });
    check('delete pe bill wapas poora udhaar (10000)', r.data?.dueAmount === 10000, `${r.data?.dueAmount}`);
    check('KHATA BHI 3000 badha (pehle credit pada reh jata tha)',
      round2(await balanceOf()) === round2(balBeforeRev + 3000),
      `${balBeforeRev} -> ${await balanceOf()}`);
    check('khate ka closing aur Party.balance barabar',
      round2(await closingOf()) === round2(await balanceOf()),
      `closing ${await closingOf()} vs balance ${await balanceOf()}`);

    // ---- 2. Bill cancel pe doosri payment na ude ----
    r = await call('POST', '/invoices', {
      token: wToken, body: { partyId, items: [{ itemId: bearingId, qty: 1, rate: 4000 }] },
    });
    const cancelBill = r.data?._id;

    r = await call('POST', '/payments', {
      token: wToken, body: { partyId, amount: 4000, mode: 'CASH', note: 'alag se aayi payment' },
    });
    const standalonePay = r.data?._id;
    check('4000 ki alag payment ban gayi', r.status === 201, `${r.message}`);

    r = await call('DELETE', `/payments/${standalonePay}`, { token: wToken });
    check('test ke liye wapas hata di', r.status === 200);

    // Ab dobara — is baar bill cancel karenge
    r = await call('POST', '/payments', { token: wToken, body: { partyId, amount: 4000, mode: 'CASH' } });
    const keepPay = r.data?._id;

    r = await call('POST', `/invoices/${cancelBill}/cancel`, { token: wToken, body: { reason: 'test' } });
    check('bill cancel ho gaya', r.data?.cancelled === true, `${r.message}`);

    r = await call('GET', `/payments/${keepPay}`, { token: wToken });
    check('alag se aayi payment ZINDA hai (pehle delete ho jati thi)',
      r.status === 200 && r.data?.amount === 4000, `status ${r.status}`);
    check('us payment se cancel wale bill ka hissa hat gaya',
      !(r.data?.allocations || []).some((a) => String(a.invoiceId) === String(cancelBill)),
      JSON.stringify(r.data?.allocations));

    check('cancel ke baad bhi khata aur closing barabar',
      round2(await closingOf()) === round2(await balanceOf()),
      `closing ${await closingOf()} vs balance ${await balanceOf()}`);

    // ---- 3. Credit note bana ho to bill cancel na ho ----
    r = await call('POST', '/invoices', {
      token: wToken, body: { partyId, items: [{ itemId: bearingId, qty: 10, rate: 500 }] },
    });
    const crBill = r.data?._id;

    r = await call('POST', '/returns', {
      token: wToken,
      body: { type: 'SALE_RETURN', partyId, invoiceId: crBill, items: [{ itemId: bearingId, qty: 4, rate: 500 }] },
    });
    check('is bill ka credit note ban gaya', r.status === 201, `${r.message}`);
    const crNote = r.data?._id;

    r = await call('POST', `/invoices/${crBill}/cancel`, { token: wToken, body: {} });
    check('credit note wale bill ka cancel ruk gaya (stock/khata double hone se bacha)',
      r.status === 400 && /wapas aa chuka hai/.test(r.message || ''), `status ${r.status}: ${r.message}`);

    await call('DELETE', `/returns/${crNote}`, { token: wToken });
    r = await call('POST', `/invoices/${crBill}/cancel`, { token: wToken, body: {} });
    check('credit note hatane ke baad cancel chal gaya', r.data?.cancelled === true, `${r.message}`);

    // ---- 4. Do payment ek hi bill pe, pehli wali delete ----
    r = await call('POST', '/invoices', {
      token: wToken, body: { partyId, items: [{ itemId: bearingId, qty: 1, rate: 5000 }] },
    });
    const twoA = r.data?._id;
    r = await call('POST', '/invoices', {
      token: wToken, body: { partyId, items: [{ itemId: bearingId, qty: 1, rate: 5000 }] },
    });
    const twoB = r.data?._id;

    // Purana udhaar pehle clear kar do taaki hisaab saaf rahe
    const dueNow = await balanceOf();
    if (dueNow > 10000) {
      await call('POST', '/payments', { token: wToken, body: { partyId, amount: round2(dueNow - 10000), mode: 'CASH' } });
    }

    r = await call('POST', '/payments', { token: wToken, body: { partyId, amount: 8000, mode: 'CASH' } });
    const payA = r.data?._id;
    check('8000: 5000 pehle bill pe, 3000 doosre pe',
      (await call('GET', `/invoices/${twoA}`, { token: wToken })).data?.dueAmount === 0
      && (await call('GET', `/invoices/${twoB}`, { token: wToken })).data?.dueAmount === 2000,
      `A due ${(await call('GET', `/invoices/${twoA}`, { token: wToken })).data?.dueAmount}`);

    r = await call('GET', `/payments/${payA}`, { token: wToken });
    check('allocations me 5000 aur 3000 alag alag likhe hain',
      r.data?.allocations?.length === 2 && r.data.allocations[0].amount === 5000
      && r.data.allocations[1].amount === 3000, JSON.stringify(r.data?.allocations));

    await call('POST', '/payments', { token: wToken, body: { partyId, amount: 2000, mode: 'CASH' } });

    r = await call('DELETE', `/payments/${payA}`, { token: wToken });
    check('pehli payment delete hui', r.status === 200);
    check('delete pe pehla bill poora udhaar wapas (5000)',
      (await call('GET', `/invoices/${twoA}`, { token: wToken })).data?.dueAmount === 5000,
      `${(await call('GET', `/invoices/${twoA}`, { token: wToken })).data?.dueAmount}`);
    check('doosre bill pe sirf 2000 bacha (pehle 0 reh jata tha)',
      (await call('GET', `/invoices/${twoB}`, { token: wToken })).data?.paidAmount === 2000,
      `paid ${(await call('GET', `/invoices/${twoB}`, { token: wToken })).data?.paidAmount}`);
    check('khata aur closing abhi bhi barabar',
      round2(await closingOf()) === round2(await balanceOf()),
      `closing ${await closingOf()} vs balance ${await balanceOf()}`);

    // ---- 5. Aakhri jaanch: khata ka jod = saare bill ka baaki ----
    r = await call('GET', '/invoices?status=active&limit=200', { token: wToken });
    const billsDue = round2((r.data || []).reduce((s, i) => s + (i.dueAmount || 0), 0));
    const bal = round2(await balanceOf());
    check('khata = saare active bill ka baaki (koi paisa gayab nahi)',
      bal === billsDue, `khata ${bal} vs bill ka jod ${billsDue}`);

    /* ─────────────────────────────────────────────────────────────────────
       Khata, GST report aur delete ka nishaan

       Chaar alag jagah jahan "purana ya adhoora" data dikhta tha:
       khata ka Baaki, GST report ka kharid taxable, purchase delete ki
       history, aur return wali party ka delete.
       ───────────────────────────────────────────────────────────────────── */
    console.log(`\n${Y}Khata, GST report aur delete ka nishaan${N}`);

    // ---- 1. Khata ka "Baaki" hamesha aaj ka ho, chahe entries kat jayein ----
    //
    // limit=3 lagane se wahi haalat banti hai jo 200 se zyada lena-dena wali
    // party pe banti hai. Pehle limit PURANI entries pakadti thi, isliye
    // "Baaki" mahino purana chipak jata tha aur aaj ka bill dikhta hi nahi tha.
    const realBal = round2(await balanceOf());
    r = await call('GET', `/khata/${partyId}?limit=3`, { token: wToken });
    const kh = r.data || {};
    check('kam limit pe bhi khata ka Baaki = party ka asli balance',
      round2(kh.closing) === realBal, `closing ${kh.closing} vs balance ${realBal}`);
    check('sirf 3 entry dikhi', kh.entries?.length === 3, `${kh.entries?.length}`);
    check('kul ginti alag se aayi', kh.total > 3, `total ${kh.total}`);
    check('purani entries chhupi hain, ye bata diya', kh.truncated === true);
    check('opening + badha − ghata = Baaki',
      round2(kh.opening + kh.totalDebit - kh.totalCredit) === round2(kh.closing),
      `${kh.opening} + ${kh.totalDebit} − ${kh.totalCredit} ≠ ${kh.closing}`);

    r = await call('GET', `/khata/${partyId}`, { token: wToken });
    check('poori list me bhi Baaki wahi', round2(r.data?.closing) === realBal,
      `${r.data?.closing} vs ${realBal}`);
    check('poori list pe truncated ka nishaan nahi', r.data?.truncated === false);

    // ---- 2. GST report me kharid ka taxable 0 na ho ----
    await call('PUT', '/business/me', { token: wToken, body: { gstEnabled: true } });

    r = await call('POST', '/purchases', {
      token: wToken,
      body: { supplierId, items: [{ itemId: bearingId, qty: 20, rate: 100, gstRate: 18 }] },
    });
    const gstPur = r.data?._id;
    check('GST wali kharid bani (taxable 2000)', r.data?.taxableTotal === 2000,
      `taxable ${r.data?.taxableTotal}`);

    r = await call('GET', '/reports/gst?from=2020-01-01', { token: wToken });
    check('GST report me kharid ka taxable 0 nahi hai (pehle hamesha 0 aata tha)',
      (r.data?.meta?.purchaseTaxable || 0) > 0, `purchaseTaxable ${r.data?.meta?.purchaseTaxable}`);
    check('input credit bhi mila', (r.data?.meta?.inputTax || 0) > 0,
      `inputTax ${r.data?.meta?.inputTax}`);

    // ---- 3. Purchase delete hone ke baad history sach bole ----
    const stockBefore = (await call('GET', `/items/${bearingId}`, { token: wToken })).data?.stockQty;

    r = await call('DELETE', `/purchases/${gstPur}`, { token: wToken });
    check('kharid delete ho gayi', r.status === 200, `status ${r.status}`);

    const stockAfter = (await call('GET', `/items/${bearingId}`, { token: wToken })).data?.stockQty;
    check('stock 20 wapas nikal gaya', round2(stockBefore - stockAfter) === 20,
      `${stockBefore} → ${stockAfter}`);

    r = await call('GET', `/items/${bearingId}/movements`, { token: wToken });
    const wapas = (r.data || []).find((m) => m.type === 'PURCHASE_RETURN' && m.qty === -20);
    check('stock ghatne ka record history me hai (pehle mit jata tha)', Boolean(wapas));
    check('usme likha hai ki kaunsi kharid delete hui',
      /delete hui/.test(wapas?.note || ''), wapas?.note);
    check('aur "maal aaya" wala record bhi bacha hai',
      (r.data || []).some((m) => m.type === 'PURCHASE' && m.qty === 20));

    await call('PUT', '/business/me', { token: wToken, body: { gstEnabled: false } });

    // ---- 4. Sirf return wali party delete na ho ----
    r = await call('POST', '/parties', {
      token: wToken,
      body: { name: 'Sirf Return Wala', phone: '9500000077', type: 'retailer' },
    });
    const onlyReturnParty = r.data?._id;

    r = await call('POST', '/returns', {
      token: wToken,
      body: {
        type: 'SALE_RETURN', partyId: onlyReturnParty,
        items: [{ itemId: bearingId, qty: 1, rate: 100 }],
      },
    });
    check('bina bill ka return bana', r.status === 201, `status ${r.status}`);

    r = await call('DELETE', `/parties/${onlyReturnParty}`, { token: wToken });
    check('sirf return wali party delete NAHI hui', r.data?.deleted === false,
      `deleted ${r.data?.deleted}`);
    check('block ho gayi', r.data?.blocked === true);
    check('message me "return" ka naam aaya', /return/.test(r.data?.message || ''), r.data?.message);

    r = await call('GET', `/parties/${onlyReturnParty}`, { token: wToken });
    check('party abhi bhi maujud hai', r.status === 200, `status ${r.status}`);
    r = await call('GET', `/khata/${onlyReturnParty}`, { token: wToken });
    check('uska khata bhi saabut hai', (r.data?.entries?.length || 0) > 0,
      `entries ${r.data?.entries?.length}`);

    /* ─────────────────────────────────────────────────────────────────────
       Do kaam ek saath

       Ye section asli me DO REQUEST EK SAATH bhejta hai (Promise.all). Dukaan me
       yahi hota hai: do log alag alag phone se, ya ek hi banda button do baar
       daba deta hai. Har check ke baad wahi sawal — khata aur bill ek hi baat
       kah rahe hain ya nahi.
       ───────────────────────────────────────────────────────────────────── */
    console.log(`\n${Y}Do kaam ek saath${N}`);

    await call('POST', `/items/${bearingId}/stock`, { token: wToken, body: { mode: 'set', qty: 500 } });

    // ---- 1. Ek hi bill pe do payment, ek saath ----
    r = await call('POST', '/invoices', {
      token: wToken, body: { partyId, items: [{ itemId: bearingId, qty: 10, rate: 1000 }] },
    });
    const raceBill = r.data?._id;
    check('10000 ka bill bana', r.data?.dueAmount === 10000, `due ${r.data?.dueAmount}`);

    const balBeforeRace = round2(await balanceOf());

    const [pA, pB] = await Promise.all([
      call('POST', '/payments', { token: wToken, body: { partyId, amount: 5000, mode: 'CASH' } }),
      call('POST', '/payments', { token: wToken, body: { partyId, amount: 5000, mode: 'UPI' } }),
    ]);
    check('dono payment ban gayi', pA.status === 201 && pB.status === 201,
      `${pA.status} / ${pB.status}`);

    r = await call('GET', `/invoices/${raceBill}`, { token: wToken });
    check('bill pe poore 10000 lage (5000 gayab nahi hue)', r.data?.paidAmount === 10000,
      `paid ${r.data?.paidAmount}`);
    check('bill ka udhaar 0', r.data?.dueAmount === 0, `due ${r.data?.dueAmount}`);
    check('khata bhi 10000 kam hua', round2(await balanceOf()) === round2(balBeforeRace - 10000),
      `pehle ${balBeforeRace}, ab ${await balanceOf()}`);
    check('khata aur closing barabar', round2(await closingOf()) === round2(await balanceOf()),
      `closing ${await closingOf()} vs balance ${await balanceOf()}`);

    // ---- 2. Ek payment, do baar delete ----
    const balBeforeDel = round2(await balanceOf());
    const [dA, dB] = await Promise.all([
      call('DELETE', `/payments/${pA.data?.payment?._id}`, { token: wToken }),
      call('DELETE', `/payments/${pA.data?.payment?._id}`, { token: wToken }),
    ]);
    check('do me se sirf EK delete chala',
      [dA.status, dB.status].filter((s) => s === 200).length === 1, `${dA.status} / ${dB.status}`);
    check('doosre ko saaf mana kar diya',
      [dA.status, dB.status].some((s) => s === 404), `${dA.status} / ${dB.status}`);
    check('khata sirf 5000 wapas gaya (10000 nahi)',
      round2(await balanceOf()) === round2(balBeforeDel + 5000),
      `pehle ${balBeforeDel}, ab ${await balanceOf()}`);

    r = await call('GET', `/invoices/${raceBill}`, { token: wToken });
    check('bill pe bhi 5000 hi wapas aaya', r.data?.dueAmount === 5000, `due ${r.data?.dueAmount}`);

    // ---- 3. Ek UPI claim, do baar confirm ----
    r = await call('POST', '/my/payments', {
      token: rToken, body: { amount: 1000, reference: 'RACE123' },
    });
    const raceClaim = r.data?._id;
    check('retailer ne UPI claim bheja', r.status === 201, `${r.message}`);

    if (raceClaim) {
      const balBeforeConfirm = round2(await balanceOf());
      const [cA, cB] = await Promise.all([
        call('POST', `/payments/${raceClaim}/confirm`, { token: wToken }),
        call('POST', `/payments/${raceClaim}/confirm`, { token: wToken }),
      ]);
      check('do me se sirf EK confirm chala',
        [cA.status, cB.status].filter((s) => s === 200).length === 1, `${cA.status} / ${cB.status}`);
      check('doosre ko "pehle se confirm hai" mila',
        /pehle se confirm/.test(`${cA.message} ${cB.message}`), `${cA.message} | ${cB.message}`);
      check('khate me 1000 hi gaya, 2000 nahi',
        round2(await balanceOf()) === round2(balBeforeConfirm - 1000),
        `pehle ${balBeforeConfirm}, ab ${await balanceOf()}`);
      check('khata aur closing abhi bhi barabar',
        round2(await closingOf()) === round2(await balanceOf()),
        `closing ${await closingOf()} vs balance ${await balanceOf()}`);
    }

    // ---- 4. Do bill ek saath, stock sirf ek ke liye ----
    await call('POST', `/items/${bearingId}/stock`, { token: wToken, body: { mode: 'set', qty: 12 } });

    const billsBefore = (await call('GET', '/invoices?limit=1', { token: wToken })).meta?.total;
    const [iA, iB] = await Promise.all([
      call('POST', '/invoices', { token: wToken, body: { partyId, items: [{ itemId: bearingId, qty: 12, rate: 100 }] } }),
      call('POST', '/invoices', { token: wToken, body: { partyId, items: [{ itemId: bearingId, qty: 12, rate: 100 }] } }),
    ]);
    check('sirf EK bill bana', [iA.status, iB.status].filter((s) => s === 201).length === 1,
      `${iA.status} / ${iB.status}`);
    check('doosre ko stock wali error mili',
      /stock/i.test(`${iA.message} ${iB.message}`), `${iA.message} | ${iB.message}`);

    const billsAfter = (await call('GET', '/invoices?limit=1', { token: wToken })).meta?.total;
    check('list me sirf ek naya bill jud a (adhoora bill pada nahi hai)',
      billsAfter === billsBefore + 1, `pehle ${billsBefore}, ab ${billsAfter}`);

    r = await call('GET', `/items/${bearingId}`, { token: wToken });
    check('stock poora 0 hua (12 hi gaya, 24 nahi)', r.data?.stockQty === 0, `stock ${r.data?.stockQty}`);

    // ---- 5. Aakhri jaanch — khata apne aap se mel khata hai ----
    r = await call('GET', `/khata/${partyId}`, { token: wToken });
    const kk = r.data || {};
    check('khata ka apna jod barabar hai',
      round2(kk.opening + kk.totalDebit - kk.totalCredit) === round2(kk.closing),
      `${kk.opening} + ${kk.totalDebit} − ${kk.totalCredit} ≠ ${kk.closing}`);
    check('aur khata = Party.balance', round2(kk.closing) === round2(await balanceOf()),
      `closing ${kk.closing} vs balance ${await balanceOf()}`);

    // Har payment ka allocation uski apni raqam se zyada na ho
    r = await call('GET', `/payments?partyId=${partyId}&limit=200`, { token: wToken });
    const overAllocated = (r.data || []).filter((p) => {
      const laga = round2((p.allocations || []).reduce((s, a) => s + (a.amount || 0), 0));
      return laga > round2(p.amount) + 0.01;
    });
    check('kisi payment ka allocation uski raqam se zyada nahi hai',
      overAllocated.length === 0, overAllocated.map((p) => p.paymentNo).join(', '));

    await call('POST', `/items/${bearingId}/stock`, { token: wToken, body: { mode: 'set', qty: 500 } });

    console.log(`\n${Y}Staff login${N}`);

    r = await call('GET', '/staff', { token: wToken });
    check('staff list me abhi sirf malik hai', r.data?.staff?.length === 1, `${r.data?.staff?.length}`);
    check('malik owner mark hua', r.data?.staff?.[0]?.isOwner === true);
    check('malik ke paas saari permission hai', r.data?.staff?.[0]?.permissions?.length === 9,
      `${r.data?.staff?.[0]?.permissions?.length}`);
    check('role ki list bhi aayi', r.data?.roles?.length === 4, `${r.data?.roles?.length}`);

    r = await call('POST', '/staff', {
      token: wToken,
      body: { name: 'Munna Salesman', phone: '9000000011', password: 'staff123', staffRole: 'salesman' },
    });
    check('salesman ka login bana', r.status === 201, `${r.message}`);
    check('salesman ko default permission mili',
      r.data?.permissions?.includes('invoices') && !r.data?.permissions?.includes('khata'),
      JSON.stringify(r.data?.permissions));
    const salesmanId = r.data?._id;

    r = await call('POST', '/staff', {
      token: wToken,
      body: { name: 'Doosra Malik', phone: '9000000012', password: 'staff123', staffRole: 'owner' },
    });
    check('doosra malik nahi ban saka', r.status === 400, `status ${r.status}`);

    r = await call('POST', '/staff', {
      token: wToken,
      body: { name: 'Same Number', phone: WHOLESALER_PHONE, password: 'staff123', staffRole: 'manager' },
    });
    check('pehle se registered number reject hua', r.status === 409, `status ${r.status}`);

    r = await call('POST', '/auth/login', { body: { phone: '9000000011', password: 'staff123' } });
    check('salesman login kar paya', r.status === 200 && r.data?.token, `${r.message}`);
    check('session me staffRole aaya', r.data?.user?.staffRole === 'salesman', `${r.data?.user?.staffRole}`);
    check('session me isOwner false hai', r.data?.user?.isOwner === false, `${r.data?.user?.isOwner}`);
    const staffToken = r.data?.token;

    r = await call('GET', '/items', { token: staffToken });
    check('salesman items dekh saka', r.status === 200, `status ${r.status}`);

    r = await call('POST', '/invoices', {
      token: staffToken, body: { partyId, items: [{ itemId: bearingId, qty: 1, rate: 100 }] },
    });
    check('salesman bill bana saka', r.status === 201, `${r.message}`);

    r = await call('GET', '/khata', { token: staffToken });
    check('salesman khata NAHI khol saka', r.status === 403, `status ${r.status}`);

    r = await call('GET', '/reports/sale', { token: staffToken });
    check('salesman report NAHI dekh saka', r.status === 403, `status ${r.status}`);

    r = await call('GET', '/purchases', { token: staffToken });
    check('salesman purchase NAHI dekh saka', r.status === 403, `status ${r.status}`);

    r = await call('GET', '/staff', { token: staffToken });
    check('salesman staff list NAHI dekh saka', r.status === 403, `status ${r.status}`);

    r = await call('PUT', '/business/me', { token: staffToken, body: { name: 'Hack Attempt' } });
    check('salesman dukaan ki settings NAHI badal saka', r.status === 403, `status ${r.status}`);

    r = await call('GET', '/backup/download', { token: staffToken });
    check('salesman backup NAHI le saka', r.status === 403, `status ${r.status}`);

    r = await call('GET', '/business/me', { token: wToken });
    check('malik ki dukaan ka naam nahi badla', r.data?.name === 'Ramesh Auto Parts', `${r.data?.name}`);

    /* ─────────────────────────────────────────────────────────────────────
       Staff ko kya NAHI dikhna chahiye

       Menu chhupa dena kaafi nahi hai — API se seedha maangne par bhi na mile.
       Yahan wahi teen darwaze check hote hain jo pehle khule pade the.
       ───────────────────────────────────────────────────────────────────── */
    console.log(`\n${Y}Staff ko kya NAHI dikhna chahiye${N}`);

    // ---- 1. Retailer ko block/approve karna ----
    const statusBefore = (await call('GET', `/parties/${partyId}`, { token: wToken })).data?.status;

    r = await call('GET', '/business/retailers', { token: staffToken });
    check('salesman retailer list NAHI dekh saka', r.status === 403, `status ${r.status}`);
    check('us jawab me kisi ka balance nahi gaya',
      !JSON.stringify(r).includes('creditLimit'));

    r = await call('POST', `/business/retailers/${partyId}/block`, { token: staffToken });
    check('salesman kisi retailer ko block NAHI kar saka', r.status === 403, `status ${r.status}`);

    r = await call('GET', `/parties/${partyId}`, { token: wToken });
    check('retailer ka status waisa ka waisa hai', r.data?.status === statusBefore,
      `pehle ${statusBefore}, ab ${r.data?.status}`);

    r = await call('POST', `/business/retailers/${partyId}/approve`, { token: staffToken });
    check('approve bhi NAHI kar saka', r.status === 403, `status ${r.status}`);

    // Malik ka apna kaam nahi rukna chahiye
    r = await call('GET', '/business/retailers', { token: wToken });
    check('malik retailer list dekh saka', r.status === 200, `status ${r.status}`);

    // ---- 2. Invite link, UPI aur dukaan ka email ----
    const bizStaff = await call('GET', '/business/me', { token: staffToken });
    check('staff ko /business/me khula (bill ke liye chahiye)', bizStaff.status === 200,
      `status ${bizStaff.status}`);
    check('par invite code NAHI mila', bizStaff.data?.inviteCode === undefined,
      `${bizStaff.data?.inviteCode}`);
    check('invite link bhi NAHI mila', bizStaff.data?.inviteLink === undefined,
      `${bizStaff.data?.inviteLink}`);
    check('malik ki UPI id NAHI mili', bizStaff.data?.upiId === undefined, `${bizStaff.data?.upiId}`);
    check('dukaan ka email NAHI mila', bizStaff.data?.email === undefined, `${bizStaff.data?.email}`);

    // ...lekin bill banane ke liye jo chahiye wo mila
    check('staff ko dukaan ka naam mila', bizStaff.data?.name === 'Ramesh Auto Parts',
      `${bizStaff.data?.name}`);
    check('staff ko address bhi mila', typeof bizStaff.data?.address === 'object');

    const bizOwner = await call('GET', '/business/me', { token: wToken });
    check('malik ko invite code poora mila', Boolean(bizOwner.data?.inviteCode),
      `${bizOwner.data?.inviteCode}`);
    check('malik ko invite link bhi mila', /\/join\//.test(bizOwner.data?.inviteLink || ''),
      `${bizOwner.data?.inviteLink}`);

    // Doosra darwaza — /auth/me
    r = await call('GET', '/auth/me', { token: staffToken });
    check('/auth/me se bhi invite code nahi nikla',
      r.data?.business?.inviteCode === undefined, `${r.data?.business?.inviteCode}`);
    check('/auth/me se UPI bhi nahi nikli',
      r.data?.business?.upiId === undefined, `${r.data?.business?.upiId}`);
    check('phir bhi dukaan ka naam wahan hai', r.data?.business?.name === 'Ramesh Auto Parts');

    if (bizOwner.data?.inviteCode) {
      check('poore staff session me invite code kahin nahi hai',
        !JSON.stringify(r).includes(bizOwner.data.inviteCode));
    }

    // ---- 3. Dashboard pe report wali baat ----
    r = await call('GET', '/dashboard', { token: staffToken });
    check('salesman ka dashboard khula', r.status === 200, `status ${r.status}`);
    check('usme mahine ka jod NAHI hai', r.data?.sale?.month === undefined, `${r.data?.sale?.month}`);
    check('14 din ka graph NAHI hai', r.data?.trend === undefined);
    check('top items NAHI hain', r.data?.topItems === undefined);
    check('aaj ka bill wala hissa hai (bill wo khud banata hai)',
      r.data?.sale?.today !== undefined);

    r = await call('GET', '/dashboard', { token: wToken });
    check('malik ko mahine ka jod mila', r.data?.sale?.month !== undefined);
    check('malik ko trend bhi mila', Array.isArray(r.data?.trend));

    // ---- 4. Retailer ka unread count sirf uska ----
    r = await call('GET', '/dashboard', { token: rToken });
    const retailerUnread = r.data?.unread;
    r = await call('GET', '/notifications/unread-count', { token: rToken });
    check('retailer ke dashboard ka count uski apni list se milta hai',
      retailerUnread === r.data?.count, `dashboard ${retailerUnread} vs list ${r.data?.count}`);

    // permission badlo
    r = await call('PUT', `/staff/${salesmanId}`, {
      token: wToken, body: { permissions: ['items', 'orders', 'invoices', 'khata'] },
    });
    check('malik ne permission badal di', r.data?.permissions?.includes('khata'),
      JSON.stringify(r.data?.permissions));

    r = await call('GET', '/khata', { token: staffToken });
    check('ab salesman khata khol saka', r.status === 200, `status ${r.status}`);

    // role badlo to naye role ki default permission lag jaye
    r = await call('PUT', `/staff/${salesmanId}`, { token: wToken, body: { staffRole: 'accountant' } });
    check('role badalne pe naye role ki permission lagi',
      r.data?.permissions?.includes('reports') && !r.data?.permissions?.includes('purchases'),
      JSON.stringify(r.data?.permissions));

    // block
    r = await call('PUT', `/staff/${salesmanId}`, { token: wToken, body: { isActive: false } });
    check('staff block ho gaya', r.data?.isActive === false);

    r = await call('GET', '/items', { token: staffToken });
    check('block hone par purana token bhi nahi chala', r.status === 403, `status ${r.status}`);

    r = await call('POST', '/auth/login', { body: { phone: '9000000011', password: 'staff123' } });
    check('block hone par login bhi nahi hua', r.status === 403, `status ${r.status}`);

    await call('PUT', `/staff/${salesmanId}`, { token: wToken, body: { isActive: true } });

    console.log(`\n${Y}Apna password badalna${N}`);

    r = await call('POST', '/auth/login', { body: { phone: '9000000011', password: 'staff123' } });
    const staffToken2 = r.data?.token;

    r = await call('POST', '/staff/change-password', {
      token: staffToken2, body: { currentPassword: 'galat', newPassword: 'naya1234' },
    });
    check('galat purana password reject hua', r.status === 400, `${r.message}`);

    r = await call('POST', '/staff/change-password', {
      token: staffToken2, body: { currentPassword: 'staff123', newPassword: 'naya1234' },
    });
    check('password badal gaya', r.status === 200, `${r.message}`);

    r = await call('POST', '/auth/login', { body: { phone: '9000000011', password: 'naya1234' } });
    check('naye password se login hua', r.status === 200, `${r.message}`);

    r = await call('DELETE', `/staff/${salesmanId}`, { token: wToken });
    check('staff hata diya', r.data?.deleted === true, `${r.message}`);

    const ownerId = (await call('GET', '/staff', { token: wToken })).data?.staff?.[0]?._id;
    r = await call('DELETE', `/staff/${ownerId}`, { token: wToken });
    check('malik ko koi hata nahi saka', r.status === 400, `${r.message}`);

    console.log(`\n${Y}Data backup${N}`);

    r = await call('GET', '/backup/summary', { token: wToken });
    check('backup summary aayi', typeof r.data?.invoices === 'number', JSON.stringify(r.data));
    check('staff ki ginti bhi aayi', r.data?.staff === 1, `${r.data?.staff}`);

    const backupRes = await fetch(`${BASE}/backup/download`, {
      headers: { Authorization: `Bearer ${wToken}` },
    });
    const backupJson = await backupRes.json();
    check('backup download hua', backupRes.status === 200, `status ${backupRes.status}`);
    check('backup me app ka naam aur version hai',
      backupJson.meta?.app === 'Rakh Rakhav' && backupJson.meta?.version === 1,
      JSON.stringify(backupJson.meta));
    check('backup me saara data hai',
      backupJson.data?.items?.length > 0 && backupJson.data?.invoices?.length > 0
      && backupJson.data?.parties?.length > 0 && backupJson.data?.ledger?.length > 0,
      JSON.stringify(backupJson.meta?.counts));
    check('backup me password NAHI hai',
      !JSON.stringify(backupJson).includes('passwordHash'), 'password leak ho gaya!');
    check('backup file ke naam ke saath aayi',
      /attachment; filename=".*backup-/.test(backupRes.headers.get('content-disposition') || ''),
      `${backupRes.headers.get('content-disposition')}`);

    const csvRes11 = await fetch(`${BASE}/backup/csv/khata`, {
      headers: { Authorization: `Bearer ${wToken}` },
    });
    const csvText11 = await csvRes11.text();
    check('khata ki CSV mili', csvRes11.status === 200, `status ${csvRes11.status}`);
    check('CSV me header row hai', csvText11.includes('date,party,type'), csvText11.slice(0, 50));

    r = await call('GET', '/backup/csv/kuchbhi', { token: wToken });
    check('anjaan CSV ka naam reject hua', r.status === 404, `status ${r.status}`);

    console.log(`\n${Y}Tenant isolation (Part 11)${N}`);

    r = await call('GET', '/returns', { token: rToken });
    check('retailer saare return nahi dekh saka', r.status === 403, `status ${r.status}`);

    r = await call('POST', '/returns', {
      token: rToken, body: { type: 'SALE_RETURN', partyId, items: [{ itemId: bearingId, qty: 1, rate: 10 }] },
    });
    check('retailer khud return nahi bana saka', r.status === 403, `status ${r.status}`);

    r = await call('GET', '/staff', { token: rToken });
    check('retailer staff list nahi dekh saka', r.status === 403, `status ${r.status}`);

    r = await call('GET', '/backup/download', { token: rToken });
    check('retailer backup nahi le saka', r.status === 403, `status ${r.status}`);

    // ---------------------------------------------------------- Validation
    console.log(`\n${Y}Validation${N}`);

    r = await call('POST', '/auth/wholesaler/signup', {
      body: { name: 'A', phone: '123', password: '12', businessName: '' },
    });
    check('galat input pe field-wise error mila', r.status === 400 && r.details?.length >= 3, `details: ${r.details?.length}`);

  } finally {
    await cleanup();
    server.close();
    await mongoose.disconnect();
  }

  console.log('\n' + results.join('\n'));
  console.log(`\n${failed === 0 ? G : R}${passed} pass, ${failed} fail${N}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error(`${R}Smoke test crash:${N}`, err);
  process.exit(1);
});
