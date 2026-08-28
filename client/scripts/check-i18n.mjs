/**
 * DO CHEEZEIN JO BUILD KABHI NAHI PAKADTI.
 *
 * 1. `t` par chhaya (shadow).
 *
 *    Bahut jagah likha hota hai `TABS.map((t) => ...)`. Us block ke andar `t`
 *    ab anuvaad wala function nahi, wo tab ka object hai. Agar kisi ne wahin
 *    `t('Kuch')` likh diya to build bilkul theek chalti hai — aur browser me
 *    page khulte hi "t is not a function" aakar poora page safed kar deta hai.
 *
 *    Ye jaanch us block ke andar likhe `t()` ko pakadti hai, aur un naamon ko
 *    bhi bata deti hai jo aage chal kar ye ghalti bana sakte hain.
 *
 * 2. Wo text jo `t()` tak pahunchta HI NAHI.
 *
 *    Ye sabse chupa hua tha. Purani jaanch sirf `t('...')` ke andar wale shabd
 *    ginti thi — yani "100%" ka matlab tha "jo wrap kiya gaya wo poora ho
 *    gaya", na ki "screen pe sab kuch anuvaad ho gaya". Jo line seedha JSX me
 *    likh di gayi (`<p>Kul dena</p>`) wo ginti me aati hi nahi thi, aur
 *    English chun kar bhi Hinglish hi dikhti rehti.
 *
 *    Isliye ab JSX ka seedha text aur user ko dikhne wale attribute
 *    (placeholder, title, aria-label, label) bhi pakde jate hain.
 *
 * 3. Anuvaad me chhoote hue shabd.
 *
 *    `t('...')` me jo shabd hai wo dictionary me hai ya nahi. Na ho to app
 *    tooti nahi (Hinglish hi dikhega), par ginti saamne rehni chahiye — warna
 *    "Hindi kar do" kehne wale ko aadha Hinglish milta hai aur pata nahi
 *    chalta ki kitna bacha hai.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;

function listFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(p, out);
    else if (/\.jsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = listFiles('src');
const used = new Set();

/*
  Har shabd kis kis file me mila — kanooni kagaz alag ginne ke liye chahiye.
  (Neeche `LEGAL_DIRS` wala hissa isi se chalta hai.)
*/
const usedIn = new Map();
let currentFile = '';
const noteUse = (key) => {
  if (!usedIn.has(key)) usedIn.set(key, new Set());
  usedIn.get(key).add(currentFile);
};
const unwrapped = [];

// User ko DIKHNE wale attribute. `className`, `id`, `type` jaise nahi.
/*
  Wo attribute jinki value SEEDHE SCREEN PE CHHAPTI hai.

  Ye list pehle chhoti thi. Phir scan karne pe pata chala ki apne hi UI
  component ke aadhe prop is list se bahar the — `subtitle`, `message`,
  `sub`, `confirmLabel`, `createNewLabel`. Yani PageHeader ka subtitle aur
  EmptyState ka message jaanch se bach kar Hinglish me hi chhapte rahe,
  jabki ginti "100%" bol rahi thi.

  Naya visible-text wala prop banayein to uska naam yahan bhi likh dein —
  warna jaanch use dekhegi hi nahi.
*/
const VISIBLE_ATTRS = new Set([
  'placeholder', 'title', 'aria-label', 'label', 'alt', 'emptyText', 'hint',
  'subtitle', 'message', 'sub', 'confirmLabel', 'cancelLabel', 'createNewLabel',
]);

/*
  Ye text anuvaad maangta hai ya nahi.

  Chhodne layak: khali/chinh wala text, ek-do akshar, aur wo shabd jo teeno
  zubaan me ek jaise likhe jate hain. Inhe pakadna sirf shor banata hai.
*/
const SAME_IN_ALL = new Set([
  'GST', 'GSTIN', 'HSN', 'UPI', 'PDF', 'CSV', 'SKU', 'IFSC', 'QR', 'OTP', 'WhatsApp',
  'IGST', 'CGST', 'SGST', 'MRP', 'Email', 'PCS', 'KG', 'Rakh Rakhav',
]);

/*
  Ek `t(naam)` ke peeche jitni bhi seedhi string ho sakti hai, sab uthao.

  Sirf string aur ternary — `a ? 'x' : 'y'`, aur uske andar phir ternary.
  Isse aage (function call, koi object ka field) hum nahi jate: wahan sach me
  pata nahi chalta ki chalega kya, aur andaza lagakar chaabi banane se ginti
  jhoothi ho jayegi. Ginti ka poora matlab hi ye hai ki uspe bharosa ho.
*/
function collectStrings(node, out) {
  if (!node) return;
  if (node.type === 'StringLiteral') { out.add(node.value); return; }
  if (node.type === 'ConditionalExpression') {
    collectStrings(node.consequent, out);
    collectStrings(node.alternate, out);
  }
}

function translatable(txt) {
  const s2 = txt.replace(/\s+/g, ' ').trim();
  if (s2.length < 3) return false;                    // '—', '·', 'ok'
  if (!/[a-zA-Z]{3}/.test(s2)) return false;          // sirf number/chinh
  if (SAME_IN_ALL.has(s2)) return false;
  if (/^\{/.test(s2)) return false;                   // JSX expression
  return true;
}
let errors = 0;
let risky = 0;

/*
  HAR file dekhni hai, sirf wo nahi jisme i18n ka import maujood hai.

  Pehle yahan ek shart thi: "jis file me `from '@/lib/i18n'` likha ho, sirf
  wahi jaancho". Wo ulti pad gayi — kyunki jo file `t('...')` likhti hai par
  import karna BHOOL jati hai, wo bilkul yahi file hoti hai jo browser me
  "t is not defined" dekar poora page safed kar deti hai. Aur jaanch usi ko
  chhod deti thi.

  Aisa ek baar sach me hua: Combobox me `aria-label={t('Band karein')}` likha
  gaya, import chhoot gaya, aur `npm run check` khush raha. Pakda tab jab bill
  banate waqt item ka box khulna hi band ho gaya.

  Isliye ab shart hai: file me `t(` dikhe — chahe import ho ya na ho — to
  jaanch hogi.
*/
for (const file of files) {
  currentFile = file;
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes("from '@/lib/i18n'") && !/\bt\(/.test(src)) continue;

  let ast;
  try {
    ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });
  } catch (err) {
    console.error(`✗ ${file} padhi nahi gayi: ${err.message}`);
    errors += 1;
    continue;
  }

  traverse(ast, {
    CallExpression(p) {
      const callee = p.node.callee;
      if (callee.type !== 'Identifier' || callee.name !== 't') return;

      const binding = p.scope.getBinding('t');
      if (!binding) {
        console.error(`✗ ${file}:${p.node.loc.start.line}  \`t\` istemal hua par import nahi — page khulte hi "t is not defined" aayega`);
        errors += 1;
        return;
      }
      if (binding.kind !== 'module') {
        console.error(`✗ ${file}:${p.node.loc.start.line}  yahan \`t\` anuvaad wala nahi hai — page khulte hi tootega`);
        errors += 1;
        return;
      }

      const arg = p.node.arguments[0];
      if (arg && arg.type === 'StringLiteral') { used.add(arg.value); noteUse(arg.value); return; }

      /*
        `t(title)` — chaabi seedhe likhi nahi hai, ek variable me hai.

        Ye chup-chaap wali khai hai. TrendChart ne bilkul theek kiya tha:
        `t(title)` se chhapa. Par `title` ka default value uske apne
        parameter me pada tha —

            function TrendChart({ title = 'Pichhle 14 din' })

        — aur jaanch parameter ke default ko dekhti hi nahi thi. Nateeja:
        wo shabd kabhi "istemal me" gina hi nahi gaya, kitaab me uska
        anuvaad kabhi maanga hi nahi gaya, aur English chunne par screen pe
        Hinglish me hi chhapta raha — jabki ginti 100% bol rahi thi.

        Isliye ab: agar `t()` ko koi apna hi parameter diya gaya hai jiska
        default ek seedhi string hai, to us default ko bhi chaabi maan lete
        hain. Bahar se aane wali value pe hamara bas nahi — par default
        kam se kam pakda jayega.
      */
      if (arg && arg.type === 'Identifier') {
        const node = p.scope.getBinding(arg.name)?.path?.node;

        // `function F({ title = '...' })` — ObjectPattern ke andar dhoondho
        const props = node?.type === 'ObjectPattern' ? node.properties : [];
        for (const pr of props) {
          if (pr.type !== 'ObjectProperty' || pr.key?.name !== arg.name) continue;
          const v = pr.value;
          if (v?.type === 'AssignmentPattern' && v.right?.type === 'StringLiteral') { used.add(v.right.value); noteUse(v.right.value); }
        }
        // `function F(title = '...')` — seedha parameter
        if (node?.type === 'AssignmentPattern' && node.right?.type === 'StringLiteral') {
          used.add(node.right.value); noteUse(node.right.value);
        }
        /*
          `const greet = subah ? 'Subah bakhair' : 'Namaste'` — phir `t(greet)`.

          Dashboard pe bilkul yahi tha. Teeno salaam kabhi ginti me aaye hi
          nahi, kitab me daale hi nahi gaye, aur English chunne par bhi
          "Namaste, Ramesh" hi chhapta raha. Screenshot me pakda gaya, jaanch
          me nahi — isliye ab jaanch ise bhi dekhti hai.
        */
        if (node?.type === 'VariableDeclarator') collectStrings(node.init, used);
      }
    },

    /*
      JSX me seedha likha hua text — jo `t()` se guzra hi nahi.

      Kuch cheezein jaan-boojh kar chhodi hain: sirf number/chinh (`—`, `·`,
      `₹`), ek-do akshar, aur wo shabd jo teeno zubaan me ek jaise hain
      (GST, HSN, UPI, PDF...). Unhe pakadna shor paida karta hai aur asli
      chhoot us shor me dab jati hai.
    */
    JSXText(p) {
      const raw = p.node.value.trim();
      if (!raw || !translatable(raw)) return;
      unwrapped.push(`${file}:${p.node.loc.start.line}  ${raw.slice(0, 60)}`);
    },

    JSXAttribute(p) {
      const name = p.node.name?.name;
      if (!VISIBLE_ATTRS.has(name)) return;
      const v = p.node.value;
      if (!v || v.type !== 'StringLiteral') return;
      if (!translatable(v.value)) return;
      unwrapped.push(`${file}:${p.node.loc.start.line}  ${name}="${v.value.slice(0, 50)}"`);
    },

    Scopable(p) {
      // `t` khud jahan banta hai (lib/i18n.js) wo chetavni nahi hai
      if (file.replace(/\\/g, '/').endsWith('src/lib/i18n.js')) return;
      // sirf chetavni — abhi tootta nahi, par aage tod sakta hai
      const own = p.scope.bindings?.t;
      if (own && own.kind !== 'module') {
        console.warn(`! ${file}:${own.identifier.loc.start.line}  \`t\` naam ka apna variable — use \`tab\`/\`tick\` jaisa naam dein`);
        risky += 1;
      }
    },
  });
}

// ── anuvaad ki ginti ──
const dictSrc = fs.readFileSync('src/lib/dict.js', 'utf8');
const dictAst = parse(dictSrc, { sourceType: 'module' });
const known = new Set();
traverse(dictAst, {
  ObjectProperty(p) {
    if (p.parentPath.parentPath?.node?.id?.name !== 'DICT') return;
    // `'Naya bill':` bhi aur `Rate:` bhi — dono ek hi cheez hain
    const k = p.node.key;
    if (k.type === 'StringLiteral') known.add(k.value);
    else if (k.type === 'Identifier' && !p.node.computed) known.add(k.name);
  },
});

/*
  Jinka anuvaad jaan-boojh kar nahi kiya (naam, misaal, short-form) unhe ginti
  se bahar rakhte hain — taaki ye ginti 100% tak pahunch sake aur us par
  bharosa bana rahe.
*/
const skip = new Set();
for (const m of dictSrc.matchAll(/export const NO_TRANSLATE = new Set\(\[([\s\S]*?)\]\)/g)) {
  for (const q of m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) skip.add(q[1].replace(/\\'/g, "'"));
}

/*
  KANOONI KAGAZ ALAG GINE JATE HAIN — aur ye ek soch-samajh kar liya faisla hai.

  Privacy, Terms, Refund, Delivery aur Contact — in paanch page ka text
  kanooni hai. Uska anuvaad AADMI karta hai, andaze se nahi hota. Ek galat
  anuvaad wali refund policy sirf ek adhoora feature nahi — wo seedha kanooni
  zimmedari hai, aur wo galti us din pakdi jati hai jis din koi paisa maangta
  hai.

  Isliye ye page `t()` me lipte hue hain (taaki jis din asli anuvaad aaye, wo
  bina code chhue lag jaye), par upar wali ginti me nahi aate. Ginti app ke
  apne shabdon ki hai; kanooni kagaz ki halat NEECHE alag se chhapti hai,
  chhupti nahi.
*/
const LEGAL_DIRS = ['src/pages/public/'];
const legalUsed = new Set();
for (const [key, files] of usedIn.entries()) {
  if ([...files].every((f) => LEGAL_DIRS.some((d) => f.startsWith(d)))) legalUsed.add(key);
}
for (const k of legalUsed) used.delete(k);

const missing = [...used].filter((k) => !known.has(k) && !skip.has(k));
const legalMissing = [...legalUsed].filter((k) => !known.has(k) && !skip.has(k));
const looseAllowed = new Set(
  (fs.existsSync('scripts/i18n-allow.txt')
    ? fs.readFileSync('scripts/i18n-allow.txt', 'utf8').split('\n')
    : []).map((l) => l.trim()).filter(Boolean),
);
const loose = unwrapped.filter((u) => !looseAllowed.has(u.split('  ').slice(1).join('  ')));

/*
  100% SIRF TAB jab sach me ek bhi shabd na bacha ho.

  Pehle yahan seedha `Math.round` tha. 718/720 = 99.7% → round hoke "100%"
  chhapta tha, jabki do shabd bache the. Ek aisi ginti jo galat halat me bhi
  100% bolti hai, wo ginti nahi — dilasa hai. Do din me log usse dekhna hi
  chhod dete hain.
*/
const done = used.size - missing.length;
const raw = used.size ? (done / used.size) * 100 : 100;
const pct = missing.length && raw > 99 ? 99 : Math.round(raw);

console.log(`\ni18n: ${used.size} shabd istemal me, ${used.size - missing.length} anuvaad ho chuke (${pct}%)`);
if (missing.length && process.argv.includes('--missing')) {
  console.log(missing.map((m) => `  - ${m}`).join('\n'));
  fs.writeFileSync('/tmp/i18n-missing.json', JSON.stringify(missing, null, 1));
}
if (legalMissing.length) {
  console.log(
    `kanooni kagaz: ${legalMissing.length} line abhi sirf Hinglish me hai `
    + '(inka anuvaad aadmi se karwana hai — andaze se nahi)',
  );
}
if (risky) console.log(`${risky} jagah \`t\` naam ka apna variable hai (abhi kaam kar raha hai)`);

/*
  Jo text `t()` tak pahunchta hi nahi.

  Ye upar wali ginti me kabhi aata hi nahi tha — isliye "100%" ke baad bhi
  English chun kar Hinglish dikh jati thi. Ab ye alag se ginte hain aur GALTI
  maante hain, chetavni nahi: chetavni ko log do din me dekhna chhod dete hain.
*/
if (loose.length) {
  console.error(`\n${loose.length} jagah text \`t()\` se bahar hai — English chunne par ye Hinglish hi rahega:`);
  console.error(loose.map((u) => `  ✗ ${u}`).join('\n'));
  fs.writeFileSync('/tmp/i18n-loose.txt', loose.join('\n'));
  errors += loose.length;
}

if (errors) {
  console.error(`\n${errors} ghalti — theek karke dobara chalayein`);
  process.exit(1);
}
console.log('i18n jaanch theek');
