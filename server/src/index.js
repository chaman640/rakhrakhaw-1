import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';

async function start() {
  await connectDB();
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
