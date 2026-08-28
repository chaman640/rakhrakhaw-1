// Bina import kiye istemaal ho rahe naam pakadta hai.
// Vite build aise galti nahi pakadta (wo runtime pe ReferenceError banti hai),
// isliye ye chhota scan chalate hain.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;
import { join } from 'node:path';

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');

// Wo naam jo aksar bhool jate hain — sab shared helper/component hain
const WATCH = [
  'cn', 'api', 'formatMoney', 'formatQty', 'formatDate', 'formatDateTime', 'formatPhone',
  'Card', 'CardHeader', 'StatCard', 'Button', 'Badge', 'Spinner', 'EmptyState', 'Table',
  'Input', 'Select', 'Textarea', 'Switch', 'Tabs', 'Modal', 'ConfirmModal', 'PageHeader',
  'SearchInput', 'Chips', 'Pagination', 'Combobox', 'QtyStepper', 'TrendChart',
  'LineItemCard', 'NumField', 'ReadLineItem', 'ReadField', 'useToast', 'useAuth', 'useCart',
  'Skeleton', 'SkeletonRows', 'SkeletonCards', 'SkeletonTable', 'CopyBox',
  // React ke hook — ye sabse zyada bhoole jate hain, kyunki import ki line
  // se ek naam hatane par baaki file chalti dikhti hai aur build bhi pass
  // ho jata hai. Galti sirf CHALANE pe pata chalti hai (safed page).
  'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', 'useContext',
  'useQuery', 'useListQuery', 'bust', 'useDebounce',
];

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(p)) out.push(p);
  }
  return out;
}

const problems = [];

for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');

  // import { a, b as c } from '...'   |   import d from '...'
  const declared = new Set();
  for (const m of src.matchAll(/import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"]/g)) {
    const clause = m[1];
    const braces = clause.match(/\{([\s\S]*?)\}/);
    if (braces) {
      for (const part of braces[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop().trim();
        if (name) declared.add(name);
      }
    }
    const def = clause.replace(/\{[\s\S]*?\}/, '').replace(/,/g, ' ').trim();
    for (const name of def.split(/\s+/)) if (name && name !== '*') declared.add(name);
  }
  // isi file me bane function/const
  for (const m of src.matchAll(/^\s*(?:export\s+)?(?:default\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    declared.add(m[1]);
  }

  for (const name of WATCH) {
    if (declared.has(name)) continue;
    // <Name  ya  Name(  ya  {Name}
    const used = new RegExp(`(<${name}[\\s/>]|[^\\w.'"\`]${name}\\s*\\()`).test(src);
    if (used) problems.push(`${file.replace(ROOT + '/', '')}: "${name}" istemaal hua par import nahi`);
  }
}

/*
  DOOSRI JAANCH — koi bhi aisa naam jo kahin declare hi nahi hua.

  Upar wali list-wali jaanch sirf un naamon ko dekhti hai jo pehle se list me
  likhe hain. Wo apna kaam karti hai, par uski hadd saaf hai: jo naam list me
  nahi, wo chhoot jata hai.

  Aur wahi hua. Retailer ka MyKhata `useQuery` pe aaya, uska purana `load()`
  hat gaya — par ek jagah `onSent={load}` reh gaya. `load` list me tha hi
  nahi, isliye jaanch khush rahi. Build bhi khush rahi (Vite aise naam ko
  runtime tak chhodta hai). Wo phatta browser me, tab, jab retailer paisa
  bhejne ke baad parda band karta — yaani sabse bure pal me.

  Ab har naam ki jaanch hoti hai: agar kisi naam ka koi thikana nahi (na
  import, na is file me bana, na browser ka jaana-pehchana naam), to wahi
  ReferenceError hai jo aage chal kar page safed karta.
*/
const GLOBALS = new Set([
  // Browser ke apne global — push notification ke liye
  'Notification', 'PushManager', 'ServiceWorkerRegistration',
  'window', 'document', 'navigator', 'console', 'localStorage', 'sessionStorage',
  'fetch', 'FormData', 'Blob', 'File', 'FileReader', 'URL', 'URLSearchParams',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver',
  'Image', 'Audio', 'CustomEvent', 'Event', 'AbortController', 'crypto', 'structuredClone',
  'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Symbol', 'Error', 'TypeError',
  'Intl', 'BigInt', 'Infinity', 'NaN', 'undefined', 'globalThis', 'process',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
  'atob', 'btoa', 'alert', 'confirm', 'prompt', 'HTMLElement', 'Node', 'DOMParser',
  'Uint8Array', 'Uint16Array', 'Int32Array', 'Float32Array', 'Float64Array', 'ArrayBuffer',
  'DataView', 'TextEncoder', 'TextDecoder', 'Proxy', 'Reflect', 'WeakRef', 'queueMicrotask',
  'React', 'arguments', 'import', 'require', 'module', 'exports',
]);

for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });
  } catch {
    continue;                      // padhi hi nahi gayi — doosri jaanch bolegi
  }

  const seen = new Set();
  traverse(ast, {
    ReferencedIdentifier(path) {
      const name = path.node.name;
      if (GLOBALS.has(name) || seen.has(name)) return;
      // JSX me chhote akshar wale tag asli HTML hain (`div`, `span`), naam nahi
      if (path.parentPath.isJSXOpeningElement() && /^[a-z]/.test(name)) return;
      if (path.scope.hasBinding(name, true)) return;
      seen.add(name);
      problems.push(
        `${file.replace(ROOT + '/', '')}:${path.node.loc.start.line}  "${name}" kahin declare nahi hua — page khulte hi ReferenceError`,
      );
    },
  });
}

if (problems.length) {
  console.log('MILA:\n' + problems.map((p) => '  ✖ ' + p).join('\n'));
  process.exit(1);
}
console.log('✔ har istemaal hua naam import bhi hua hai');
