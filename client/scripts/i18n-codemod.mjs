/**
 * EK BAAR CHALNE WALA AUZAAR — JSX ke andar likhe text ko `t('...')` me lapetta hai.
 *
 * Ye script apne aap kuch anuvaad nahi karti. Ye sirf itna karti hai ki har
 * dikhne wala shabd `t()` ke andar chala jaye, taaki baad me bhasha badalne
 * par wo shabd badal sake. Kyunki `t()` Hinglish me wahi shabd wapas deta hai
 * jo usme daala gaya tha, is badlav ke baad app HUBAHU pehle jaisi hi dikhti
 * hai — jab tak koi bhasha na badle.
 *
 *   node scripts/i18n-codemod.mjs --list    → sirf shabd ginti/nikalti hai
 *   node scripts/i18n-codemod.mjs --write   → files me badlav likhti hai
 *
 * Ek baat khaas: yahan @babel/generator ka istemal JAAN BOOJH KAR nahi kiya.
 * Wo poori file dobara likh deta — indentation, quotes, sab kuch badal jata
 * aur asli badlav diff me doob jata. Iske bajaye hum sirf un jagahon ke
 * (shuru, ant) nishaan nikalte hain jahan badlav chahiye, aur wahin par kaat
 * kar jodte hain. Baaki file byte-to-byte waisi hi rehti hai.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;

const ROOT = 'src';

/** Retailer wale page abhi haath nahi lagane — unka apna update alag aayega */
const SKIP = [
  'src/pages/retailer/',
  'src/lib/i18n.js',
];

/** In props ki value user ko dikhti hai — inhe bhi lapetna hai */
const TEXT_PROPS = new Set([
  'placeholder', 'title', 'subtitle', 'label', 'header', 'message',
  'aria-label', 'emptyText', 'confirmText', 'cancelText', 'okText',
  'description', 'hint', 'tooltip', 'alt',
]);

/**
 * Config object ki wo chaabiyan jinki value screen pe dikhti hai.
 *
 * `name` jaan-boojh kar nahi hai — wo aksar form ke khaane ka naam hota hai
 * (`name: 'phone'`), dikhne wala shabd nahi. Use lapet dete to form hi toot
 * jata.
 */
const DISPLAY_KEYS = new Set([
  'label', 'header', 'title', 'subtitle', 'text', 'hint', 'sub',
  'message', 'emptyText', 'placeholder', 'confirmLabel',
]);

/** Jo text asli me text hai hi nahi */
function isMeaningful(raw) {
  const s = raw.trim();
  if (s.length < 2) return false;
  if (!/[A-Za-zऀ-ॿ]/.test(s)) return false;   // sirf number/chinh — chhod do
  if (/^[A-Z]{1,4}$/.test(s) && !/[a-z]/.test(s)) {
    // GST, HSN, SKU, UPI, CSV... in short-forms ka anuvaad hota hi nahi
    return false;
  }
  return true;
}

function listFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(p, out);
    else if (/\.jsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const write = process.argv.includes('--write');
const files = listFiles(ROOT).filter((f) => !SKIP.some((s) => f.replace(/\\/g, '/').startsWith(s)));

const found = new Map();     // shabd -> kitni baar
let changedFiles = 0;
let edits = 0;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  if (!/<[A-Za-z]/.test(src)) continue;

  let ast;
  try {
    ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });
  } catch (err) {
    console.error(`PARSE FAIL ${file}: ${err.message}`);
    process.exitCode = 1;
    continue;
  }

  /** @type {{start:number,end:number,text:string}[]} */
  const patches = [];

  traverse(ast, {
    JSXText(p) {
      const raw = p.node.value;
      if (!isMeaningful(raw)) return;

      /*
        SIRF POORA VAAKYA — aadha nahi.

        Ye sabse zaroori niyam hai. Bahut jagah likha hota hai:

            <p>{n} item ka stock kam hai</p>

        Agar hum yahan se sirf "item ka stock kam hai" utha lein, to Hindi me
        wo tukda apni jagah pe fit hi nahi hoga — Hindi ka vakya-kram alag hai,
        aur number aage-peeche chala jayega. Aadha anuvaad poore anuvaad se
        bura hota hai: aadmi ko lagta hai app tooti hui hai.

        Isliye niyam: jis element ke andar text ke alawa aur kuch bhi ho
        (number, koi doosra tag), usse haath nahi lagate. Wo Hinglish me hi
        rahega — jo waise bhi dono taraf ke logon ko padh me aa jati hai.
      */
      const siblings = p.parent.children || [];
      const others = siblings.filter((c) => {
        if (c === p.node) return false;
        if (c.type === 'JSXText') return c.value.trim().length > 0;
        return true;                              // expression ya doosra tag
      });
      if (others.length) return;

      /*
        JSX me text ke aage-peeche ki khali jagah aur nayi line matlab rakhti
        hai (do shabdon ke beech ka space). Isliye hum sirf BEECH ka hissa
        badalte hain aur aage-peeche ki jagah jaisi ki waisi chhod dete hain.
      */
      const lead = raw.length - raw.trimStart().length;
      const trail = raw.length - raw.trimEnd().length;
      const text = raw.slice(lead, raw.length - trail);

      // `&amp;` jaisi cheezein JSX khud kholta hai — inhe chhod dena hi theek
      if (/&[a-z]+;|&#\d+;/i.test(text)) return;

      patches.push({
        start: p.node.start + lead,
        end: p.node.end - trail,
        // Lambi madad wali line kai line me tooti hoti hai. Key me wo saari
        // nayi line aur indentation ghus jati — isliye use ek space bana dete
        // hain. Dikhne me farak nahi padta, JSX khud yahi karta hai.
        text: text.replace(/\s+/g, ' '),
      });
    },

    /*
      Config wale object me likhe shabd — `{ label: 'Sale' }` jaise.

      Ye JSX ke andar nahi hote, isliye upar wala niyam inhe nahi pakadta. Par
      dikhte poore page pe hain: tab ke naam, chip ke naam, table ke column ke
      sar, dashboard ke tile.

      EK SHART: ye object kisi function ke ANDAR hona chahiye. Module ke top pe
      pade constant sirf EK BAAR banta hai — app khulte waqt. Waha `t()` likh
      dete to wo us waqt ki bhasha me jam jata aur bhasha badalne par bhi wahi
      purana shabd dikhata rehta. Aise upar wale constant ka ilaaj alag hai:
      unhe DIKHATE waqt lapetа jata hai (Tabs, Chips, Table ke andar).
    */
    ObjectProperty(p) {
      const k = p.node.key;
      const name = k.type === 'Identifier' ? k.name
        : (k.type === 'StringLiteral' ? k.value : null);
      if (!DISPLAY_KEYS.has(name)) return;
      if (p.node.value.type !== 'StringLiteral') return;
      if (!p.getFunctionParent()) return;              // module ke top pe — chhodo

      const v = p.node.value;
      if (!isMeaningful(v.value)) return;
      if (v.value.includes("'")) return;

      // yahan seedha `t('...')` — bina brace ke. Brace sirf JSX ke andar chahiye.
      patches.push({ start: v.start, end: v.end, text: v.value, bare: true });
    },

    JSXAttribute(p) {
      const name = p.node.name;
      const attr = name.type === 'JSXNamespacedName'
        ? `${name.namespace.name}:${name.name.name}`
        : name.name;
      if (!TEXT_PROPS.has(attr)) return;
      const v = p.node.value;
      if (!v || v.type !== 'StringLiteral') return;
      if (!isMeaningful(v.value)) return;
      if (v.value.includes("'")) return;      // quote ki jhanjhat — haath se karenge

      patches.push({ start: v.start, end: v.end, text: v.value, attr: true });
    },
  });

  if (!patches.length) continue;

  patches.sort((a, b) => b.start - a.start);   // peeche se aage — offset na khiske
  let out = src;
  for (const p of patches) {
    const safe = p.text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const replacement = p.bare ? `t('${safe}')` : `{t('${safe}')}`;
    out = out.slice(0, p.start) + replacement + out.slice(p.end);
    found.set(p.text, (found.get(p.text) || 0) + 1);
    edits += 1;
  }

  /*
    import add karo (agar pehle se na ho).

    Yahan ek ghalti ho chuki hai, isliye likh rahe hain: pehle "aakhri line jo
    `import` se SHURU hoti hai" dhoondhi jati thi. Par import kai line ka bhi
    hota hai —

        import {
          PageHeader, Card, Button,
        } from '@/components/ui';

    — aur uska pehla hi line `import` se shuru hota hai. Nayi line usi ke
    theek neeche, yaani BRACE KE ANDAR chali jati thi, aur file hi toot jati.
    Isliye ab hum shuruat nahi, ANT dhoondhte hain: wo line jo `from '...';`
    pe khatam hoti hai.
  */
  if (!/from '@\/lib\/i18n'/.test(out)) {
    const lines = out.split('\n');
    let last = -1;
    for (let i = 0; i < Math.min(lines.length, 60); i += 1) {
      if (/from '[^']+';\s*$/.test(lines[i]) || /^import '[^']+';\s*$/.test(lines[i])) last = i;
    }
    lines.splice(last + 1, 0, "import { t } from '@/lib/i18n';");
    out = lines.join('\n');
  }

  changedFiles += 1;
  if (write) fs.writeFileSync(file, out);
}

const words = [...found.keys()].sort((a, b) => a.localeCompare(b));
console.log(`files: ${changedFiles}   edits: ${edits}   distinct: ${words.length}`);
fs.writeFileSync('/tmp/i18n-words.json', JSON.stringify(words, null, 1));
if (!write) console.log('(dry run — kuch likha nahi gaya)');
