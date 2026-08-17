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
 * 2. Anuvaad me chhoote hue shabd.
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
      if (arg && arg.type === 'StringLiteral') used.add(arg.value);
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

const missing = [...used].filter((k) => !known.has(k) && !skip.has(k));
const pct = used.size ? Math.round(((used.size - missing.length) / used.size) * 100) : 100;

console.log(`\ni18n: ${used.size} shabd istemal me, ${used.size - missing.length} anuvaad ho chuke (${pct}%)`);
if (missing.length && process.argv.includes('--missing')) {
  console.log(missing.map((m) => `  - ${m}`).join('\n'));
  fs.writeFileSync('/tmp/i18n-missing.json', JSON.stringify(missing, null, 1));
}
if (risky) console.log(`${risky} jagah \`t\` naam ka apna variable hai (abhi kaam kar raha hai)`);

if (errors) {
  console.error(`\n${errors} ghalti — theek karke dobara chalayein`);
  process.exit(1);
}
console.log('i18n jaanch theek');
