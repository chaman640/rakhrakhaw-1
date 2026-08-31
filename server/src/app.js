import express from 'express';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { env, assertBillingReady, warnOtpMode } from './config/env.js';
import { rememberOrigin, detectedOrigin } from './config/origin.js';
import { CLIENT_DIST, UPLOAD_DIR } from './config/paths.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const hasClientBuild = fs.existsSync(path.join(CLIENT_DIST, 'index.html'));

const app = express();

// Render/nginx ke peeche chalte waqt asli protocol (https) aur host pata chalta hai
app.set('trust proxy', 1);

// Sabse pehle app ka apna URL yaad kar lo — CORS aur invite link dono isi pe tike hain
app.use((req, res, next) => { rememberOrigin(req); next(); });

/**
 * CORS — kaun si doosri website hamari API browser se bula sakti hai.
 *
 * Do baatein saaf rakhni zaroori hain:
 *
 * 1. CORS **server ka pehra nahi hai**. Ye sirf browser ka niyam hai. Postman,
 *    curl ya koi script CORS ko dekhti hi nahi. Isliye API ki asli suraksha
 *    CORS se nahi, `protect` (JWT token) aur `withTenant` (businessId) se aati hai —
 *    /health, login, signup aur invite ko chhod kar har route un dono se guzarta hai.
 *
 * 2. Iska kaam sirf itna hai: kisi aur website ka JavaScript, user ke browser me
 *    chal kar, hamari API se data na padh le.
 *
 * Isliye ab sirf apna hi origin allow karte hain (aur dev me localhost).
 * Pehle production me sab allow tha — ek hi URL wale deploy me farak nahi padta,
 * par band rakhna hi theek hai.
 */
const devOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173'];
app.use(cors({
  origin(origin, cb) {
    // Origin header hai hi nahi — same-origin page, curl, ya health check
    if (!origin) return cb(null, true);

    // App ka apna URL (pehli request pe pata chal jata hai) — hamesha allowed
    const self = detectedOrigin();
    if (self && origin === self) return cb(null, true);

    // Client sach me alag URL pe ho to wahi ek allowed hai
    if (process.env.CLIENT_URL) return cb(null, origin === process.env.CLIENT_URL);

    // Dev me client 5173 pe alag chalta hai
    if (!env.isProd) {
      return cb(null, devOrigins.includes(origin) || origin.startsWith('http://localhost:'));
    }

    // Baaki har website ke liye band
    return cb(null, false);
  },
  credentials: true,
}));

/*
  Razorpay ka webhook — RAW body chahiye, json parse kiya hua nahi.

  Signature poore raw bytes pe banta hai. Ek baar `express.json()` ne use
  padh liya to wo bytes wapas nahi milte (`JSON.stringify` se dobara banaya
  hua text kabhi bilkul wahi nahi hota — space, key ka kram, sab badal jata
  hai), aur HMAC kabhi match nahi karega.

  Isliye SIRF is ek raste pe raw parser, aur wo `express.json()` se PEHLE.
*/
// `type: () => true` — har content-type. (Glob `*` `/` `*` likhne se bachte
// hain: us do-akshar ke jode ko comment padhne wale auzaar galat samajh lete
// hain, aur ye galti aaj hi hamare apne check me pakdi gayi.)
app.use('/api/billing/webhook', express.raw({ type: () => true, limit: '1mb' }));

app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
if (!env.isProd) app.use(morgan('dev'));

// Local upload ki images (Cloudinary set nahi hai to yahi use hoti hain)
// Photo ka naam kabhi badalta nahi — saal bhar cache karna safe hai aur
// isse har baar wahi photo dobara bhejne ka bandwidth bachta hai
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '365d',
  immutable: true,
}));

assertBillingReady();
warnOtpMode();

/*
  Rate limit — do alag hadd.

  OTP wala rasta sabse mehnga hai (har call ek SMS = paisa), isliye uspe alag
  aur bahut sakht hadd. Baaki API pe dhili hadd, sirf bhaag-daud rokne ke liye.

  Ginti IP se hoti hai. Ek hi dukaan ke kai log ek wifi pe ho sakte hain, isliye
  aam API ki hadd udaar rakhi hai — 300/minute me koi asli aadmi nahi atakta.
*/
app.use('/api/auth/otp', rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Bahut baar koshish ho gayi — thodi der baad dobara try karein' },
}));

app.use('/api/auth', rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Bahut baar koshish ho gayi — thodi der baad dobara try karein' },
}));

app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PER_MIN || 300),
  standardHeaders: true,
  legacyHeaders: false,
  // Webhook ko chhod dein — wo Razorpay ke server se aata hai, aadmi se nahi
  skip: (req) => req.path === '/billing/webhook',
  message: { success: false, message: 'Thoda dheere — ek minute me itni request nahi' },
}));

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
/* ────────────────────── EK HI ASLI GHAR (SEO) ──────────────────────────

   Site do pate pe khulti hai: rakhrakhav.in aur rakhrakhaw-1.onrender.com.
   Google ke liye ye do alag site hain jinpe bilkul ek jaisa maal hai — aur
   tab wo dono me se kisi ek ko bhi poora bharosa nahi deta. Naam se dhundhne
   pe hamari hi site peeche rah jati hai, apne hi doosre pate ki wajah se.

   Isliye asli pata ek hi rakha hai. Baaki har pata 301 (hamesha ke liye)
   usi pe bhej diya jata hai, aur Google poori sakh ek jagah jod deta hai.

   Ye sirf tab chalta hai jab CANONICAL_HOST bhara ho — dev aur preview pe
   apne aap band rehta hai.
   ───────────────────────────────────────────────────────────────────────── */
const CANONICAL_HOST = (process.env.CANONICAL_HOST || '').trim().toLowerCase();

if (CANONICAL_HOST) {
  app.use((req, res, next) => {
    const host = String(req.headers.host || '').toLowerCase();
    // Render ke aage proxy hai, isliye asli scheme x-forwarded-proto me aata hai
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0];

    if (!host || host === CANONICAL_HOST) {
      if (proto === 'https') return next();
    }
    // Webhook aur API ko kabhi mat mod — redirect POST ka body gira deta hai
    if (req.path.startsWith('/api')) return next();

    return res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
  });
}

if (hasClientBuild) {
  // Vite har build me assets/ ke andar naam me hash daalta hai (index-DCBGj1ut.js).
  // Matlab file ka naam badle bina content badal hi nahi sakta — isliye inhe
  // saal bhar cache karna safe hai. index.html hamesha taaza chahiye.
  app.use(express.static(CLIENT_DIST, {
    index: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.endsWith('robots.txt') || filePath.endsWith('sitemap.xml')) {
        // Google inhe baar baar padhta hai — purana chipak jaye to naye page
        // uske paas pahunchte hi nahi
        res.setHeader('Cache-Control', 'public, max-age=3600');
      } else if (filePath.endsWith('sw.js')) {
        /*
          Service worker kabhi cache nahi. Purana sw chipak jaye to notification
          ka naya code kabhi pahunchta hi nahi, aur wo bug pakadna bahut mushkil
          hai — sab kuch theek dikhta hai, bas alert nahi aate.
        */
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Service-Worker-Allowed', '/');
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));

  /*
    Ghar ka page pehle se bana hua HTML hai (dist/home.html) — usme asli
    likhawat hai, sirf khali dabba nahi. Ye SIRF `/` pe jata hai.

    Wajah: Google pehli baari me saada HTML padhta hai; JavaScript wala kaam
    baad ki katar me jata hai, aur nayi site pe wo katar hafton lambi hoti
    hai. Khali dabbe wale page pe uske paas ek bhi shabd nahi hota.

    Baaki har route ko wahi purana index.html milta hai — warna har page pe
    pehle ghar ka page jhalakta.
  */
  /*
    GOOGLE SEARCH CONSOLE — SITE VERIFY.

    Jab tak Google Search Console me site verify na ho, Google use dhundhta
    hi nahi — aur jo site uske paas hai hi nahi, wo kisi khoj me kabhi nahi
    aati. Verify karne ke do tareeke hain, aur Google kabhi ek, kabhi doosra
    maangta hai. Isliye dono yahin bana diye — env bharte hi chalu.
  */
  if (env.googleVerifyFile) {
    const naam = env.googleVerifyFile.replace(/[^a-zA-Z0-9._-]/g, '');
    app.get(`/${naam}`, (req, res) => {
      res.type('text/html').send(`google-site-verification: ${naam}`);
    });
  }

  const HOME_HTML = path.join(CLIENT_DIST, 'home.html');
  const hasHome = fs.existsSync(HOME_HTML);

  // Meta tag wala verification — HTML me daal kar bhejna padta hai
  const VERIFY_META = env.googleVerify
    ? `<meta name="google-site-verification" content="${env.googleVerify.replace(/"/g, '')}" />`
    : '';

  const bhejo = (res, file) => {
    res.setHeader('Cache-Control', 'no-cache');
    if (!VERIFY_META) return res.sendFile(file);
    const html = fs.readFileSync(file, 'utf8').replace('</head>', `${VERIFY_META}</head>`);
    return res.type('html').send(html);
  };

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    if (req.path === '/' && hasHome) return bhejo(res, HOME_HTML);
    return bhejo(res, path.join(CLIENT_DIST, 'index.html'));
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
