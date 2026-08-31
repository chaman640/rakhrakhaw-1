import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import ApiError from '../utils/ApiError.js';
import { UNITS, STOCK_MOVEMENT_TYPES } from '../config/constants.js';
import { Item, Category } from '../models/index.js';
import { applyStockChange } from './stock.service.js';

/**
 * EXCEL / PDF / PHOTO SE MAAL ADD KARNA.
 *
 * Teen tarah ki file, ek hi rasta:
 *
 *   Excel/CSV  — seedha padh liya jata hai. Sabse pakka.
 *   PDF        — pehle uska likha hua text nikalta hai. Zyadatar supplier ke
 *                bill me text hota hai, isliye ye bhi pakka rehta hai.
 *   Photo      — OCR. Sabse kam bharosemand, isliye har line par nishaan
 *                lagta hai ki wo kitni pakki hai.
 *
 * MASHIN KABHI KHUD SE KUCH NAHI JODTI. Wo sirf padhti hai; jodne se pehle
 * har line aadmi ke saamne aati hai, aur bechne ka rate wahi bharta hai. Ye
 * jaan-boojh kar hai: OCR ek "0" chhod de to ₹450 ka maal ₹45 ka chadh jata,
 * aur wo galti bill banne ke baad hi pakdi jati.
 */

/*
  OCR ka bhasha-data REPO ME HI hai (server/ocr-data/), download nahi hota.

  Tesseract wo data pehli baar internet se laata hai. Wo do wajah se bura tha:
  Render ki disk har deploy pe saaf ho jati hai (yaani har baar 15 MB dobara),
  aur download fail hone par uska worker CHUP-CHAAP POORA SERVER GIRA DETA HAI
  — try/catch bhi nahi pakadta, kyunki wo alag thread se aata hai.

  File saath rakhne se wo call hoti hi nahi.
*/
const OCR_CACHE = new URL('../../ocr-data/', import.meta.url).pathname;
const OCR_SCRIPT = new URL('../../scripts/ocr-run.js', import.meta.url).pathname;

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const num = (v) => {
  const n = Number(String(v ?? '').replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/* Naam milane ke liye — chhota-bada, jagah, aur virām hata kar */
const key = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]/g, '');

/* ───────────────────────────────── Excel / CSV */

const HEAD = {
  name: ['name', 'item', 'itemname', 'product', 'description', 'particulars', 'maal', 'saman'],
  qty: ['qty', 'quantity', 'nos', 'pcs', 'ginti', 'matra'],
  rate: ['rate', 'price', 'purchaseprice', 'cost', 'unitprice', 'daam', 'mrp1'],
  mrp: ['mrp', 'maxprice'],
  unit: ['unit', 'uom', 'ikai'],
  hsn: ['hsn', 'hsncode', 'sac'],
};

function headerMap(row) {
  const map = {};
  row.forEach((cell, i) => {
    const k = key(cell);
    if (!k) return;
    for (const [field, names] of Object.entries(HEAD)) {
      if (map[field] === undefined && names.some((n) => k === n || k.includes(n))) map[field] = i;
    }
  });
  return map;
}

async function fromSheet(buffer) {
  const XLSX = (await import('xlsx')).default || await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];

  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });

  /*
    Header kahin bhi ho sakta hai — bill ke upar dukaan ka naam, pata, GSTIN
    hote hain. Isliye pehli 15 line me se wo line dhoondhte hain jisme "naam"
    wala column mile.
  */
  let hi = -1;
  let map = {};
  for (let i = 0; i < Math.min(15, grid.length); i += 1) {
    const m = headerMap(grid[i] || []);
    if (m.name !== undefined) { hi = i; map = m; break; }
  }
  if (hi < 0) return [];

  const out = [];
  for (let i = hi + 1; i < grid.length; i += 1) {
    const r = grid[i] || [];
    const name = clean(r[map.name]);
    if (!name || name.length < 2) continue;
    if (/^(total|sub ?total|grand total|amount|cgst|sgst|igst)/i.test(name)) continue;

    out.push({
      name: name.slice(0, 120),
      qty: map.qty !== undefined ? num(r[map.qty]) : 0,
      rate: map.rate !== undefined ? num(r[map.rate]) : 0,
      mrp: map.mrp !== undefined ? num(r[map.mrp]) : 0,
      unit: map.unit !== undefined ? clean(r[map.unit]).toUpperCase() : '',
      hsn: map.hsn !== undefined ? clean(r[map.hsn]) : '',
      pakka: true,
    });
  }
  return out;
}

/* ───────────────────────────────── PDF / photo ka text */

/**
 * Ek line se maal nikalna.
 *
 * Bill ki line aksar aisi hoti hai:
 *   "3  Parle-G Biscuit 100g   24 PCS   45.00   1080.00"
 *
 * Poora bharosa nahi kiya ja sakta, isliye jo mila wo `pakka: false` ke saath
 * jata hai — UI use peela nishaan dikhata hai aur aadmi khud jaanch leta hai.
 */
function fromLine(line) {
  const s = clean(line).replace(/\t/g, ' ');
  if (s.length < 4 || s.length > 200) return null;
  if (/^(total|sub ?total|grand|amount|cgst|sgst|igst|gstin|invoice|bill no|date|tax|qty|rate|sr\b|particulars)/i.test(s)) return null;

  const nums = s.match(/\d+(?:\.\d{1,2})?/g) || [];

  /*
    Maal ki line me kam se kam DO number hote hain — qty aur rate (aksar teen,
    total ke saath). Ek bhi number na ho to wo dukaan ka naam, pata ya header
    hai. Ye ek shart hi zyadatar kachra chhaan deti hai.
  */
  if (nums.length < 2) return null;

  /* Naam = shuru ka serial hata kar, aakhir ke saare number hata kar */
  let name = s.replace(/^\d+[.)]?\s+/, '');
  const hsn = (name.match(/\b\d{4,8}\b/) || [])[0] || '';
  name = clean(name
    .replace(/\b\d{4,8}\b/g, ' ')
    .replace(/(?:\s+[\d.,]+){1,4}\s*$/, '')
    .replace(/\b(pcs|nos|kg|gm|ltr|box|pkt|bag|dozen|bundle)\b/gi, ' '));

  if (!name || name.replace(/[^a-zA-Z]/g, '').length < 3) return null;

  /*
    Aakhri teen number aksar: qty, rate, total. Do hon to qty aur rate.

    Kaun sa qty hai aur kaun sa rate — ye DASHAMLAV se pata chalta hai, ginti
    se nahi. "50  22.00" me 50 qty hai aur 22.00 rate, chahe qty bada ho.
    Paise ke number me point hota hai, ginti me nahi.

    Phir bhi galti mumkin hai, isliye har line `pakka: false` ke saath jati
    hai aur aadmi use apni aankh se dekh kar hi add karta hai.
  */
  let [qs, rs] = nums.slice(-3);
  if (qs && rs && qs.includes('.') && !rs.includes('.')) { const t = qs; qs = rs; rs = t; }

  const qty = Number(qs) || 0;
  const rate = Number(rs) || 0;

  return {
    name: name.slice(0, 120),
    qty: Number.isInteger(qty) && qty > 0 && qty < 100000 ? qty : 0,
    rate: rate > 0 && rate < 1000000 ? rate : 0,
    mrp: 0,
    unit: ((s.match(/\b(PCS|NOS|KG|GM|LTR|BOX|PKT|BAG|DOZEN|BUNDLE)\b/i) || [])[0] || '').toUpperCase(),
    hsn,
    pakka: false,
  };
}

const fromText = (text) => String(text || '')
  .split(/\r?\n/)
  .map(fromLine)
  .filter(Boolean);

async function fromPdf(buffer) {
  const { PDFParse } = await import('pdf-parse');
  const p = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const { text } = await p.getText();
    return fromText(text);
  } finally {
    await p.destroy?.();
  }
}

const OCR_NA = 'Photo abhi padhi nahi ja rahi. Supplier se PDF ya Excel maang lein — '
  + 'unse hisaab bilkul theek nikalta hai.';

/**
 * Photo padhna — ALAG PROCESS ME.
 *
 * Tesseract apna kaam worker thread me karta hai, aur us thread ki koi bhi
 * gadbad seedha poora server gira deti hai — try/catch bhi nahi pakadta.
 * Isliye wo `scripts/ocr-run.js` me, apne alag process me chalta hai. Wo
 * gire to sirf wahi girta hai; dukaan ka kaam nahi rukta.
 *
 * 90 second se zyada lage to bhi maar dete hain — ek photo poora server
 * bandhak nahi bana sakti.
 */
async function fromImage(buffer) {
  if (!fs.existsSync(path.join(OCR_CACHE, 'eng.traineddata.gz'))) {
    throw ApiError.badRequest(OCR_NA);
  }

  const tmp = path.join(os.tmpdir(), `ocr-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fsp.writeFile(tmp, buffer);

  try {
    const out = await new Promise((resolve) => {
      const kid = spawn(process.execPath, [OCR_SCRIPT, tmp], {
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      let buf = '';
      const timer = setTimeout(() => kid.kill('SIGKILL'), 90_000);

      kid.stdout.on('data', (c) => { if (buf.length < 100_000) buf += c; });
      kid.on('error', () => { clearTimeout(timer); resolve(''); });
      kid.on('close', () => { clearTimeout(timer); resolve(buf); });
    });

    let text = '';
    try { text = JSON.parse(out || '{}').text || ''; } catch { text = ''; }
    if (!text.trim()) throw ApiError.badRequest(OCR_NA);

    return fromText(text);
  } finally {
    await fsp.unlink(tmp).catch(() => {});
  }
}

/* ───────────────────────────────── ek darwaza */

export async function parseFile(file) {
  if (!file?.buffer?.length) throw ApiError.badRequest('Koi file nahi mili');

  const name = String(file.originalname || '').toLowerCase();
  const type = String(file.mimetype || '').toLowerCase();

  let rows = [];
  let kaise = '';

  if (/\.(xlsx|xls|csv)$/.test(name) || /sheet|excel|csv/.test(type)) {
    rows = await fromSheet(file.buffer);
    kaise = 'excel';
  } else if (/\.pdf$/.test(name) || type.includes('pdf')) {
    rows = await fromPdf(file.buffer);
    kaise = 'pdf';
    // Scan kiya hua PDF — usme text hota hi nahi, tab OCR
    if (!rows.length) { rows = await fromImage(file.buffer); kaise = 'pdf-photo'; }
  } else if (type.startsWith('image/')) {
    rows = await fromImage(file.buffer);
    kaise = 'photo';
  } else {
    throw ApiError.badRequest('Sirf Excel, CSV, PDF ya photo chalti hai');
  }

  if (!rows.length) {
    throw ApiError.badRequest(
      kaise === 'excel'
        ? 'Is file me maal ki list nahi mili — dekh lein ki ek column ka naam "name" ya "item" ho'
        : 'Is file se kuch padha nahi gaya. Saaf photo lein, ya Excel/PDF se try karein.',
    );
  }
  if (rows.length > 500) rows = rows.slice(0, 500);

  return { rows, kaise };
}

/**
 * Har line ka apne maal se milan.
 *
 * Ye sirf BATATA hai ki wahi naam pehle se hai — khud kuch tay nahi karta.
 * Faisla aadmi ka: "isi ka stock badha do" ya "naam badal kar naya bana do".
 */
export async function matchRows(businessId, rows) {
  const items = await Item.find({ businessId })
    .select('name unit purchasePrice salePrice stock').lean();

  const byKey = new Map(items.map((i) => [key(i.name), i]));

  return rows.map((r, i) => {
    const hit = byKey.get(key(r.name));
    return {
      id: i,
      ...r,
      unit: UNITS.includes(r.unit) ? r.unit : 'PCS',
      milaHua: hit ? {
        _id: hit._id,
        name: hit.name,
        stock: hit.stock || 0,
        purchasePrice: hit.purchasePrice || 0,
        salePrice: hit.salePrice || 0,
      } : null,
    };
  });
}

/**
 * Jo aadmi ne tay kiya, wahi hota hai.
 *
 * Har line ka `kya`:
 *   'naya'   — naya item banega (naam badla ho to wahi chalega)
 *   'stock'  — jo item pehle se hai, usi ka stock badhega
 *   'chhodo' — kuch nahi
 *
 * Ek line ki gadbad baaki lines ko nahi rokti. 200 line me se ek ka naam
 * khali reh jaye to us ek ko chhod kar baaki chadh jate hain — poora kaam
 * dobara karwana usse bahut bura hai.
 */
export async function commitRows(businessId, decisions, userId) {
  if (!Array.isArray(decisions) || !decisions.length) {
    throw ApiError.badRequest('Kuch chuna hi nahi gaya');
  }
  if (decisions.length > 500) throw ApiError.badRequest('Ek baar me 500 se zyada nahi');

  const cat = await Category.findOne({ businessId }).select('_id').lean();

  const nateeja = { naye: 0, stockBadha: 0, chhode: 0, gadbad: [] };

  for (const d of decisions) {
    try {
      if (d.kya === 'chhodo') { nateeja.chhode += 1; continue; }

      const qty = Math.max(0, Number(d.qty) || 0);

      if (d.kya === 'stock') {
        if (!d.itemId) throw new Error('kaunsa item, ye nahi mila');
        if (qty > 0) {
          await applyStockChange({
            businessId,
            itemId: d.itemId,
            type: STOCK_MOVEMENT_TYPES.ADJUSTMENT,
            qty,
            note: 'File se add kiya',
            userId,
          });
        }
        // Rate bhara ho to lagat/bikri bhi taaza kar dete hain
        const patch = {};
        if (Number(d.rate) > 0) patch.purchasePrice = Number(d.rate);
        if (Number(d.salePrice) > 0) patch.salePrice = Number(d.salePrice);
        if (Object.keys(patch).length) {
          await Item.updateOne({ _id: d.itemId, businessId }, { $set: patch });
        }
        nateeja.stockBadha += 1;
        continue;
      }

      const nm = clean(d.name).slice(0, 120);
      if (!nm) throw new Error('naam khali hai');
      if (await Item.exists({ businessId, name: nm })) {
        throw new Error(`"${nm}" is naam ka item pehle se hai`);
      }

      await Item.create({
        businessId,
        name: nm,
        unit: UNITS.includes(d.unit) ? d.unit : 'PCS',
        hsn: clean(d.hsn).slice(0, 10),
        purchasePrice: Number(d.rate) || 0,
        salePrice: Number(d.salePrice) || 0,
        mrp: Number(d.mrp) || 0,
        stock: qty,
        openingStock: qty,
        categoryId: cat?._id || null,
      });
      nateeja.naye += 1;
    } catch (err) {
      nateeja.gadbad.push({ name: d.name || '(bina naam)', kyun: err.message });
    }
  }

  return nateeja;
}
