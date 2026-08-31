/*
  OCR ALAG PROCESS ME CHALTA HAI — jaan-boojh kar.

  Tesseract apna kaam ek worker thread me karta hai. Us thread me kuch bhi
  galat ho — bhasha-data na mile, memory kam pad jaye, wasm gir jaye — to wo
  error SEEDHA POORE SERVER KO GIRA DETA HAI. try/catch use nahi pakadta,
  kyunki wo hamare code ki line se nahi aata.

  Isliye wo yahan, ek alag process me chalta hai. Ye gire to sirf ye girta
  hai; dukaan ka server chalta rehta hai aur aadmi ko saaf jawab milta hai.

  Chalane ka tarika:  node scripts/ocr-run.js <image-file>
  Wapas:              stdout par JSON — {"text": "..."} ya {"error": "..."}
*/
import fs from 'fs';

const CACHE = new URL('../ocr-data/', import.meta.url).pathname;

async function main() {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) throw new Error('file nahi mili');

  /*
    langPath = apni hi folder. gzip = file .gz hai. cacheMethod 'none' isliye
    ki wo 15 MB khol kar disk pe dobara likhta hai — Render pe har deploy pe
    wo disk saaf ho jati hai, to likhne ka koi fayda nahi, sirf jagah jati hai.
  */
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    langPath: CACHE.replace(/\/$/, ''),
    gzip: true,
    cacheMethod: 'none',
    logger: () => {},
    errorHandler: () => {},
  });
  try {
    const { data } = await worker.recognize(fs.readFileSync(file));
    process.stdout.write(JSON.stringify({ text: data?.text || '' }));
  } finally {
    await worker.terminate().catch(() => {});
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    process.stdout.write(JSON.stringify({ error: String(err?.message || err) }));
    process.exit(1);
  },
);
