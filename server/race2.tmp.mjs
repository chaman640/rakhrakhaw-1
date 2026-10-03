// Har kaam 3 baar ek saath — ek hi baar asar hona chahiye
import { MongoClient, ObjectId } from 'mongodb';
const DB = process.env.DB || 'rakhrakhav_ui';
const B = 'http://localhost:5000/api';
const call = async (m, p, b, t) => { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
const W = (await call('POST', '/auth/login', { phone: '9100000001', password: 'test1234' })).data.token;
const c = await MongoClient.connect('mongodb://127.0.0.1:27017'); const db = c.db(DB);
const items = (await call('GET', '/items?limit=50', null, W)).data;
const item = items.find((i) => i.stockQty >= 20);
const party = (await call('GET', '/parties?type=retailer', null, W)).data[0];
const sup = (await call('POST', '/parties', { type: 'supplier', name: 'Race Sup', phone: '96' + String(Date.now()).slice(-8) }, W)).data;
const x3 = (fn) => Promise.all([fn(), fn(), fn()]);
const codes = (rs) => rs.map((r) => r.status).join(',');

async function check(label) {
  const it = await db.collection('items').findOne({ _id: new ObjectId(item._id) });
  const lots = await db.collection('stocklots').aggregate([{ $match: { itemId: it._id } }, { $group: { _id: null, r: { $sum: '$remaining' } } }]).toArray();
  const mv = await db.collection('stockmovements').aggregate([{ $match: { itemId: it._id } }, { $group: { _id: null, q: { $sum: '$qty' } } }]).toArray();
  const out = [`stock ${it.stockQty}`, `lots ${lots[0]?.r}`, `mv ${mv[0]?.q}`];
  for (const pid of [party._id, sup._id]) {
    const p = await db.collection('parties').findOne({ _id: new ObjectId(pid) });
    const le = await db.collection('ledgerentries').find({ partyId: p._id }).toArray();
    const sum = Math.round(le.reduce((s, e) => s + e.debit - e.credit, 0) * 100) / 100;
    out.push(`${p.name.split(' ')[0]} bal ${p.balance}/${sum}`);
  }
  console.log(label.padEnd(22), out.join(' | '));
  return it.stockQty;
}

let s0 = await check('start');
// 1. bill cancel x3
const inv = (await call('POST', '/invoices', { partyId: party._id, items: [{ itemId: item._id, qty: 2, rate: 100 }], paidAmount: 0 }, W)).data;
const invId = inv?.invoice?._id || inv?._id;
await check('after bill (-2)');
console.log('cancel x3', codes(await x3(() => call('POST', `/invoices/${invId}/cancel`, { reason: 'race' }, W))));
await check('after cancel (+2 once)');
// 2. purchase delete x3
const pur = (await call('POST', '/purchases', { supplierId: sup._id, items: [{ itemId: item._id, qty: 3, rate: 50 }], paidAmount: 0 }, W)).data;
const purId = pur?.purchase?._id || pur?._id;
await check('after purchase (+3)');
console.log('pdelete x3', codes(await x3(() => call('DELETE', `/purchases/${purId}`, null, W))));
await check('after pdelete (-3 once)');
// 3. waste expense delete x3
const exp = await call('POST', '/expenses', { category: 'waste-stock', amount: 1, wasteItemId: item._id, wasteQty: 1 }, W);
console.log('waste expense', exp.status, exp.message);
const expId = exp.data?.expense?._id || exp.data?._id;
await check('after waste (-1)');
if (expId) console.log('edelete x3', codes(await x3(() => call('DELETE', `/expenses/${expId}`, null, W))));
await check('after edelete (+1 once)');
// 4. sale return delete x3
const inv2 = (await call('POST', '/invoices', { partyId: party._id, items: [{ itemId: item._id, qty: 2, rate: 100 }], paidAmount: 0 }, W)).data;
const inv2Id = inv2?.invoice?._id || inv2?._id;
const ret = await call('POST', '/returns', { type: 'SALE_RETURN', partyId: party._id, invoiceId: inv2Id, items: [{ itemId: item._id, qty: 1, rate: 100 }] }, W);
const retId = ret.data?.note?._id || ret.data?.returnNote?._id || ret.data?._id;
await check('after bill2+return');
console.log('rdelete x3', codes(await x3(() => call('DELETE', `/returns/${retId}`, null, W))));
await check('after rdelete (-1 once)');
// 5. order -> bill x3
const ord = await call('POST', '/orders', { partyId: party._id, items: [{ itemId: item._id, qty: 1 }] }, W);
const ordId = ord.data?._id || ord.data?.order?._id;
console.log('order', ord.status, ord.message || '');
if (ordId) {
  const rs = await x3(() => call('POST', '/invoices', { partyId: party._id, orderId: ordId, items: [{ itemId: item._id, qty: 1, rate: 100 }], paidAmount: 0 }, W));
  console.log('order->bill x3', codes(rs));
  console.log('bills for order', await db.collection('invoices').countDocuments({ orderId: new ObjectId(ordId) }));
}
await check('end');
await c.close();
