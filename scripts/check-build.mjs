/**
 * Build ke baad ek chhoti si jaanch.
 *
 * Deploy pe sabse bura ye hota hai ki build "successful" dikhe par client ka
 * dist bana hi na ho — phir site khulti hai to sirf JSON dikhta hai aur samajh
 * nahi aata kya galat hua. Isliye yahin rok dete hain, saaf wajah ke saath.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'client', 'dist');
const INDEX = path.join(DIST, 'index.html');

const die = (msg, hint) => {
  console.error(`\n✖ Build adhoora hai: ${msg}`);
  if (hint) console.error(`  ${hint}`);
  console.error('');
  process.exit(1);
};

if (!fs.existsSync(INDEX)) {
  die(
    'client/dist/index.html nahi bani.',
    'Upar ke log me "vite: not found" dhoondhein — aisa ho to build ke waqt devDependencies install nahi hui.'
  );
}

const assetsDir = path.join(DIST, 'assets');
const assets = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];
if (!assets.some((f) => f.endsWith('.js'))) die('client/dist/assets me koi JS file nahi mili.');
if (!assets.some((f) => f.endsWith('.css'))) die('client/dist/assets me koi CSS file nahi mili.');

// Bundle me kisi bhi haal me localhost nahi hona chahiye — warna live site
// browser se localhost:5000 maangegi aur har API call fail hogi.
const badFiles = assets
  .filter((f) => f.endsWith('.js'))
  .filter((f) => fs.readFileSync(path.join(assetsDir, f), 'utf8').includes('localhost:5000'));

if (badFiles.length) {
  die(
    `bundle me localhost ka pata chhap gaya (${badFiles.join(', ')}).`,
    'client/.env me VITE_API_URL set hai — use hata dein, app khud relative /api use kar leta hai.'
  );
}

const kb = (p) => Math.round(fs.statSync(p).size / 1024);
console.log(`\n✔ Client build tayyar — ${assets.length} files, index.html ${kb(INDEX)} kB`);
console.log('  Server isi ko serve karega, isliye client aur API dono ek hi URL pe chalenge.\n');
