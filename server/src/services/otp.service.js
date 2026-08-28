import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { normalizePhone } from '../utils/phone.js';
import { Otp, User } from '../models/index.js';
import { sendOtpSms, smsReady } from './sms.service.js';

/**
 * OTP KA POORA KAANOON — ek hi jagah.
 *
 * Do jagah lagta hai:
 *   SIGNUP — naya account banate waqt (number sach me uska hai ya nahi)
 *   RESET  — password bhool jane par
 *
 * Verify hone par ek chhota TOKEN milta hai. Aage ka kaam (signup ya naya
 * password) usi token se hota hai.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TOKEN KYUN — sirf "verify ho gaya" ka jhanda kyun nahi?
 *
 * Jhanda database me rakhna padta, aur uske saath ek pura sawal aata: wo kab
 * mite? Na mitao to aaj verify kiya hua number kal bhi verify hi rehta.
 *
 * Token ke saath ye sawal hai hi nahi. Usme number, kaam aur waqt — teeno
 * andar likhe hain, aur wo 15 minute me khud mar jata hai. Server ko kuch yaad
 * nahi rakhna padta, aur token ke saath chhed-chhaad ho to signature wahin
 * pakad leta hai.
 * ─────────────────────────────────────────────────────────────────────────
 */

const CODE_LENGTH = 6;
const CODE_TTL_MIN = 10;          // code itni der zinda
const TOKEN_TTL_MIN = 15;         // verify ke baad itni der me kaam poora karna hai
const RESEND_GAP_SEC = 60;        // do SMS ke beech kam se kam itna
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

/**
 * Chhah ank — `Math.random()` se NAHI.
 *
 * `Math.random()` andaza lagane layak hai; usse bana OTP suraksha ka dikhawa
 * bhar hota hai. `crypto` wala number sach me anjaan hota hai.
 *
 * Pehla ank kabhi 0 nahi — "012345" screen pe aksar "12345" ban kar dikhta hai
 * (form aur SMS dono me), aur phir aadmi paanch ank daal kar hairan hota hai.
 */
function makeCode() {
  const max = 10 ** CODE_LENGTH;
  const min = 10 ** (CODE_LENGTH - 1);
  return String(min + (crypto.randomInt(0, max - min)));
}

const minutesFromNow = (m) => new Date(Date.now() + m * 60 * 1000);

/* ─────────────────────────── bhejna ─────────────────────────── */

/**
 * OTP bhejo.
 *
 * Number pehle se registered hai ya nahi — ye SIGNUP aur RESET me ULTA hota
 * hai, aur dono taraf ki galti mehngi padti hai:
 *
 *   SIGNUP pe registered number  → aage jaakar signup fail hoga; abhi rok dena
 *                                  behtar hai, warna SMS ka paisa bhi jata hai
 *                                  aur aadmi ka waqt bhi.
 *   RESET  pe anjaan number      → yahan hum SAAF MANA KAR DETE hain. Chhupane
 *                                  se aadmi galat number pe OTP ka intezaar
 *                                  karta rehta hai. Ye dukaan ka app hai, koi
 *                                  bank nahi — "ye number registered nahi hai"
 *                                  bata dena hi seedha aur kaam ka hai.
 */
export async function sendOtp({ phone, purpose }) {
  const clean = normalizePhone(phone);

  const user = await User.findOne({ phone: clean }).select('_id isActive').lean();

  if (purpose === 'SIGNUP' && user) {
    throw ApiError.conflict('Ye number pehle se registered hai. Login karein.');
  }
  if (purpose === 'RESET') {
    if (!user) throw ApiError.notFound('Ye number registered nahi hai');
    if (!user.isActive) throw ApiError.forbidden('Aapka account band kar diya gaya hai');
  }

  let row = await Otp.findOne({ phone: clean, purpose });
  const now = Date.now();

  if (row) {
    const since = (now - new Date(row.lastSentAt).getTime()) / 1000;
    if (since < RESEND_GAP_SEC) {
      throw ApiError.badRequest(
        `${Math.ceil(RESEND_GAP_SEC - since)} second baad dobara bhej sakte hain`
      );
    }

    // Ek ghante ki khidki — beet gayi to ginti nayi shuru
    const windowAge = (now - new Date(row.windowStartedAt).getTime()) / 1000;
    if (windowAge > 3600) {
      row.sentCount = 0;
      row.windowStartedAt = new Date();
    }
    if (row.sentCount >= MAX_SENDS_PER_HOUR) {
      throw ApiError.badRequest('Bahut baar bhej chuke hain. Ek ghante baad koshish karein.');
    }
  } else {
    row = new Otp({ phone: clean, purpose, sentCount: 0, windowStartedAt: new Date() });
  }

  const code = makeCode();
  await row.setCode(code);
  row.attempts = 0;                       // naya code, nayi koshishein
  row.sentCount += 1;
  row.lastSentAt = new Date();
  row.expiresAt = minutesFromNow(CODE_TTL_MIN);
  await row.save();

  const result = await sendOtpSms(clean, code);

  return {
    phone: clean,
    expiresInMin: CODE_TTL_MIN,
    resendAfterSec: RESEND_GAP_SEC,
    /*
      DEV ME CODE JAWAB ME BHI.

      Bina iske app banane wale ko har baar server ka log kholna padta. Ye rasta
      SIRF tab khulta hai jab SMS ki key hai hi nahi AUR ye production nahi hai
      — dono shart. Production me `sms.service` khud hi mana kar deti hai, isliye
      yahan tak baat pahunchti hi nahi.
    */
    ...(result.dev && !env.isProd ? { devCode: code } : {}),
    smsConfigured: smsReady(),
  };
}

/* ─────────────────────────── jaanchna ─────────────────────────── */

/** Verify — sahi nikla to aage ka kaam karne wala token */
export async function verifyOtp({ phone, purpose, code }) {
  const clean = normalizePhone(phone);

  const row = await Otp.findOne({ phone: clean, purpose });
  if (!row) throw ApiError.badRequest('Pehle OTP mangwaiye');
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    throw ApiError.badRequest('OTP ki mohlat khatam — naya mangwaiye');
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    throw ApiError.badRequest('Bahut baar galat daala — naya OTP mangwaiye');
  }

  const okCode = await row.checkCode(code);
  if (!okCode) {
    /*
      Ginti PEHLE badhti hai, phir error jata hai.

      Ulta karne par ek script har koshish ke baad request beech me kaat kar
      ginti bachne se rok deti — aur paanch ki hadd kabhi lagti hi nahi.
    */
    row.attempts += 1;
    await row.save();
    const left = Math.max(0, MAX_ATTEMPTS - row.attempts);
    throw ApiError.badRequest(
      left > 0 ? `OTP galat hai — ${left} koshish baaki` : 'OTP galat hai — naya mangwaiye'
    );
  }

  /*
    Sahi nikla — code ab MITA dete hain.

    Ek verify ho chuka code zinda chhod dena ek chup-chaap ched hai: jiske paas
    wo chhah ank hain wo mohlat khatam hone tak baar baar naya token bana sakta
    hai. Ek code, ek kaam.
  */
  await Otp.deleteOne({ _id: row._id });

  const otpToken = jwt.sign(
    { phone: clean, purpose, otp: true },
    env.jwtSecret,
    { expiresIn: `${TOKEN_TTL_MIN}m` },
  );

  return { otpToken, phone: clean, validForMin: TOKEN_TTL_MIN };
}

/**
 * Aage ka kaam karne se pehle token ki jaanch.
 *
 * `expectedPhone` bhi milaya jata hai, aur yahi is function ka asli kaam hai:
 * bina iske koi ek number pe OTP verify karta aur token le kar KISI AUR number
 * se account bana leta — token to sahi hi hota, bas kisi aur ka.
 */
export function assertOtpToken(otpToken, purpose, expectedPhone) {
  if (!otpToken) throw ApiError.badRequest('Pehle apna number OTP se verify karein');

  let payload;
  try {
    payload = jwt.verify(otpToken, env.jwtSecret);
  } catch {
    throw ApiError.badRequest('Verify ki mohlat khatam ho gayi — dobara OTP mangwaiye');
  }

  if (!payload?.otp || payload.purpose !== purpose) {
    throw ApiError.badRequest('Ye verify is kaam ke liye nahi hai');
  }
  if (normalizePhone(expectedPhone) !== payload.phone) {
    throw ApiError.badRequest('OTP kisi aur number pe verify hua tha');
  }

  return payload.phone;
}
