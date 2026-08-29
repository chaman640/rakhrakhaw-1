/*
  Build ke baad chalti hai: ghar ke page ka asli HTML nikal kar index.html me
  daal deti hai. Wajah `src/entry-prerender.jsx` me likhi hai.

  Ye kaam bina browser ke hota hai — react-dom/server se. Isliye Render pe
  bhi chalta hai, jahan Chrome nahi hota.

  Kuch bhi gadbad ho to build ROKTI NAHI. Prerender ek fayda hai, shart nahi —
  iske bina bhi app poori tarah chalta hai, bas Google ko dobara aana padta
  hai. Ek chhoti si SEO cheez ki wajah se poora deploy rok dena galat sauda
  hai.
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const indexFile = path.join(root, 'dist', 'index.html');
const ssrEntry = path.join(root, 'dist-ssr', 'entry-prerender.js');

const bye = (why) => {
  console.warn(`prerender: chhod diya — ${why}`);
  process.exit(0);
};

if (!fs.existsSync(indexFile)) bye('dist/index.html nahi mila');
if (!fs.existsSync(ssrEntry)) bye('dist-ssr build nahi mila');

let markup = '';
try {
  const mod = await import(`file://${ssrEntry}`);
  markup = mod.render();
} catch (err) {
  bye(`render fail: ${err.message}`);
}

if (!markup || markup.length < 500) bye('HTML bahut chhota nikla');

const html = fs.readFileSync(indexFile, 'utf8');
if (!html.includes('<div id="root"></div>')) bye('root wala dabba nahi mila');

/*
  ALAG FILE, index.html ke UPAR nahi.

  Pehle ye HTML seedha index.html me daala tha — par wahi file HAR route pe
  jati hai. Matlab /login kholne pe pehle ghar ka page jhalakta, phir React
  use hata kar login dikhata. Ek jhilmilahat, har baar, har page pe — sirf
  ek SEO fayde ke liye.

  Isliye ghar ka page apni alag file me jata hai. Server use SIRF `/` pe
  bhejta hai (app.js dekhein). Baaki har route ko wahi purana khali dabba
  milta hai, bilkul pehle jaisa.
*/
fs.writeFileSync(
  path.join(root, 'dist', 'home.html'),
  html.replace('<div id="root"></div>', `<div id="root">${markup}</div>`),
  'utf8',
);

fs.rmSync(path.join(root, 'dist-ssr'), { recursive: true, force: true });

const kb = (markup.length / 1024).toFixed(0);
console.log(`✔ dist/home.html bana (${kb} kB) — Google ko \`/\` pe pehli baari me hi poora page milega`);
