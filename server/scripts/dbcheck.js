#!/usr/bin/env node
/**
 * DATABASE KA HISAAB — bill se pehle.
 *
 *   npm run dbcheck            # index ka naksha (bina database ke)
 *   npm run dbcheck -- --live  # asli database se: size aur index ka bojh
 *
 * Ek lakh user pe do cheezein bill banati hain: kitna data pada hai, aur har
 * likhne pe kitne index update karne padte hain. Dono yahin dikh jate hain.
 */
import mongoose from 'mongoose';
import * as models from '../src/models/index.js';
import { env } from '../src/config/env.js';

const G = '\x1b[32m', Y = '\x1b[33m', R = '\x1b[31m', D = '\x1b[2m', N = '\x1b[0m';
const live = process.argv.includes('--live');

const rows = [];
let total = 0;

for (const [name, M] of Object.entries(models)) {
  if (!M?.schema) continue;
  const ix = M.schema.indexes();
  total += ix.length + 1;
  rows.push({ name, count: ix.length + 1, ix });
}

console.log(`\n${Y}Index ka naksha${N}\n`);
for (const r of rows.sort((a, b) => b.count - a.count)) {
  const tone = r.count >= 8 ? R : r.count >= 6 ? Y : G;
  console.log(`${tone}${String(r.count).padStart(2)}${N}  ${r.name}`);
  for (const [keys, opts] of r.ix) {
    const flags = [
      opts?.unique && 'unique',
      opts?.expireAfterSeconds !== undefined && `TTL ${Math.round(opts.expireAfterSeconds / 86400)}d`,
      opts?.partialFilterExpression && 'partial',
    ].filter(Boolean).join(' · ');
    const cols = Object.entries(keys).map(([k, v]) => `${k}${v === -1 ? '-' : ''}`).join(' + ');
    console.log(`    ${D}${cols}${flags ? `  [${flags}]` : ''}${N}`);
  }
}

console.log(`\nKul ${total} index (har model ka _id bhi ginа).`);
console.log(`${D}Har naya doc likhne pe utne hi index update hote hain — ginti kam`);
console.log(`rakhna seedha paisa bachata hai. 8+ wale model dobara dekhne layak.${N}`);

if (!live) {
  console.log(`\n${D}Asli size:  npm run dbcheck -- --live${N}\n`);
  process.exit(0);
}

await mongoose.connect(env.mongoUri);
const db = mongoose.connection.db;
const stats = [];

for (const [, M] of Object.entries(models)) {
  if (!M?.schema) continue;
  try {
    const c = db.collection(M.collection.name);
    const docs = await c.countDocuments();
    const s = await c.aggregate([{ $collStats: { storageStats: {} } }]).toArray();
    const st = s[0]?.storageStats || {};
    stats.push({
      name: M.modelName, docs,
      dataMB: (st.size || 0) / 1048576,
      indexMB: (st.totalIndexSize || 0) / 1048576,
    });
  } catch { /* collection abhi bana hi nahi */ }
}

console.log(`\n${Y}Asli size${N}\n`);
console.log(`${'Collection'.padEnd(20)}${'Docs'.padStart(10)}${'Data MB'.padStart(10)}${'Index MB'.padStart(10)}`);
let dm = 0, im = 0;
for (const s of stats.sort((a, b) => (b.dataMB + b.indexMB) - (a.dataMB + a.indexMB))) {
  dm += s.dataMB; im += s.indexMB;
  console.log(`${s.name.padEnd(20)}${String(s.docs).padStart(10)}${s.dataMB.toFixed(1).padStart(10)}${s.indexMB.toFixed(1).padStart(10)}`);
}
console.log(`${'KUL'.padEnd(20)}${''.padStart(10)}${dm.toFixed(1).padStart(10)}${im.toFixed(1).padStart(10)}`);

if (im > dm) {
  console.log(`\n${R}Dhyan: index data se BADE hain — kuch index shayad bekaar pade hain.${N}`);
}
console.log('');
await mongoose.disconnect();
