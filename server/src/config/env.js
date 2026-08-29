import fs from 'fs';
import dotenv from 'dotenv';
import { ENV_FILE } from './paths.js';

// server/.env hamesha wahin se padho jahan wo pada hai.
// Root se `npm start` chalane par cwd root hota hai — bina iske .env milti hi nahi thi.
if (fs.existsSync(ENV_FILE)) dotenv.config({ path: ENV_FILE });
else dotenv.config(); // Render pe file nahi hoti, wahan values dashboard se aati hain

const IS_PROD = (process.env.NODE_ENV || 'development') === 'production';

/**
 * Dev me aasani ke liye fallback chalta hai.
 * Production (deploy) me fallback nahi milta — value na ho to saaf error deta hai,
 * warna Render pe log me "ECONNREFUSED 127.0.0.1:27017" aata hai aur samajh hi
 * nahi aata ki asli galti sirf ek khali env variable thi.
 */
function required(key, devFallback) {
  const value = process.env[key] || (IS_PROD ? '' : devFallback);
  if (!value) {
    throw new Error(
      `${key} set nahi hai.` +
        (IS_PROD
          ? ` Render → aapki service → Environment me ${key} bharein, phir "Save".`
          : ` server/.env me ${key} bharein.`)
    );
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: IS_PROD,

  mongoUri: required('MONGO_URI', 'mongodb://127.0.0.1:27017/rakhrakhav'),

  jwtSecret: required('JWT_SECRET', 'dev-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',

  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  // Local uploads ka public URL banane ke liye
  serverUrl: process.env.SERVER_URL || `http://localhost:${Number(process.env.PORT || 5000)}`,

  /*
    SMS — OTP isi se jata hai.

    Khali chhod dein to dev me OTP server ke LOG me chhapta hai aur kaam chalta
    rehta hai (sms.service.js me poori wajah). Production me khali hone par
    saaf error aata hai — wahan chup-chaap log me code chhapna sabse bada
    surakhsa ka ched hoga.
  */
  fast2sms: {
    apiKey: process.env.FAST2SMS_API_KEY || '',
  },

  /*
    ═══════════════ PAISA LAGEGA YA NAHI — EK HI SWITCH ═══════════════

    `BILLING_MODE` bilkul `NODE_ENV` jaisa hai: ek line badli, server dobara
    chala, ho gaya. `free` me aaj jaisa hi sab kuch khula rehta hai; `paid` me
    bechne wale hisse ke paise lagte hain. Kharidne wala hissa dono halat me
    free hi rehta hai (wajah `config/billing.js` me likhi hai).

    Galat shabd likh dene par CHUP-CHAAP `free` nahi maan lete — wo sabse
    khatarnak jawab hota: aadmi `BILLING_MODE=Paid` likh kar nishchint ho jata
    aur mahino tak sabko muft me sab kuch milta rehta. Isliye saaf error.
  */
  billing: {
    mode: (() => {
      const raw = (process.env.BILLING_MODE || 'free').trim().toLowerCase();
      if (raw !== 'free' && raw !== 'paid') {
        throw new Error(
          `BILLING_MODE me "${process.env.BILLING_MODE}" likha hai — sirf "free" ya "paid" chalega`,
        );
      }
      return raw;
    })(),
    /*
      Payment fail hone ke baad kitne din tak sab chalta rahega.

      Card ki limit, UPI ka mandate, bank ka server — payment fail hona bahut
      aam hai. Us ek pal me poori dukaan band kar dena sabse bura jawab hai:
      bill beech me ruk jata hai aur graahak saamne khada hota hai. 7 din ki
      mohlat me aadmi aaram se theek kar leta hai, aur app roz yaad dilata hai.
    */
    graceDays: Number(process.env.BILLING_GRACE_DAYS || 7),
  },

  /*
    Dukaan ka apna pata — policy ke kagaz aur bill dono me chhapta hai.

    Razorpay in teeno cheezon ko poore pate ke saath maangta hai, aur bina
    inke merchant account manzoor hi nahi hota. `.env` me isliye rakha ki
    kagaz badalne ke liye code me haath na lagana pade.
  */
  company: {
    name: process.env.COMPANY_NAME || 'Rakh Rakhav',
    legalName: process.env.COMPANY_LEGAL_NAME || '',
    email: process.env.SUPPORT_EMAIL || 'support@rakhrakhav.in',
    phone: process.env.SUPPORT_PHONE || '',
    address: process.env.COMPANY_ADDRESS || '',
    gstin: process.env.COMPANY_GSTIN || '',
    website: process.env.PUBLIC_URL || 'https://rakhrakhav.in',
  },

  /*
    Razorpay. `paid` mode me ye bharna ZAROORI hai — bina key ke server
    shuru hi nahi hota (neeche `assertBillingReady`). Chup-chaap chalne dena
    ka matlab hota: plan ka page khulta, checkout par kuch na hota.
  */
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  sms: {
    /*
      Default APITXT — aap wahi use kar rahe hain.
      'fast2sms' sirf tab jab APITxT ki taraf se koi dikkat aaye.
    */
    provider: (process.env.SMS_PROVIDER || 'apitxt').trim().toLowerCase(),

    /*
      Sender ID — khali chhod sakte hain.
      DLT approve hone me din lagte hain. Khali hone par bhi OTP ki koshish
      hoti hai; aur bhara hua ho par gateway mana kare, to bina sender ke
      dobara koshish hoti hai (sms.service.js me poori wajah).
    */
    senderId: (process.env.SMS_SENDER_ID || '').trim(),

    apitxtKey: (process.env.APITXT_API_KEY || '').trim(),
    // APITxT ka apna endpoint. Badalne ki zarurat aam taur pe nahi padti.
    apitxtUrl: (process.env.APITXT_URL || 'https://www.apitxt.com/api/sendhttp.php').trim(),
    // 4 = transactional (OTP isi se jata hai), 1 = promotional
    route: Number(process.env.SMS_ROUTE || 4),
    // DLT template id — mile to bhar dein, warna khali
    templateId: (process.env.DLT_TEMPLATE_ID || '').trim(),
    apitxtTemplate: process.env.APITXT_OTP_TEMPLATE
      || 'Your Rakh Rakhav OTP is {otp}. Valid for 10 minutes. Do not share it with anyone.',
  },

  push: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:support@rakhrakhav.in',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
};

/**
 * `paid` mode bina Razorpay ki key ke chal hi nahi sakta — shuru me hi rok.
 * Baad me pata chalna sabse mehnga hota hai: graahak paisa dene aata hai aur
 * kuch hota hi nahi.
 */
export function assertBillingReady() {
  if (env.billing.mode !== 'paid') return;
  const miss = [];
  if (!env.razorpay.keyId) miss.push('RAZORPAY_KEY_ID');
  if (!env.razorpay.keySecret) miss.push('RAZORPAY_KEY_SECRET');
  if (!env.razorpay.webhookSecret) miss.push('RAZORPAY_WEBHOOK_SECRET');
  if (miss.length) {
    throw new Error(
      `BILLING_MODE=paid hai par ye setting nahi mili: ${miss.join(', ')}. `
      + 'Ya to ye bharein, ya BILLING_MODE=free kar dein.',
    );
  }
}
