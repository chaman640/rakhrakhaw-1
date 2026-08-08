import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import { rememberOrigin } from './config/origin.js';
import { CLIENT_DIST, UPLOAD_DIR } from './config/paths.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const hasClientBuild = fs.existsSync(path.join(CLIENT_DIST, 'index.html'));

const app = express();

// Render/nginx ke peeche chalte waqt asli protocol (https) aur host pata chalta hai
app.set('trust proxy', 1);

/**
 * CORS.
 *
 * Ek hi URL wale deploy me client aur API dono ek jagah hain — CORS lagta hi nahi.
 * Ye sirf local dev ke liye hai jahan client 5173 pe aur server 5000 pe alag chalte hain.
 */
const devOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173'];
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);                      // same-origin ya curl
    if (process.env.CLIENT_URL) return cb(null, origin === process.env.CLIENT_URL);
    if (!env.isProd) return cb(null, devOrigins.includes(origin) || origin.startsWith('http://localhost:'));
    return cb(null, true);                                   // single-URL deploy
  },
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
if (!env.isProd) app.use(morgan('dev'));

// Pehli request se app ka apna URL yaad kar lo (invite link isi se banta hai)
app.use((req, res, next) => { rememberOrigin(req); next(); });

// Local upload ki images (Cloudinary set nahi hai to yahi use hoti hain)
app.use('/uploads', express.static(UPLOAD_DIR));

app.use('/api', apiRoutes);

/* ─────────────────────────────────────────────────────────────────────────
   Client ka build — ek hi URL pe frontend + backend

   `npm run build` (root se) client ko client/dist me bana deta hai.
   Wo bana hua ho to server hi use serve karta hai:
     /api/...  -> API
     /uploads  -> images
     baaki sab -> React app (index.html)

   Build na ho (dev me) to ye poora block skip ho jata hai aur client
   apne 5173 wale vite server se chalta rehta hai.
   ───────────────────────────────────────────────────────────────────────── */
if (hasClientBuild) {
  // Vite har build me assets/ ke andar naam me hash daalta hai (index-DCBGj1ut.js).
  // Matlab file ka naam badle bina content badal hi nahi sakta — isliye inhe
  // saal bhar cache karna safe hai. index.html hamesha taaza chahiye.
  app.use(express.static(CLIENT_DIST, {
    index: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));

  // React Router ke saare route (/dashboard, /join/ABC...) index.html pe jate hain.
  // /api aur /uploads ko chhod dena zaroori hai — warna 404 ki jagah HTML milta.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    // sendFile express.static ke setHeaders se nahi guzarti — header yahan lagana padta hai
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'Rakh Rakhav API',
      version: '1.0.0',
      note: 'Client ka build nahi mila. Root se `npm run build` chalayein, ya dev me client alag se chalayein.',
    });
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
