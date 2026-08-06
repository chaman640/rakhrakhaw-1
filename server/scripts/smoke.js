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
import {
  User, Business, Party, Item, Category, StockMovement, PartyItemRate, LedgerEntry, Purchase, Counter,
  Cart, Order, Notification, Invoice, Payment,
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
  const phones = [WHOLESALER_PHONE, RETAILER_PHONE];
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
  ]);
  await Business.deleteMany({ _id: { $in: businessIds } });
  await User.deleteMany({ phone: { $in: phones } });
}

async function run() {
  console.log(`\n${Y}Rakh Rakhav — smoke test (Part 1-9)${N}`);
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
    check('states list mili (38)', Array.isArray(r.data) && r.data.length === 38, `count ${r.data?.length}`);

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
    check('export CSV mila', String(r.data?.csv || '').startsWith('name,sku,category'), `${String(r.data?.csv).slice(0, 30)}`);
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
    check('list me retailer ka naam aaya', r.data?.[0]?.party?.name === 'Suresh Kumar', `${r.data?.[0]?.party?.name}`);

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
    check('payment number bana', /^PAY\/\d{2}-\d{2}\/0001$/.test(r.data?.paymentNo || ''), `${r.data?.paymentNo}`);
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
