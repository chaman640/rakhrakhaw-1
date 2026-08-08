import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { syncIndexes } from './config/indexes.js';
import { runBackfills } from './config/backfill.js';

async function start() {
  await connectDB();

  // Purane project ke bache hue index hata dete hain (warna signup pe
  // "Ye email pehle se maujud hai" jaisi ajeeb error aati hai), aur purane
  // document me jo naye field chhoot gaye the wo bhar dete hain.
  // 20 second se zyada lage to chhod dete hain — deploy isme atakna nahi chahiye.
  await Promise.race([
    (async () => { await syncIndexes(); await runBackfills(); })(),
    new Promise((resolve) => setTimeout(() => {
      console.warn('[db] Index sync me der lag rahi hai, aage badh rahe hain');
      resolve();
    }, 20000)),
  ]);
  // 0.0.0.0 — Render/Docker ke andar sirf localhost pe sunne se bahar se koi nahi pahunch pata
  app.listen(env.port, '0.0.0.0', () => {
    if (env.isProd) {
      console.log(`[server] production mode, port ${env.port} — client aur API dono ek hi URL pe`);
    } else {
      console.log(`[server] ${env.nodeEnv} mode, http://localhost:${env.port}`);
    }
  });
}

start();

process.on('unhandledRejection', (err) => {
  console.error('[fatal] Unhandled rejection:', err);
  process.exit(1);
});
