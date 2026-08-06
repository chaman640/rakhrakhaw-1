import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';

async function start() {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`[server] ${env.nodeEnv} mode, http://localhost:${env.port}`);
  });
}

start();

process.on('unhandledRejection', (err) => {
  console.error('[fatal] Unhandled rejection:', err);
  process.exit(1);
});
