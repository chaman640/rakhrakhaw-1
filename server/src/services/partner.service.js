import jwt from 'jsonwebtoken';
import ApiError from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { clientOrigin } from '../config/origin.js';
import { normalizePhone } from '../utils/phone.js';
import {
  RATE_PAISE, MAX_MONTHS, PAYOUT_MODES, partnerRupees, baakiPaise,
} from '../config/partner.js';
import {
  Salesman, Referral, Commission, Payout,
} from '../models/index.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SALESMAN KA SYSTEM — link se grahak laao, har payment pe ₹30.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * TEEN NIYAM, aur teeno paise se jude hain:
 *
 *   1. Ek dukaan ka ek hi salesman — hamesha ke liye, signup ke pal se.
 *   2. Ek dukaan pe zyada se zyada 12 mahine ka commission (₹360).
 *   3. Ek payment ka paisa ek hi baar chadhta hai, chahe khabar dus baar aaye.
 *
 * Teeno database ke level pe bandhe hue hain, sirf code ke bharose nahi. Code
 * me bhool ho sakti hai; unique index bhool nahi karta.
 */

/* ────────────────────────────────────────────── token */

const AUD = 'partner';

/*
  Salesman ka token dukaan wale token se ALAG hona chahiye.

  Dono ek hi secret se bante hain, isliye agar `aud` na hota to ek salesman ka
  token kisi dukaan wale raste pe bhi chal jata — aur ulta bhi. `aud` ki jaanch
  hi wo deewar hai.
*/
export function signPartnerToken(salesman) {
  return jwt.sign(
    { sub: String(salesman._id), aud: AUD, ts: salesman.tokenSeq || 0 },
    env.jwtSecret,
    { expiresIn: '30d' },
  );
}

export function readPartnerToken(token) {
  const d = jwt.verify(token, env.jwtSecret);
  if (d.aud !== AUD) throw ApiError.unauthorized();
  return d;
}

/* ────────────────────────────────────────────── ref code */

/*
  0/O aur 1/I/l isme hain hi nahi — ye link WhatsApp pe jata hai aur log ise
  haath se bhi likhte hain. Ek galat akshar ka matlab hai ki salesman ki mehnat
  kisi aur ke khaate me chali jaye, ya kahin bhi na jaye.
*/
/* normalizePhone galat input pe throw karta hai — yahan sirf milana hai, rokna nahi */
const phoneSafe = (v) => { try { return normalizePhone(v); } catch { return ''; } };

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function makeCode(n = 6) {
  let out = '';
  for (let i = 0; i < n; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

async function freeCode() {
  for (let i = 0; i < 12; i += 1) {
    const code = makeCode();
    if (!(await Salesman.exists({ refCode: code }))) return code;
  }
  // 12 baar takrana lagbhag namumkin hai; phir bhi khali haath nahi lautna
  return makeCode(8);
}

/* ────────────────────────────────────────────── signup / login */

function cleanPayout(payout = {}) {
  const mode = payout.mode === PAYOUT_MODES.BANK ? PAYOUT_MODES.BANK : PAYOUT_MODES.UPI;

  if (mode === PAYOUT_MODES.UPI) {
    const upiId = String(payout.upiId || '').trim();
    if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) {
      throw ApiError.badRequest('UPI id theek nahi lag rahi — jaise naam@okaxis');
    }
    return { mode, upiId, accountName: '', accountNumber: '', ifsc: '' };
  }

  const accountNumber = String(payout.accountNumber || '').replace(/\s/g, '');
  const ifsc = String(payout.ifsc || '').replace(/\s/g, '').toUpperCase();
  const accountName = String(payout.accountName || '').trim();

  if (!/^\d{9,18}$/.test(accountNumber)) throw ApiError.badRequest('Account number theek nahi hai');
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw ApiError.badRequest('IFSC code theek nahi hai');
  if (accountName.length < 2) throw ApiError.badRequest('Khate pe jo naam hai wo likhein');

  return { mode, upiId: '', accountName, accountNumber, ifsc };
}

export async function partnerSignup({ name, phone, password, payout }) {
  const clean = normalizePhone(phone);

  if (await Salesman.exists({ phone: clean })) {
    throw ApiError.conflict('Ye number pehle se juda hai. Login karein.');
  }

  const sm = new Salesman({
    name: String(name).trim(),
    phone: clean,
    refCode: await freeCode(),
    payout: cleanPayout(payout),
    passwordHash: 'temp',
  });
  await sm.setPassword(password);
  await sm.save();

  return { token: signPartnerToken(sm), salesman: publicSalesman(sm) };
}

export async function partnerLogin({ phone, password }) {
  const clean = normalizePhone(phone);
  const sm = await Salesman.findOne({ phone: clean });

  /*
    Jawab dono halat me ek sa — "number ya password galat hai".

    Alag-alag jawab dene se koi ek-ek karke number daal kar pata laga leta hai
    ki kaun juda hua hai. Wo apne aap me nuksan nahi, par uske baad wo sirf
    unhi numbers pe password aajmata hai — aur kaam aadha ho jata hai.
  */
  if (!sm || !(await sm.checkPassword(password))) {
    throw ApiError.unauthorized('Number ya password galat hai');
  }
  if (!sm.active) throw ApiError.forbidden('Aapka account band kar diya gaya hai');

  sm.lastLoginAt = new Date();
  await sm.save();

  return { token: signPartnerToken(sm), salesman: publicSalesman(sm) };
}

export async function changePartnerPassword(salesmanId, { currentPassword, newPassword }) {
  const sm = await Salesman.findById(salesmanId);
  if (!sm) throw ApiError.notFound('Account nahi mila');
  if (!(await sm.checkPassword(currentPassword))) {
    throw ApiError.badRequest('Purana password galat hai');
  }
  await sm.setPassword(newPassword);
  // Purane token bhi band — warna 30 din tak purani chaabi chalti rehti
  sm.tokenSeq = (sm.tokenSeq || 0) + 1;
  await sm.save();
  return { ok: true, dobaraLoginKarein: true };
}

export async function updatePayout(salesmanId, payout) {
  const sm = await Salesman.findByIdAndUpdate(
    salesmanId,
    { $set: { payout: cleanPayout(payout) } },
    { new: true },
  );
  if (!sm) throw ApiError.notFound('Account nahi mila');
  return publicSalesman(sm);
}

function publicSalesman(sm) {
  return {
    _id: sm._id,
    name: sm.name,
    phone: sm.phone,
    refCode: sm.refCode,
    payout: sm.payout,
    earnedRupees: partnerRupees(sm.earnedPaise),
    paidRupees: partnerRupees(sm.paidPaise),
    baakiRupees: partnerRupees(baakiPaise(sm)),
    joinedCount: sm.joinedCount || 0,
  };
}

/* ────────────────────────────────────── link se dukaan judna */

/**
 * NAYI DUKAAN IS SALESMAN KE NAAM.
 *
 * Ye SIRF signup ke pal bulaya jata hai, aur yahi is poore system ka sabse
 * nazuk mod hai.
 *
 * PURANI DUKAAN KABHI NAHI JUDTI. Agar baad me bhi judne diya jata, to
 * salesman un dukaano pe daawa kar leta jo pehle se aa chuki thi — jinke liye
 * usne kuch kiya hi nahi. `businessId` pe unique index hai, isliye ek dukaan
 * dobara juda hi nahi sakti, chahe koi kitni baar koshish kare.
 *
 * Ye kabhi throw nahi karta. Salesman ka hisaab uski apni cheez hai; uski koi
 * gadbad grahak ka signup nahi rok sakti — us pal grahak ka account banna
 * sabse zaroori hai.
 */
export async function bindReferral({ refCode, businessId, shopName, ownerPhone }) {
  const code = String(refCode || '').trim().toUpperCase();
  if (!code || !businessId) return { linked: false };

  try {
    const sm = await Salesman.findOne({ refCode: code, active: true }).lean();
    if (!sm) return { linked: false, reason: 'link theek nahi hai' };

    // Apni hi dukaan apne link se — mehnat kuch nahi, isliye paisa bhi nahi
    if (sm.phone && phoneSafe(ownerPhone) === sm.phone) {
      return { linked: false, reason: 'apni hi dukaan' };
    }

    if (await Referral.exists({ businessId })) {
      return { linked: false, reason: 'pehle se juda hai' };
    }

    await Referral.create({
      salesmanId: sm._id,
      businessId,
      shopName: shopName || '',
      ownerPhone: phoneSafe(ownerPhone),
    });
    await Salesman.updateOne({ _id: sm._id }, { $inc: { joinedCount: 1 } });

    return { linked: true, salesmanId: sm._id };
  } catch (err) {
    // Do signup ek saath — unique index ne roka. Ye galti nahi hai.
    if (err?.code === 11000) return { linked: false, reason: 'pehle se juda hai' };
    console.warn('[partner] bindReferral:', err.message);
    return { linked: false, reason: 'nahi jud paya' };
  }
}

/* ────────────────────────────────────────── PAISA CHADHANA */

/**
 * PAYMENT HUA — SALESMAN KO ₹30 × MAHINE.
 *
 * Ye poore system ka sabse nazuk function hai, isliye teen roken ek hi atomic
 * kadam me lagayi gayi hain — teen alag jaanch nahi, jinme se koi ek do
 * request ke beech me chhoot jaye:
 *
 *   `creditedSources: { $ne: sourceId }`   -> yahi payment dobara nahi
 *   `monthsCredited: { $lte: MAX - grant }` -> 12 se aage nahi
 *   `findOneAndUpdate`                       -> dono jaanch aur badlav ek saath
 *
 * MongoDB ek document pe ek waqt me ek hi update chalata hai, isliye do
 * webhook ek saath aayein to doosri ko `null` milta hai aur wo chup-chaap
 * lautti hai. Bina iske ek hi payment ka paisa do baar chadh jata — aur wo
 * bug mahine baad, hisaab milate waqt pakda jata.
 *
 * Ye kabhi throw nahi karta. Commission ki koi bhi gadbad grahak ka payment
 * fail nahi kar sakti — uska paisa aa chuka hai, uska plan chalna chahiye.
 */
export async function creditReferral({ businessId, months = 1, sourceId = '' }) {
  try {
    const ref = await Referral.findOne({ businessId });
    if (!ref) return { credited: false, reason: 'is dukaan ka koi salesman nahi' };

    const bacha = MAX_MONTHS - (ref.monthsCredited || 0);
    if (bacha <= 0) return { credited: false, reason: '12 mahine poore ho chuke' };

    const grant = Math.max(1, Math.min(Number(months) || 1, bacha));
    const amount = grant * RATE_PAISE;
    const src = String(sourceId || '').trim();
    const now = new Date();

    const claimed = await Referral.findOneAndUpdate(
      {
        _id: ref._id,
        monthsCredited: { $lte: MAX_MONTHS - grant },
        ...(src ? { creditedSources: { $ne: src } } : {}),
      },
      {
        $inc: { monthsCredited: grant, earnedPaise: amount },
        $set: { lastPaidAt: now, ...(ref.firstPaidAt ? {} : { firstPaidAt: now }) },
        ...(src ? { $push: { creditedSources: src } } : {}),
      },
      { new: true },
    );

    // Kisi aur request ne pehle chadha diya — ye bilkul theek hai
    if (!claimed) return { credited: false, reason: 'pehle hi chadh chuka' };

    /*
      SALESMAN KA KHAATA — ab is line ka fail hona bhi paisa nahi maarta.

      Referral pe mahina aur sourceId chadh chuka hai. Agar ye line fail ho
      jaye (network, restart) to salesman ka ₹30 kho jata aur us mahine ka
      hisaab dobara nahi ho sakta — kyunki `creditedSources` me wo payment
      likha ja chuka hota.

      Isliye fail hone par ise UNDO kar dete hain: mahina aur sourceId dono
      wapas nikal jate hain, aur Razorpay ki agli koshish (wo kai baar aati
      hai) poora kaam dobara kar deti hai.
    */
    try {
      const hit = await Salesman.updateOne(
        { _id: ref.salesmanId }, { $inc: { earnedPaise: amount } },
      );
      // Salesman mil hi na sake to ye throw nahi karta — matchedCount 0 aata hai
      if (!hit?.matchedCount) throw new Error('salesman nahi mila');
    } catch (err) {
      await Referral.updateOne(
        { _id: ref._id },
        {
          $inc: { monthsCredited: -grant, earnedPaise: -amount },
          ...(src ? { $pull: { creditedSources: src } } : {}),
        },
      ).catch(() => {});
      console.warn('[partner] salesman ka khaata nahi chadha, wapas kiya:', err.message);
      return { credited: false, reason: 'wapas kar diya — dobara koshish hogi' };
    }

    // Bahi-khata ki line — ye na bane to bhi kisi ka paisa nahi marta
    Commission.create({
      salesmanId: ref.salesmanId,
      referralId: ref._id,
      businessId,
      shopName: ref.shopName,
      months: grant,
      amountPaise: amount,
      sourceId: src,
    }).catch((e) => console.warn('[partner] commission log:', e.message));

    return { credited: true, months: grant, amountPaise: amount, salesmanId: ref.salesmanId };
  } catch (err) {
    console.warn('[partner] creditReferral:', err.message);
    return { credited: false, reason: 'gadbad' };
  }
}

/**
 * PAISA WAPAS HO GAYA — COMMISSION BHI WAPAS.
 *
 * Ye rok isliye zaroori hai: bina iske ek salesman apne dost se 12 mahine ka
 * paisa dilwata (₹360 turant chadh jate), commission le leta, aur dost
 * chargeback maar deta. Aapka paisa gaya, uska aa gaya.
 *
 * Mahina bhi wapas karte hain, sirf paisa nahi — warna 12 ki hadd un mahino
 * se bhar jati jinka paisa aapke paas ruka hi nahi.
 *
 * Ye kabhi throw nahi karta — refund ka kaam iski wajah se rukna nahi chahiye.
 */
export async function reverseReferral({ businessId, sourceId = '' }) {
  try {
    const src = String(sourceId || '').trim();
    if (!src) return { reversed: false, reason: 'kaunsa payment, ye pata nahi' };

    const ref = await Referral.findOne({ businessId, creditedSources: src });
    if (!ref) return { reversed: false, reason: 'is payment ka commission chadha hi nahi' };

    // `src` (trim kiya hua) — kachcha `sourceId` lene se multi-mahine wapasi adhoori reh jati
    const row = await Commission.findOne({ referralId: ref._id, sourceId: src }).lean();
    const months = row?.months || 1;
    const amount = row?.amountPaise || months * RATE_PAISE;

    // `creditedSources` filter me hai — do refund ek saath aayein to ek hi chalega
    const claimed = await Referral.findOneAndUpdate(
      { _id: ref._id, creditedSources: src },
      {
        $inc: { monthsCredited: -months, earnedPaise: -amount },
        $pull: { creditedSources: src },
      },
      { new: true },
    );
    if (!claimed) return { reversed: false, reason: 'pehle hi wapas ho chuka' };

    await Salesman.updateOne({ _id: ref.salesmanId }, { $inc: { earnedPaise: -amount } });

    Commission.create({
      salesmanId: ref.salesmanId,
      referralId: ref._id,
      businessId,
      shopName: ref.shopName,
      months: -months,
      amountPaise: -amount,
      sourceId: `refund:${src}`,
    }).catch(() => {});

    return { reversed: true, months, amountPaise: amount };
  } catch (err) {
    console.warn('[partner] reverseReferral:', err.message);
    return { reversed: false, reason: 'gadbad' };
  }
}

/* ────────────────────────────────────────── salesman ka dashboard */

export async function partnerDashboard(salesmanId) {
  const sm = await Salesman.findById(salesmanId).lean();
  if (!sm) throw ApiError.notFound('Account nahi mila');

  const [refs, payouts] = await Promise.all([
    Referral.find({ salesmanId }).sort({ createdAt: -1 }).limit(200).lean(),
    Payout.find({ salesmanId }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);

  return {
    salesman: publicSalesman(sm),
    link: `${clientOrigin()}/signup?ref=${sm.refCode}`,

    ginti: {
      // `joinedCount` asli ginti hai; `refs` sirf 200 tak aati hai
      jude: sm.joinedCount || refs.length,
      paisaDeneWale: refs.filter((r) => r.monthsCredited > 0).length,
      // Jo jud to gaye par abhi tak paisa nahi diya — inhe phone karna banta hai
      abhiTakNahi: refs.filter((r) => r.monthsCredited === 0).length,
    },

    // 200 se zyada hon to niche wali list adhoori hai — UI ko bata dete hain
    aurBhiHain: Math.max(0, (sm.joinedCount || 0) - refs.length),

    dukaanein: refs.map((r) => ({
      _id: r._id,
      shopName: r.shopName || '(naam nahi)',
      phone: r.ownerPhone,
      juda: r.createdAt,
      mahine: r.monthsCredited,
      bacheMahine: MAX_MONTHS - r.monthsCredited,
      kamaiRupees: partnerRupees(r.earnedPaise),
      pehliBaar: r.firstPaidAt,
      aakhriBaar: r.lastPaidAt,
    })),

    milaHua: payouts.map((p) => ({
      _id: p._id,
      rupees: partnerRupees(p.amountPaise),
      reference: p.reference,
      note: p.note,
      kab: p.createdAt,
    })),

    rate: partnerRupees(RATE_PAISE),
    maxMahine: MAX_MONTHS,
  };
}

/** Link se aane wale ko dikhane ke liye — kiska link hai */
export async function refInfo(refCode) {
  const sm = await Salesman.findOne({
    refCode: String(refCode || '').trim().toUpperCase(), active: true,
  }).select('name refCode').lean();
  if (!sm) return null;
  return { name: sm.name, refCode: sm.refCode };
}

export { RATE_PAISE, MAX_MONTHS };
