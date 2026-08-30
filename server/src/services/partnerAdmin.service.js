import jwt from 'jsonwebtoken';
import ApiError from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { partnerRupees, baakiPaise } from '../config/partner.js';
import {
  PartnerAdmin, Salesman, Referral, Commission, Payout,
} from '../models/index.js';

/**
 * ADMIN KA PANEL — "kisko kitna dena hai".
 *
 * Yahan se paisa NAHI jata. Aap khud UPI ya bank se bhejte hain aur yahan
 * "de diya" mark kar dete hain. Payout ka koi API nahi jodna hi is system ki
 * sabse badi suraksha hai: jo rasta hai hi nahi, us se paisa chori nahi ho
 * sakta.
 */

const AUD = 'partner-admin';

export function signAdminToken(admin) {
  return jwt.sign(
    { sub: String(admin._id), aud: AUD, ts: admin.tokenSeq || 0 },
    env.jwtSecret, { expiresIn: '2d' },
  );
}

export function readAdminToken(token) {
  const d = jwt.verify(token, env.jwtSecret);
  if (d.aud !== AUD) throw ApiError.unauthorized();
  return d;
}

/**
 * Pehli baar `.env` se admin ban jata hai.
 *
 * Uske baad password panel se badla ja sakta hai, aur BADALNE KE BAAD `.env`
 * wala purana password CHALTA NAHI. Wahi hona bhi chahiye — warna password
 * badalne ka koi matlab nahi rehta, purana rasta khula rehta aur aadmi ko
 * lagta ki usne band kar diya.
 */
async function ensureAdmin() {
  const email = (env.partnerAdmin.email || '').toLowerCase().trim();
  if (!email) return null;

  let admin = await PartnerAdmin.findOne({ email });
  if (admin) return admin;

  if (!env.partnerAdmin.password) return null;

  admin = new PartnerAdmin({ email, passwordHash: 'temp' });
  await admin.setPassword(env.partnerAdmin.password);
  await admin.save();
  console.warn(`[partner] admin bana: ${email} — pehla login ke baad password badal lein`);
  return admin;
}

export async function adminLogin({ email, password }) {
  const admin = await ensureAdmin();
  const mail = String(email || '').toLowerCase().trim();

  // Ek hi jawab dono halat me — kaunsa email chalta hai, ye batana bhi ek chabi hai
  if (!admin || admin.email !== mail || !(await admin.checkPassword(password))) {
    throw ApiError.unauthorized('Email ya password galat hai');
  }

  admin.lastLoginAt = new Date();
  await admin.save();

  return {
    token: signAdminToken(admin),
    email: admin.email,
    // Panel me chetavni dikhane ke liye — .env wala password abhi tak chal raha hai
    passwordChanged: admin.passwordChanged,
  };
}

export async function adminChangePassword(adminId, { currentPassword, newPassword }) {
  const admin = await PartnerAdmin.findById(adminId);
  if (!admin) throw ApiError.notFound('Admin nahi mila');
  if (!(await admin.checkPassword(currentPassword))) {
    throw ApiError.badRequest('Purana password galat hai');
  }
  if (String(newPassword).length < 8) {
    throw ApiError.badRequest('Naya password kam se kam 8 akshar ka rakhein');
  }

  await admin.setPassword(newPassword);
  admin.passwordChanged = true;
  /*
    Purane token bhi band.

    Sirf password badalna kaafi nahi tha: jo token pehle ban chuka hai wo 2
    din aur chalta rehta. Yaani chaabi leak hone ke baad password badalne se
    bhi 48 ghante tak sabka bank account dikhta rehta. `tokenSeq` badalte hi
    har purana token bekaar ho jata hai.
  */
  admin.tokenSeq = (admin.tokenSeq || 0) + 1;
  await admin.save();
  return { ok: true, dobaraLoginKarein: true };
}

/** Sabki list — kisko kitna dena hai, bade baaki wale sabse upar */
export async function adminList({ q = '' } = {}) {
  const query = {};
  const needle = String(q || '').trim().slice(0, 40);
  if (needle) {
    /*
      Do dikkatein theek ki gayi hain:

      1. Pehle number wali line hamesha judti thi. "Ramesh" me koi ank nahi
         hai, isliye wo khali string ban jati — aur `$regex: ''` SAB SE
         milta hai. Yaani naam se dhundhne pe poori list lautti thi.
      2. Aadmi ka likha hua seedha regex ban raha tha. "(a+)+" jaisa kuch
         daalne par mongod atak jata, aur naam me "(" hone par 500 aata.
    */
    const safe = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ank = needle.replace(/\D/g, '');
    query.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { refCode: needle.toUpperCase() },
      ...(ank.length >= 3 ? [{ phone: { $regex: ank } }] : []),
    ];
  }

  const list = await Salesman.find(query).sort({ createdAt: -1 }).limit(500).lean();

  const rows = list.map((s) => ({
    _id: s._id,
    name: s.name,
    phone: s.phone,
    refCode: s.refCode,
    payout: s.payout,
    joinedCount: s.joinedCount || 0,
    kamaiRupees: partnerRupees(s.earnedPaise),
    diyaRupees: partnerRupees(s.paidPaise),
    baakiRupees: partnerRupees(baakiPaise(s)),
    active: s.active,
    juda: s.createdAt,
  }));

  rows.sort((a, b) => b.baakiRupees - a.baakiRupees);

  return {
    salesmen: rows,
    jod: {
      log: rows.length,
      kulKamai: rows.reduce((n, r) => n + r.kamaiRupees, 0),
      kulDiya: rows.reduce((n, r) => n + r.diyaRupees, 0),
      kulBaaki: rows.reduce((n, r) => n + r.baakiRupees, 0),
    },
  };
}

/** Ek salesman ka poora byora — dene se pehle dekh lene ke liye */
export async function adminOne(salesmanId) {
  const sm = await Salesman.findById(salesmanId).lean();
  if (!sm) throw ApiError.notFound('Salesman nahi mila');

  const [refs, comms, payouts] = await Promise.all([
    Referral.find({ salesmanId }).sort({ createdAt: -1 }).limit(300).lean(),
    Commission.find({ salesmanId }).sort({ createdAt: -1 }).limit(300).lean(),
    Payout.find({ salesmanId }).sort({ createdAt: -1 }).limit(100).lean(),
  ]);

  return {
    salesman: {
      _id: sm._id,
      name: sm.name,
      phone: sm.phone,
      refCode: sm.refCode,
      payout: sm.payout,
      active: sm.active,
      kamaiRupees: partnerRupees(sm.earnedPaise),
      diyaRupees: partnerRupees(sm.paidPaise),
      baakiRupees: partnerRupees(baakiPaise(sm)),
    },
    dukaanein: refs.map((r) => ({
      shopName: r.shopName, phone: r.ownerPhone, juda: r.createdAt,
      mahine: r.monthsCredited, kamaiRupees: partnerRupees(r.earnedPaise),
    })),
    kamai: comms.map((c) => ({
      kab: c.createdAt, shopName: c.shopName, months: c.months,
      rupees: partnerRupees(c.amountPaise),
    })),
    diyaGaya: payouts.map((p) => ({
      kab: p.createdAt, rupees: partnerRupees(p.amountPaise),
      reference: p.reference, note: p.note,
    })),
  };
}

/**
 * "DE DIYA" — paisa bhejne ke BAAD dabaya jata hai.
 *
 * `paidPaise` par `$inc` chalta hai, `$set` nahi. Do baar dabane par bhi
 * hisaab uljhta nahi — har dabav apni alag line banata hai, aur jod hamesha
 * un lines ke barabar rehta hai.
 *
 * Baaki se ZYADA nahi diya ja sakta. Ye rok isliye hai ki ek galat digit
 * (₹300 ki jagah ₹3000) chup-chaap na chala jaye — aur wo galti aksar mobile
 * pe hoti hai.
 */
export async function adminMarkPaid(salesmanId, { amountRupees, reference = '', note = '' }) {
  const sm = await Salesman.findById(salesmanId);
  if (!sm) throw ApiError.notFound('Salesman nahi mila');

  const paise = Math.round(Number(amountRupees) * 100);
  if (!Number.isFinite(paise) || paise === 0) throw ApiError.badRequest('Rakam theek nahi hai');

  const paidTo = sm.payout?.mode === 'bank'
    ? `${sm.payout.accountName} · ${sm.payout.accountNumber} · ${sm.payout.ifsc}`
    : sm.payout?.upiId || '';

  /*
    JAANCH AUR BADLAV EK HI KADAM ME.

    Pehle teen alag kadam the: doc padho, baaki gino, phir $inc karo. Mobile
    pe "De diya" do baar dab jaye (ya do tab khule hon) to dono padhte waqt
    baaki poora dekhte the aur dono nikal jate — hisaab me do guna paisa
    "diya hua" chadh jata.

    Ab hadd `$expr` ke andar filter me hai, isliye MongoDB khud dono me se ek
    hi ko chalne deta hai. Doosre ko doc milta hi nahi.

    Minus wali rakam (sudhaar) pe hadd nahi lagti — wo to hisaab GHATATI hai.
  */
  const claimed = paise < 0
    ? await Salesman.findOneAndUpdate(
      { _id: salesmanId, $expr: { $gte: [{ $add: ['$paidPaise', paise] }, 0] } },
      { $inc: { paidPaise: paise } },
      { new: true },
    )
    : await Salesman.findOneAndUpdate(
      {
        _id: salesmanId,
        $expr: { $lte: [paise, { $subtract: ['$earnedPaise', '$paidPaise'] }] },
      },
      { $inc: { paidPaise: paise } },
      { new: true },
    );

  if (!claimed) {
    const baaki = baakiPaise(sm);
    throw ApiError.badRequest(
      paise < 0
        ? `Itna sudhaar nahi ho sakta — abhi tak sirf ₹${partnerRupees(sm.paidPaise)} diya hua hai`
        : `Sirf ₹${partnerRupees(baaki)} dena baaki hai — isse zyada mark nahi kar sakte`,
    );
  }

  await Payout.create({
    salesmanId, amountPaise: paise, reference: String(reference).trim(),
    note: String(note).trim(), paidTo,
  });

  return adminOne(salesmanId);
}

/** Account band/chalu — band karne par uska link kaam karna band kar deta hai */
export async function adminToggle(salesmanId, active) {
  const sm = await Salesman.findByIdAndUpdate(
    salesmanId, { $set: { active: Boolean(active) } }, { new: true },
  ).lean();
  if (!sm) throw ApiError.notFound('Salesman nahi mila');
  return { _id: sm._id, active: sm.active };
}
