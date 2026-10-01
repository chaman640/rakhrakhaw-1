// Lists every built file so the service worker can keep the whole app on the phone for offline use
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const files = ['/index.html'];
for (const f of fs.readdirSync(path.join(dist, 'assets'))) files.push(`/assets/${f}`);
for (const f of ['favicon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest']) {
  if (fs.existsSync(path.join(dist, f))) files.push(`/${f}`);
}
fs.writeFileSync(path.join(dist, 'precache.json'), JSON.stringify({ files }));
console.log(`✔ precache.json — ${files.length} files for offline use`);
