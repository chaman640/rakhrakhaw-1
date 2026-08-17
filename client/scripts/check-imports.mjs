// Bina import kiye istemaal ho rahe naam pakadta hai.
// Vite build aise galti nahi pakadta (wo runtime pe ReferenceError banti hai),
// isliye ye chhota scan chalate hain.
import { readdirSync, readFileSync, statSync } from 'node:fs';
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

if (problems.length) {
  console.log('MILA:\n' + problems.map((p) => '  ✖ ' + p).join('\n'));
  process.exit(1);
}
console.log('✔ har istemaal hua naam import bhi hua hai');
