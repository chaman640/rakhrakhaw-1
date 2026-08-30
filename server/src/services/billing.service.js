import ApiError from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { cacheGet, cacheSet } from '../utils/cache.js';
import {
  createOrder, verifyCheckoutSignature, verifyWebhookSignature,
  createPlan, createSubscription, updateSubscriptionPlan,
  cancelSubscriptionAt, verifySubscriptionSignature, cancelScheduledChange,
} from './razorpay.service.js';
import { ROLES } from '../config/constants.js';
import {
  BILLING_MODES, PLANS, PAID_PLANS, PLAN_BY_CODE, FREE_PLAN,
  SUB_STATUS, seatsOf, seatsAllow, rupees,
} from '../config/billing.js';
import { Subscription, User, BillingOrder, RazorpayPlan } from '../models/index.js';
import { creditReferral, reverseReferral } from './partner.service.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * "IS DUKAAN KA PAISA CHUKTA HAI YA NAHI" — POORE APP ME EK HI JAWAB.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Poora billing sirf DO sawal pe khada hai:
 *
 *     1. is dukaan ki mohlat baaki hai?          ->  subscriptionOf()
 *     2. itne account is plan me aayenge?        ->  assertSeat()
 *
 * Baaki sab (Razorpay, webhook, renew) inhi do ke upar rakha jayega. Isliye
 * ye file jaan-boojh kar chhoti hai aur ismein kisi payment company ka naam
 * tak nahi hai — provider badalne pe ye file waisi ki waisi rehni chahiye.
 */

const isFreeMode = () => env.billing.mode === BILLING_MODES.FREE;

/*
  Ek mahina aage — bina tareekh phisle.

  `setMonth(+1)` 31 January pe "31 February" banata hai, jise JS chup-chaap
  3 March kar deta hai. Yaani har mahine do din muft. Jinka cycle 29-31 ko
  shuru hota hai, unpe ye har baar hota hai.
*/
function mahinaAage(from, n = 1) {
  const d = new Date(from);
  const din = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const aakhri = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(din, aakhri));
  return d;
}

/* ─────────────────────────────────────────────── plan ki list (public) */

export function planCatalog() {
  const hit = cacheGet('plans');
  if (hit) return hit;
  return cacheSet('plans', {
    mode: env.billing.mode,
    /*
      Free mode me bhi POORI list jati hai, bas `chargingNow: false` ke saath.

      Wajah: pricing ka page tab bhi khulna chahiye. Razorpay merchant account
      ke liye daam ka page bina login ke dikhna zaroori hai — aur wo page tab
      banana padta hai jab abhi paisa liya hi nahi ja raha.
    */
    chargingNow: !isFreeMode(),
    graceDays: env.billing.graceDays,
    plans: PLANS.map((p) => ({
      ...p,
      priceRupees: rupees(p.pricePaise),
      // "jitne chahein" ko number me badal kar bhejna sabse aasan galti hai
      unlimited: p.seats === null,
    })),
  }, 3600000);
}

/* ─────────────────────────────────────────── ek dukaan ki haalat */

/**
 * Haalat TAREEKH se nikalti hai, kisi field se nahi.
 *
 * Ek `status` alag se rakh kar use cron se badalna — wahi hai jahan aise
 * system tootte hain. Cron ek din na chale to ya to sabki dukaan band ho jati
 * hai, ya kisi ki bhi band nahi hoti. Tareekh se nikala hua jawab kabhi purana
 * nahi hota, aur cron ki zarurat hi nahi padti.
 */
export function statusOf(sub, now = new Date()) {
  if (!sub || !sub.paidTill) return SUB_STATUS.EXPIRED;
  if (sub.cancelledAt && !sub.autoRenew && sub.paidTill < now) return SUB_STATUS.CANCELLED;

  if (sub.paidTill >= now) return SUB_STATUS.ACTIVE;

  const graceTill = new Date(sub.paidTill);
  graceTill.setDate(graceTill.getDate() + env.billing.graceDays);
  return graceTill >= now ? SUB_STATUS.GRACE : SUB_STATUS.EXPIRED;
}

/** Dukaan ka chalu hona — grace me bhi sab chalta hai, bas yaad dilaya jata hai */
export function isUsable(status) {
  return status === SUB_STATUS.ACTIVE || status === SUB_STATUS.GRACE;
}

export async function subscriptionOf(businessId) {
  const sub = await Subscription.findOne({ businessId }).lean();
  const status = statusOf(sub);
  const planCode = sub?.planCode || FREE_PLAN.code;
  const plan = PLAN_BY_CODE[planCode] || FREE_PLAN;

  return {
    sub,
    plan,
    planCode,
    status,
    /*
      FREE MODE ME SABKA JAWAB "HAAN" HAI.

      Ye ek line poore switch ka dil hai. Jab tak `BILLING_MODE=free` hai, is
      poore system ka koi asar nahi padta — na kisi ko rok, na kisi ko sandesh.
      Data phir bhi bilkul waise hi banta rehta hai, isliye jis din switch
      badlega us din kuch "shuru" nahi karna padega, sirf rok lagni shuru ho
      jayegi.
    */
    usable: isFreeMode() || isUsable(status),
    chargingNow: !isFreeMode(),
    seats: sub?.seats ?? seatsOf(planCode),
    paidTill: sub?.paidTill || null,
    daysLeft: sub?.paidTill
      ? Math.ceil((new Date(sub.paidTill) - Date.now()) / 86400000)
      : null,
  };
}

/* ───────────────────────────────────────────────── account ki ginti */

/**
 * Is dukaan me kitne LOGIN karne wale log hain — malik samet.
 *
 * Retailer yahan KABHI nahi aate, chahe hazaar hon. Wo dukaan ke apne log
 * nahi, graahak hain — aur unse paisa lena poore dhande ko hi maar deta hai
 * (poori wajah `config/billing.js` me).
 *
 * Band kiye hue staff bhi nahi ginte. Ek aadmi ke jaane ke baad bhi uski seat
 * ghere rakhna dukaandaar ke liye seedha jhooth hai.
 */
export async function seatsUsed(businessId) {
  return User.countDocuments({
    businessId,
    role: ROLES.WHOLESALER,
    isActive: true,
  });
}

/**
 * "Ek aur aadmi jodna hai" — aayega ya nahi.
 *
 * `extra` isliye ki bulane wale alag alag pal pe poochte hain: naya staff
 * jodte waqt (abhi wo bana nahi, isliye +1) aur band pade staff ko chalu karte
 * waqt (wo ginti me hai hi nahi, isliye bhi +1). Ek hi jagah se poochne ka
 * matlab hai ki dono jagah `<` aur `<=` ka jhagda nahi hoga.
 */
export async function assertSeat(businessId, { extra = 1 } = {}) {
  if (isFreeMode()) return;

  const { planCode, plan } = await subscriptionOf(businessId);
  const max = seatsOf(planCode);
  if (max === null) return;

  const used = await seatsUsed(businessId);
  if (seatsAllow(planCode, used + extra)) return;

  /*
    Error me AGLA PLAN bhi bhejte hain.

    "Limit poori ho gayi" ek band darwaza hai. Uske saath ye bhej dena ki
    "agla plan ₹100 ka hai aur usme 10 account aate hain" — us pal ko rukawat
    se faisle me badal deta hai. App wahin se seedha plan wale page pe le ja
    sakta hai.
  */
  const next = PAID_PLANS.find((p) => p.seats === null || p.seats > max);

  throw ApiError.badRequest(
    `Aapke "${plan.name}" plan me ${max} account aate hain, aur ${used} pehle se hain.`
    + (next
      ? ` "${next.name}" me ${next.seats === null ? 'jitne chahein' : `${next.seats} account`} — ₹${rupees(next.pricePaise)}/mahina.`
      : ''),
    {
      reason: 'seat_limit',
      planCode, used, max,
      nextPlan: next ? { code: next.code, name: next.name, seats: next.seats, priceRupees: rupees(next.pricePaise) } : null,
    },
  );
}

/* ────────────────────────────────────── bechne ka darwaza */

/**
 * "Ye dukaan bech sakti hai ya nahi."
 *
 * Kharidne wale hisse pe ye kabhi nahi lagta — wo hamesha free hai. Sirf
 * bechne wala hissa (apna stock, apna bill, apne retailer) isse guzarta hai.
 *
 * Jawab me `reason` aur `plans` dono jate hain, taaki app ek adha-adhoora
 * error dikhane ki jagah seedha wahi screen khol sake jahan se aadmi plan le
 * sakta hai. Rok tabhi kaam ki hai jab uske saath aage ka rasta bhi ho.
 */
export async function assertCanSell(businessId) {
  if (isFreeMode()) return;

  const state = await subscriptionOf(businessId);
  if (state.usable) return;

  throw ApiError.forbidden(
    state.status === SUB_STATUS.EXPIRED && state.paidTill
      ? 'Aapke plan ki mohlat khatam ho gayi hai. Bechne ka kaam chalu karne ke liye plan lein.'
      : 'Bechne ka kaam chalu karne ke liye plan lein. Kharidna hamesha free hai.',
    {
      reason: 'subscription_required',
      status: state.status,
      paidTill: state.paidTill,
      plans: PAID_PLANS.map((p) => ({
        code: p.code, name: p.name, seats: p.seats,
        priceRupees: rupees(p.pricePaise), tagline: p.tagline, popular: Boolean(p.popular),
      })),
    },
  );
}

/* ────────────────────────────────────── mohlat badhana */

/**
 * Paisa mila — mohlat aage badha do.
 *
 * Ye Razorpay ke baare me kuch nahi jaanta, aur ye jaan-boojh kar hai. Step 2
 * me webhook sirf itna karega: "sach me paisa aaya" ye pakka karke YAHI
 * function bulayega. Isliye provider badalne pe billing ka asli hisaab chhuta
 * bhi nahi.
 *
 * MOHLAT KAHAN SE GINI JATI HAI — ye chhota faisla bada farak laata hai:
 * agar mohlat abhi baaki hai to nayi mohlat USI DIN SE judti hai (aadmi ka
 * bacha hua din mara nahi jata), aur khatam ho chuki hai to AAJ se. Aaj se hi
 * ginte to jaldi renew karne wale ko saza milti — aur wahi aadmi sabse achha
 * graahak hai.
 */
export async function extendSubscription(businessId, {
  planCode, months = 1, payment = null, note = '',
}) {
  const plan = PLAN_BY_CODE[planCode];
  if (!plan || plan.pricePaise <= 0) throw ApiError.badRequest('Aisa koi plan nahi hai');

  const now = new Date();
  const existing = await Subscription.findOne({ businessId });

  const from = existing?.paidTill && existing.paidTill > now ? new Date(existing.paidTill) : now;
  const paidTill = mahinaAage(from, Number(months || 1));

  const patch = {
    planCode: plan.code,
    pricePaise: plan.pricePaise,
    seats: plan.seats,
    paidTill,
    autoRenew: true,
    cancelledAt: null,
    ...(note ? { note } : {}),
    ...(payment ? { lastPayment: { ...payment, at: new Date() } } : {}),
  };

  return Subscription.findOneAndUpdate(
    { businessId },
    { $set: patch, $setOnInsert: { businessId, startedAt: now } },
    { new: true, upsert: true },
  ).lean();
}



/* ═══════════════════════════ AUTOPAY ═══════════════════════════════════

   Paisa har mahine apne aap kate — grahak ko har baar yaad na rakhna pade.

   Ek baar ke payment me sabse badi dikkat ye thi ki grahak bhool jata tha,
   aur ek din bill banate waqt achanak "plan khatam" ka parda saamne aa jata.
   Wo pal bahut bura hota hai: uske counter pe graahak khada hota hai.
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Razorpay ka plan_id — ek baar bana kar yaad rakh liya jata hai.
 *
 * Kunji me daam bhi hai. Daam badla to naya plan banega, aur purane grahak
 * apne purane daam pe chalte rahenge — jispe unhone haan kaha tha.
 */
async function razorpayPlanId(plan) {
  const found = await RazorpayPlan.findOne({
    code: plan.code, pricePaise: plan.pricePaise,
  }).lean();
  if (found) return found.planId;

  const made = await createPlan({
    code: plan.code, name: plan.name, pricePaise: plan.pricePaise,
  });

  /*
    Do request ek saath aayein to dono plan bana lengi — Razorpay dono banata
    hai. Unique index ki wajah se doosri yahan girti hai, aur tab hum pehli
    wali padh lete hain. Ek anaath plan Razorpay me pada rah jata hai, par wo
    kisi ko kaatta nahi — us se ye khatra behtar hai ki do grahak do alag
    plan pe chale jayein.
  */
  try {
    await RazorpayPlan.create({
      code: plan.code, pricePaise: plan.pricePaise, planId: made.id,
    });
    return made.id;
  } catch {
    const again = await RazorpayPlan.findOne({
      code: plan.code, pricePaise: plan.pricePaise,
    }).lean();
    return again?.planId || made.id;
  }
}

/**
 * Autopay shuru — mandate banao aur browser ko dene layak cheezein wapas do.
 *
 * Paisa yahan NAHI katta. Yahan sirf mandate banta hai; grahak use apne UPI
 * ya card se manzoor karta hai, aur uske baad Razorpay pehla paisa kaatta
 * hai. Uski khabar webhook se aati hai — plan wahin chalu hota hai.
 */
export async function startAutopay(businessId, { planCode }) {
  if (isFreeMode()) throw ApiError.badRequest('Abhi paisa liya hi nahi ja raha — poori app free hai');

  const plan = PLAN_BY_CODE[planCode];
  if (!plan || plan.pricePaise <= 0) throw ApiError.badRequest('Aisa koi plan nahi hai');

  // Chhote plan me abhi ke log aayenge ya nahi — pehle hi rok dena behtar hai
  await assertSeatsFitPlan(businessId, plan.code);

  const sub = await Subscription.findOne({ businessId });

  /*
    Mandate pehle se chalu hai to naya nahi banate — plan badal dete hain.
    Naya banane ka matlab hota grahak se dobara mandate maangna, aur do
    mandate ek saath chalna: yaani do baar paisa katna.
  */
  /*
    SIRF WAHI MANDATE JO SACH ME CHALU HAI.

    Pehle yahan 'created' bhi tha — aur wahi sabse bura bug tha. Aadmi
    "Autopay chalu karein" dabata, Razorpay ka parda khulta, aur wo use band
    kar deta (jo sabse aam baat hai). Uske baad DB me providerSubId to chadh
    chuka hota par mandate bana hi nahi hota. Agli baar har click yahin aakar
    changePlan me chala jata — parda kabhi khulta hi nahi, aur wo dukaan
    HAMESHA KE LIYE plan nahi le paati.
  */
  if (sub?.providerSubId && ['active', 'authenticated'].includes(sub.mandateStatus)) {
    return changePlan(businessId, { planCode: plan.code });
  }

  /*
    Purana adhoora mandate pehle band.

    Bina iske do mandate ek saath khade ho jate: agar aadmi ne pehla manzoor
    kar diya ho aur uski khabar abhi tak na aayi ho, to naya banate hi uska id
    mit jata — aur us pehle mandate se paisa katta rehta, hamein pata bhi na
    chalta ki wo kahan se aa raha hai aur use band kaise karein.
  */
  if (sub?.providerSubId) {
    await cancelSubscriptionAt(sub.providerSubId, false).catch(() => {});
  }

  const planId = await razorpayPlanId(plan);
  const made = await createSubscription({
    planId,
    notes: { businessId: String(businessId), planCode: plan.code },
  });

  await Subscription.findOneAndUpdate(
    { businessId },
    {
      $set: {
        providerSubId: made.id,
        providerPlanId: planId,
        mandateStatus: made.status || 'created',
        autoRenew: true,
        cancelledAt: null,
        /*
          Chuna hua plan `mandatePlanCode` me — `planCode` me NAHI.

          Pehle main yahan seedha `planCode` likh raha tha, aur wo bahut bura
          tha: aadmi ASEEM (unlimited seat) ka mandate banata, Razorpay ka
          parda band kar deta — paisa ek rupaya nahi jata — aur use poore
          mahine unlimited seat mil jati.

          `planCode` sirf tab badalta hai jab paisa SACH ME kat jaye
          (`subscription.charged`). Yahan sirf itna likha jata hai ki manzoori
          kis plan ke liye maangi gayi thi, taaki UI "manzoori baaki" dikha
          sake aur usi plan pe dobara charge na kare.
        */
        mandatePlanCode: plan.code,
      },
      $setOnInsert: { businessId, startedAt: new Date() },
    },
    { upsert: true },
  );

  /*
    Yahan koi BillingOrder NAHI banta.

    Pehle banta tha, aur wo hamesha 'created' pe atka rehta — kyunki autopay
    me paisa Razorpay kaatta hai aur uski khabar `subscription.charged` se
    aati hai, `payment.captured` se nahi. Nateeja: "Payment ka record" me ek
    aisi line jam kar baith jati jo kabhi poori na hoti.

    Ab har asli charge pe rasid banti hai — wahi sach hai.
  */

  return {
    // `needsCheckout` — client isi se tay karta hai ki Razorpay ka parda
    // kholna hai. `autopay` naam ka khaana summary me bhi hota hai (object),
    // isliye uspe bharosa karna galat tha — wo hamesha truthy nikalta tha.
    needsCheckout: true,
    autopay: true,
    subscriptionId: made.id,
    keyId: env.razorpay.keyId,
    planCode: plan.code,
    planName: plan.name,
    amountPaise: plan.pricePaise,
    amountRupees: rupees(plan.pricePaise),
    currency: 'INR',
  };
}

/**
 * Mandate manzoor hone ke baad browser ka jawab.
 *
 * Ye sirf turant dikhane ke liye hai. Plan chalu karne ka asli zimma webhook
 * ka hai — browser ka rasta kabhi bhi toot sakta hai.
 */
export async function confirmAutopay(businessId, { subscriptionId, paymentId, signature }) {
  if (!verifySubscriptionSignature({ subscriptionId, paymentId, signature })) {
    throw ApiError.badRequest('Mandate ka saboot theek nahi hai — paisa kata ho to hum khud dekh lenge');
  }

  const sub = await Subscription.findOne({ businessId, providerSubId: subscriptionId });
  if (!sub) throw ApiError.notFound('Ye mandate hamare record me nahi hai');

  await Subscription.updateOne(
    { _id: sub._id },
    { $set: { mandateStatus: 'active' } },
  );

  return billingSummary(businessId);
}

/**
 * ITNE LOG IS PLAN ME AAYENGE YA NAHI.
 *
 * Chhota plan lete waqt sabse bada khatra yahi hai: 10 wale plan pe 8 log
 * hain, aur wo 3 wala plan le lete hain. Chup-chaap 5 logon ka login band
 * kar dena sabse bura jawab hai — subah wo aayenge aur unka kaam ruk jayega,
 * bina wajah jaane.
 *
 * Isliye plan badalne se PEHLE roka jata hai, aur seedha bataya jata hai ki
 * kitne log hatane padenge.
 */
async function assertSeatsFitPlan(businessId, planCode) {
  const max = seatsOf(planCode);
  if (max === null) return;

  const used = await seatsUsed(businessId);
  if (used <= max) return;

  throw ApiError.badRequest(
    `Abhi ${used} log login karte hain, par is plan me sirf ${max} aa sakte hain. `
    + `Pehle ${used - max} logon ka login band kar dein, phir plan badlein.`,
  );
}

/**
 * PLAN BADALNA.
 *
 * Do bilkul alag halat, aur dono ka jawab alag hona chahiye:
 *
 *   BADA PLAN (upgrade)   -> abhi. Aadmi ko abhi zarurat hai — usi waqt
 *                            staff jodna hai ya kaam ruka hua hai. Use
 *                            mahine bhar intezaar karwana bekaar hai.
 *
 *   CHHOTA PLAN (downgrade) -> mahine ke aakhir me. Poore mahine ka paisa de
 *                              chuke hain, to poore mahine ka fayda bhi mile.
 *                              Faisla abhi likh jata hai, lagta baad me hai.
 *
 * Dono me mandate WAHI rehta hai — grahak ko dobara manzoori nahi deni
 * padti. Har baar mandate maangne pe aadha aadmi wahin chhod deta hai.
 */
export async function changePlan(businessId, { planCode }) {
  if (isFreeMode()) throw ApiError.badRequest('Abhi paisa liya hi nahi ja raha — poori app free hai');

  const plan = PLAN_BY_CODE[planCode];
  if (!plan || plan.pricePaise <= 0) throw ApiError.badRequest('Aisa koi plan nahi hai');

  const sub = await Subscription.findOne({ businessId });
  if (!sub?.providerSubId) throw ApiError.badRequest('Pehle autopay chalu karein');

  if (sub.planCode === plan.code && !sub.pendingPlanCode) {
    throw ApiError.badRequest('Yahi plan to pehle se chalu hai');
  }

  await assertSeatsFitPlan(businessId, plan.code);

  /*
    Grahak ka APNA daam, config ka nahi.

    `sub.pricePaise` us din ka snapshot hai jab usne haan kaha tha. Kal aap
    CHOTI ka daam ₹50 se ₹150 kar dein, to purane grahak ke liye wo abhi bhi
    ₹50 hai. Config se padhne par ₹100 wala plan uske liye "chhota" ban jata
    aur upgrade chup-chaap mahine ke aakhir pe khisak jata — bina paise ke.
  */
  const abhiKaDaam = Number(sub.pricePaise || 0)
    || PLAN_BY_CODE[sub.planCode]?.pricePaise || 0;
  const bada = plan.pricePaise > abhiKaDaam;
  const planId = await razorpayPlanId(plan);

  /*
    Pehle se koi badlav ruka ho to use hataana zaroori hai — warna Razorpay
    naya PATCH lene se hi mana kar dega.
  */
  if (sub.pendingPlanCode) {
    await cancelScheduledChange(sub.providerSubId).catch(() => {});
  }

  await updateSubscriptionPlan(sub.providerSubId, {
    planId,
    when: bada ? 'now' : 'cycle_end',
  });

  if (bada) {
    /*
      Bada plan — abhi lag jata hai aur mahina naye sire se shuru hota hai.
      Razorpay abhi poora naya daam kaatta hai; uski pakki khabar
      `subscription.charged` webhook se aati hai aur paidTill wahin badhta
      hai. Yahan sirf itna karte hain ki grahak ko turant naya plan dikhe.
    */
    await Subscription.updateOne(
      { _id: sub._id },
      {
        $set: {
          planCode: plan.code,
          pricePaise: plan.pricePaise,
          seats: plan.seats,
          pendingPlanCode: '',
          pendingFrom: null,
        },
      },
    );
    /*
      `providerPlanId` yahan JAAN-BOOJH KAR nahi likha jata.

      Wo webhook ke waqt is baat ka nishaan hai ki plan badla hai ya nahi —
      usi se tay hota hai ki mahina aaj se ginein ya purani tareekh se. Yahan
      likh dene se webhook ko dono ek jaise dikhte, aur grahak ko poora naya
      daam dene ke baad bhi purane mahine ke bache hue din muft mil jate.
    */
    return { needsCheckout: false, changed: 'abhi', planCode: plan.code, ...(await billingSummary(businessId)) };
  }

  // Chhota plan — faisla likh diya, lagega mahine ke aakhir me
  const kabSe = sub.paidTill && sub.paidTill > new Date() ? sub.paidTill : new Date();
  await Subscription.updateOne(
    { _id: sub._id },
    { $set: { pendingPlanCode: plan.code, pendingFrom: kabSe, providerPlanId: planId } },
  );

  return {
    needsCheckout: false,
    changed: 'baad me',
    planCode: sub.planCode,
    pendingPlanCode: plan.code,
    pendingFrom: kabSe,
    ...(await billingSummary(businessId)),
  };
}

/** Rukka hua badlav wapas lein — abhi tak laga nahi hai, isliye aasan hai */
export async function undoPendingChange(businessId) {
  const sub = await Subscription.findOne({ businessId });
  if (!sub?.pendingPlanCode) throw ApiError.badRequest('Koi badlav ruka hua nahi hai');

  /*
    Razorpay pe rukka hua badlav RAD karna padta hai, doosra badlav bhejna
    nahi. Jab tak koi badlav scheduled pada hai, uspe PATCH chalta hi nahi —
    wo mana kar deta hai, aur downgrade phir bhi lag jata.
  */
  /*
    Razorpay pe badlav na mile to bhi hamara nishaan hatana chahiye.

    Pehle ye bina catch ke tha: agar wahan koi scheduled badlav tha hi nahi
    (pehle hi lag chuka, ya record khisak gaya) to ye throw kar deta aur
    `pendingPlanCode` kabhi saaf na hota — "Rehne dein" hamesha error deta aur
    patti chipki reh jati.
  */
  if (sub.providerSubId) {
    await cancelScheduledChange(sub.providerSubId).catch((e) => {
      console.warn(`[billing] scheduled change rad nahi hua (${sub.providerSubId}): ${e.message}`);
    });
  }

  await Subscription.updateOne(
    { _id: sub._id },
    { $set: { pendingPlanCode: '', pendingFrom: null } },
  );
  return billingSummary(businessId);
}

/** Malik ne aage renew band kiya — mohlat khatam hone tak sab chalta rahega */
export async function cancelSubscription(businessId) {
  const sub = await Subscription.findOne({ businessId });
  if (!sub) throw ApiError.notFound('Koi plan chalu nahi hai');

  /*
    Mandate bhi band karna ZAROORI hai — warna app me to "band" likha dikhta
    hai par Razorpay agle mahine paisa kaat leta hai. Wo ek shikayat hai jo
    seedha refund aur bharose ka nuksan banti hai.

    `cycle_end` — jo paisa de chuke hain uska poora mahina milega.
  */
  /*
    Razorpay pe band hone ke BAAD hi hamare yahan band likha jata hai.

    Pehle gadbad chup-chaap nigal li jati thi aur phir bhi "band ho gaya" likh
    diya jata. Nateeja sabse bura tarah ka hota: app kehti "aage se paisa nahi
    katega", aur Razorpay agle mahine paisa kaat leta. Wo shikayat seedha
    refund aur bharose ka nuksan banti hai.

    Isliye ab fail hone par saaf mana kar dete hain — aadmi dobara koshish kar
    sakta hai, aur use sach pata rehta hai.
  */
  if (sub.providerSubId) {
    try {
      await cancelSubscriptionAt(sub.providerSubId, true);
    } catch (err) {
      console.warn(`[billing] mandate band nahi hua (${sub.providerSubId}): ${err.message}`);
      throw ApiError.badRequest(
        'Autopay abhi band nahi ho paya — thodi der baad dobara koshish karein. '
        + 'Tab tak agla paisa kat sakta hai.',
      );
    }
  }

  /*
    `mandateStatus` bhi likhna zaroori hai.

    Razorpay cycle ke aakhir tak subscription ko 'active' hi rakhta hai, yaani
    `subscription.cancelled` ki khabar mahine bhar baad aati hai. Us beech me
    summary "Autopay chalu hai — har mahine paisa apne aap kat jayega" dikhati
    rehti thi, jo jhooth tha: paisa katna band ho chuka hota.
  */
  await Subscription.updateOne(
    { _id: sub._id },
    {
      $set: {
        autoRenew: false,
        cancelledAt: new Date(),
        mandateStatus: 'cancelling',
        pendingPlanCode: '',
        pendingFrom: null,
      },
    },
  );
  return Subscription.findById(sub._id).lean();
}

/** App ko dikhane ke liye poori halat — Settings ka billing wala hissa */
export async function billingSummary(businessId) {
  const state = await subscriptionOf(businessId);
  const used = await seatsUsed(businessId);

  return {
    mode: env.billing.mode,
    chargingNow: state.chargingNow,
    status: state.status,
    usable: state.usable,
    plan: {
      code: state.plan.code,
      name: state.plan.name,
      seats: state.plan.seats,
      unlimited: state.plan.seats === null,
      priceRupees: rupees(state.plan.pricePaise),
    },
    seatsUsed: used,
    seatsLeft: state.plan.seats === null ? null : Math.max(0, state.plan.seats - used),
    paidTill: state.paidTill,
    daysLeft: state.daysLeft,
    autoRenew: state.sub?.autoRenew ?? true,
    graceDays: env.billing.graceDays,
    lastPayment: state.sub?.lastPayment?.at ? state.sub.lastPayment : null,

    /*
      Autopay chalu hai ya nahi — aur ye plan ki halat se ALAG cheez hai.
      Paisa diya hua ho par mandate toota ho; UI ko dono alag dikhane hain.
    */
    autopay: {
      on: Boolean(state.sub?.providerSubId) && state.sub?.mandateStatus === 'active',
      status: state.sub?.mandateStatus || '',
      /*
        Kis plan ki manzoori maangi gayi thi. Ye chalu plan NAHI hai — paisa
        katne se pehle iska koi haq nahi milta. UI isse sirf "manzoori baaki"
        dikhata hai, taaki aadmi usi plan pe dobara click karke dobara charge
        na karwa le.
      */
      mangaGayaPlan: (!state.sub?.mandateStatus || state.sub?.mandateStatus !== 'active')
        ? (state.sub?.mandatePlanCode || '') : '',
      // paisa atak gaya — grahak ko abhi batana chahiye, agle mahine nahi
      atka: ['halted', 'pending'].includes(state.sub?.mandateStatus || ''),
    },

    // Chhota plan liya ho to — "{tareekh} se {plan} chalu ho jayega"
    aageWalaPlan: state.sub?.pendingPlanCode
      ? {
        code: state.sub.pendingPlanCode,
        name: PLAN_BY_CODE[state.sub.pendingPlanCode]?.name || state.sub.pendingPlanCode,
        priceRupees: rupees(PLAN_BY_CODE[state.sub.pendingPlanCode]?.pricePaise || 0),
        from: state.sub.pendingFrom,
      }
      : null,
  };
}

/* ═════════════════════════════ paisa lena (Step 2) ═════════════════════════ */

/**
 * Checkout shuru — order banao aur browser ko dene layak cheezein wapas do.
 *
 * Rakam SERVER pe tay hoti hai, client se aayi rakam kabhi nahi maani jati.
 */
export async function startCheckout(businessId, { planCode, months = 1 }, userId = null) {
  if (isFreeMode()) throw ApiError.badRequest('Abhi paisa liya hi nahi ja raha — poori app free hai');

  const plan = PLAN_BY_CODE[planCode];
  if (!plan || plan.pricePaise <= 0) throw ApiError.badRequest('Aisa koi plan nahi hai');

  const m = Math.max(1, Math.min(12, Number(months) || 1));
  const amountPaise = plan.pricePaise * m;

  const doc = await BillingOrder.create({
    businessId, planCode: plan.code, months: m, amountPaise, createdBy: userId,
  });

  try {
    const order = await createOrder({
      amountPaise,
      receipt: String(doc._id),
      notes: { businessId: String(businessId), planCode: plan.code, months: String(m) },
    });
    doc.providerOrderId = order.id;
    await doc.save();

    return {
      orderId: order.id,
      amountPaise,
      amountRupees: rupees(amountPaise),
      currency: 'INR',
      keyId: env.razorpay.keyId,          // public key — browser me jana hi hai
      planCode: plan.code,
      planName: plan.name,
      months: m,
      ourOrderId: String(doc._id),
    };
  } catch (err) {
    await BillingOrder.updateOne(
      { _id: doc._id },
      { $set: { status: 'failed', failReason: err.message?.slice(0, 200) || 'order nahi bana' } },
    );
    throw err;
  }
}

/**
 * Paisa chuka — plan chalu karo. Ek hi order pe DO baar nahi chalega.
 *
 * `status: 'created'` filter ke andar hai, isliye MongoDB do me se ek hi
 * request ko doc deta hai. Doosri ko `null` milta hai aur wo chup-chaap
 * "pehle se ho chuka" maan leti hai — verify aur webhook dono aksar saath
 * aate hain, aur ye us halat ka seedha jawab hai.
 */
async function activate(orderDoc, paymentId) {
  /*
    DAWA PEHLE, KAAM BAAD ME — aur fail hone par dawa wapas.

    Ye kram do baar badla ja chuka hai, isliye dono galtiyan yahan likhi hain:

    1. Pehle order 'paid' hota, phir plan badhta. Beech me gadbad ho jaye to
       grahak ke paas rasid hoti par app band, aur webhook dobara aane pe
       "pehle ho chuka" maan kar laut jata — wo halat kabhi theek na hoti.

    2. Phir maine ulta kar diya: plan pehle badhne laga. Us se bahut bura hua —
       `extendSubscription` ab HAR baar chalta, aur browser ka verify, phir
       `payment.captured`, phir `order.paid` — teeno ek hi payment pe aate
       hain. Yaani ek mahine ke paise me teen mahine. Aur wahi request dobara
       bhejkar koi jitne chahe mahine muft le leta.

    Sahi jawab dono ka mel hai: dawa (claim) pehle — us se ek hi request aage
    badhti hai — aur agar uske baad kaam fail ho jaye to dawa WAPAS kar dete
    hain, taaki Razorpay ki agli koshish poora kaam dobara kar sake.
  */
  const claimed = await BillingOrder.findOneAndUpdate(
    { _id: orderDoc._id, status: 'created' },
    {
      $set: {
        status: 'paid',
        providerPaymentId: paymentId || '',
        paidAt: new Date(),
        receiptNo: `RR-${String(orderDoc._id).slice(-8).toUpperCase()}`,
      },
    },
    { new: true },
  );
  if (!claimed) return { alreadyDone: true };

  try {
    await extendSubscription(claimed.businessId, {
      planCode: claimed.planCode,
      months: claimed.months,
      payment: {
        provider: 'razorpay',
        orderId: claimed.providerOrderId,
        paymentId: paymentId || '',
        amountPaise: claimed.amountPaise,
      },
    });
  } catch (err) {
    // Dawa wapas — order phir 'created' ho jata hai aur agli koshish chalegi
    await BillingOrder.updateOne(
      { _id: claimed._id, status: 'paid' },
      { $set: { status: 'created', paidAt: null, receiptNo: '' } },
    ).catch(() => {});
    throw err;
  }

  // Ek baar me kai mahine ka paisa aaya to salesman ko bhi utne hi mahine ka
  creditReferral({
    businessId: claimed.businessId,
    months: claimed.months || 1,
    sourceId: paymentId || claimed.providerOrderId,
  }).catch(() => {});

  return { alreadyDone: false, order: claimed };
}

/** Browser checkout ke baad — signature theek hai to plan chalu */
export async function confirmCheckout(businessId, { orderId, paymentId, signature }) {
  if (!verifyCheckoutSignature({ orderId, paymentId, signature })) {
    throw ApiError.badRequest('Payment ka saboot theek nahi hai — paisa kata ho to hum khud dekh lenge');
  }

  const doc = await BillingOrder.findOne({ providerOrderId: orderId, businessId });
  if (!doc) throw ApiError.notFound('Ye payment hamare record me nahi hai');

  await activate(doc, paymentId);
  return billingSummary(businessId);
}

/**
 * Razorpay ka webhook — ASLI sach yahi hai.
 *
 * Browser wala rasta bharosemand nahi: net kat sakta hai, tab band ho sakta
 * hai, aadmi wapas aa hi na. Webhook har haal me aata hai, isliye plan chalu
 * karne ka asli zimma isi ka hai — browser wala rasta sirf turant dikhane ke
 * liye hai.
 */
export async function handleWebhook(rawBody, signature) {
  if (!verifyWebhookSignature(rawBody, signature)) {
    throw ApiError.unauthorized('Webhook ka saboot theek nahi hai');
  }

  let event;
  try { event = JSON.parse(rawBody.toString('utf8')); } catch { throw ApiError.badRequest('Webhook padha nahi gaya'); }

  const kind = event?.event || '';

  // Autopay wale event ka rasta alag hai — unme order hota hi nahi
  if (kind.startsWith('subscription.')) return handleSubscriptionEvent(kind, event);

  const payment = event?.payload?.payment?.entity
    // Refund ki khabar me kabhi-kabhi payment alag khaane me aata hai
    || event?.payload?.refund?.entity
    || null;
  if (!payment) return { ignored: kind };

  /*
    REFUND — order dhundhne se PEHLE.

    Autopay ke refund me `payment.order_id` hamare kisi order se milta hi
    nahi (wo Razorpay ka apna invoice order hota hai). Neeche wala
    "order nahi mila" isse pehle hi laut jata, aur commission kabhi wapas na
    hota — yaani ek salesman apne dost se paisa dilwa kar, commission lekar,
    dost se chargeback karwa sakta tha.

    Isliye dukaan `payment.id` se dhundhi jati hai (har charge ki rasid me wo
    likha jata hai), aur wo na mile to order se.
  */
  if (kind === 'payment.refunded' || kind === 'refund.created' || kind === 'refund.processed') {
    const rasid = await BillingOrder.findOne({
      $or: [{ providerPaymentId: payment.id }, { providerOrderId: payment.order_id }],
    }).select('businessId').lean();

    const biz = rasid?.businessId || payment?.notes?.businessId || null;
    if (!biz) return { ignored: 'refund — dukaan nahi mili' };

    reverseReferral({ businessId: biz, sourceId: payment.id }).catch(() => {});
    return { ok: true, refunded: true };
  }

  const doc = await BillingOrder.findOne({ providerOrderId: payment.order_id });
  if (!doc) return { ignored: 'order nahi mila' };

  if (kind === 'payment.captured' || kind === 'order.paid') {
    const r = await activate(doc, payment.id);
    return { ok: true, alreadyDone: r.alreadyDone };
  }

  if (kind === 'payment.failed') {
    await BillingOrder.updateOne(
      { _id: doc._id, status: 'created' },
      { $set: { status: 'failed', failReason: payment.error_description?.slice(0, 200) || 'fail' } },
    );
    return { ok: true, failed: true };
  }

  return { ignored: kind };
}


/**
 * AUTOPAY KE EVENT — har mahine ka sach yahin se aata hai.
 *
 * Hum har mahine kuch nahi karte; Razorpay paisa kaat kar khabar bhejta hai.
 * Isliye `paidTill` badhane ka ek hi asli darwaza yahi hai.
 *
 *   subscription.charged    paisa kat gaya  -> ek mahina aur
 *   subscription.activated  mandate chalu
 *   subscription.halted     paisa baar baar fail -> aage nahi katega
 *   subscription.cancelled  band ho gaya
 *   subscription.pending    ek baar fail hua, Razorpay dobara koshish karega
 */
async function handleSubscriptionEvent(kind, event) {
  const ent = event?.payload?.subscription?.entity;
  if (!ent?.id) return { ignored: `${kind} — subscription nahi mila` };

  const sub = await Subscription.findOne({ providerSubId: ent.id });
  if (!sub) return { ignored: `${kind} — hamare record me nahi` };

  if (kind === 'subscription.charged') {
    const payment = event?.payload?.payment?.entity || {};

    /*
      EK PAYMENT KA EK HI MAHINA.

      Razorpay har khabar kam se kam ek baar bhejta hai, aur jawab der se
      pahunche ya container restart ho jaye to wo dobara bhejta hai. Dashboard
      se haath se bhi dobara bheji ja sakti hai. Bina rok ke wahi ek payment
      DO mahine chadha deta tha — yaani ek mahine ka paisa, do mahine ki
      mohlat.
    */
    const payId = payment.id || event?.payload?.invoice?.entity?.id || '';

    /*
      POORE ITIHAAS SE MILAO, sirf aakhri payment se nahi.

      Neeche `lastPayment.paymentId` wala filter sirf SABSE NAYE payment ko
      rokta hai. Do mahine baad Razorpay pehle mahine wali khabar dobara bheje
      (ya aap dashboard se dobara bhejein) to wo filter use nayi maan leta —
      ek aur mahina muft. Har charge ki rasid banti hai, isliye wahi puchh
      lena sabse pakka jawab hai.
    */
    if (payId && await BillingOrder.exists({ providerPaymentId: payId })) {
      return { ok: true, alreadyDone: true };
    }

    /*
      KAUN SA PLAN — Razorpay ke plan_id se, hamare record se nahi.

      Chhota plan mahine ke aakhir me lagta hai, aur wo badlav Razorpay ke
      paas hota hai. Agar hum apna purana planCode maan lein to grahak chhote
      plan ka paisa deta rahega par bade plan ki seat paata rahega. Asli sach
      wahi hai jispe paisa kata — yaani Razorpay ka plan_id.
    */
    const mapped = await RazorpayPlan.findOne({ planId: ent.plan_id }).lean();
    const code = mapped?.code || sub.pendingPlanCode || sub.planCode;
    const plan = PLAN_BY_CODE[code] || PLAN_BY_CODE[sub.planCode];

    /*
      PAISA KATA HAI, TO PLAN FREE NAHI HO SAKTA.

      Agar kisi wajah se plan pehchana na jaye (mapping na bani ho, ya plan
      config se hat gaya ho) to purana code `FREE` par gir jata tha — yaani
      ₹2000 dene wale grahak ko 3 seat wala free plan mil jata. Aisi halat me
      kuch na karna behtar hai: khabar log me jayegi aur haath se theek ho
      jayega. Chup-chaap galat plan likh dena sabse bura hai.
    */
    if (!plan || plan.pricePaise <= 0) {
      console.error(`[billing] plan pehchana nahi gaya — sub ${ent.id}, plan_id ${ent.plan_id}`);
      return { ignored: 'plan pehchana nahi gaya' };
    }

    const now = new Date();

    /*
      PLAN BADLA HO TO MAHINA AAJ SE.

      Bada plan lete waqt Razorpay poora naya daam abhi kaat leta hai aur uska
      apna cycle aaj se shuru hota hai. Purani `paidTill` me mahina jodte
      rehne se hamari tareekh Razorpay se har upgrade pe aage khisakti jati —
      aur aadmi ko wo din muft milte jinka paisa aaya hi nahi.
    */
    const planBadla = sub.providerPlanId && ent.plan_id && sub.providerPlanId !== ent.plan_id;
    const from = (!planBadla && sub.paidTill && sub.paidTill > now) ? new Date(sub.paidTill) : now;
    const paidTill = mahinaAage(from, 1);

    const claimed = await Subscription.findOneAndUpdate(
      {
        _id: sub._id,
        // Wahi payment dobara aaye to yahan doc milta hi nahi
        ...(payId ? { 'lastPayment.paymentId': { $ne: payId } } : {}),
      },
      {
        $set: {
          planCode: plan.code,
          pricePaise: plan.pricePaise,
          seats: plan.seats,
          paidTill,
          mandateStatus: 'active',
          autoRenew: true,
          cancelledAt: null,
          pendingPlanCode: '',
          pendingFrom: null,
          mandatePlanCode: '',
          providerPlanId: ent.plan_id || sub.providerPlanId,
          lastPayment: {
            provider: 'razorpay',
            orderId: ent.id,
            paymentId: payId,
            amountPaise: payment.amount || plan.pricePaise,
            at: now,
          },
        },
      },
      { new: true },
    );

    // Wahi khabar dobara aayi — pehle hi chadh chuka hai, kuch nahi karna
    if (!claimed) return { ok: true, alreadyDone: true };

    /*
      Salesman ka commission — payment ke saath hi.

      `sourceId` me PAYMENT ka id jata hai, subscription ka nahi. Subscription
      id har mahine wahi rehta hai; use bhejne se doosre mahine se hi "pehle
      chadh chuka" maan liya jata aur salesman ko poore saal me sirf ₹30
      milte.

      `.catch` isliye ki commission ki koi bhi gadbad grahak ke plan ko na
      roke — uska paisa aa chuka hai.
    */
    creditReferral({
      businessId: sub.businessId,
      months: 1,
      sourceId: payId || `${ent.id}:${now.toISOString().slice(0, 10)}`,
    }).catch(() => {});

    /*
      Har mahine ki rasid.

      Bina iske "Payment ka record" me sirf pehla mahina dikhta aur uske baad
      kuch nahi — jabki paisa har mahine kat raha hota. Grahak ko apna hisaab
      dikhna chahiye, aur GST wale ko rasid chahiye.
    */
    BillingOrder.create({
      businessId: sub.businessId,
      planCode: plan.code,
      months: 1,
      amountPaise: payment.amount || plan.pricePaise,
      status: 'paid',
      providerOrderId: payId || undefined,
      providerPaymentId: payId || '',
      paidAt: now,
      receiptNo: `RR-${String(payId || ent.id).slice(-8).toUpperCase()}`,
    }).catch((e) => console.warn('[billing] rasid nahi bani:', e.message));

    return { ok: true, charged: plan.code, paidTill };
  }

  if (kind === 'subscription.activated' || kind === 'subscription.authenticated') {
    await Subscription.updateOne({ _id: sub._id }, { $set: { mandateStatus: 'active' } });
    return { ok: true, mandate: 'active' };
  }

  if (kind === 'subscription.halted' || kind === 'subscription.pending') {
    /*
      Yahan plan BAND NAHI karte — sirf mandate ki halat likhte hain.

      `paidTill` abhi bhi aage ho sakti hai, yaani grahak ka paisa chal raha
      hai. Use us pal band kar dena jab uska bill beech me hai, sabse bura
      jawab hai. App khud yaad dila dega ki payment atak gayi hai.
    */
    await Subscription.updateOne(
      { _id: sub._id },
      { $set: { mandateStatus: kind === 'subscription.halted' ? 'halted' : 'pending' } },
    );
    return { ok: true, mandate: kind.split('.')[1] };
  }

  if (kind === 'subscription.cancelled' || kind === 'subscription.completed') {
    await Subscription.updateOne(
      { _id: sub._id },
      { $set: { mandateStatus: 'cancelled', autoRenew: false, cancelledAt: new Date() } },
    );
    return { ok: true, mandate: 'cancelled' };
  }

  return { ignored: kind };
}

/** Payment ki history — rasid ke liye */
export async function paymentHistory(businessId, { limit = 20 } = {}) {
  const rows = await BillingOrder.find({ businessId })
    .sort({ createdAt: -1 }).limit(Math.min(limit, 50))
    .select('planCode months amountPaise status paidAt receiptNo providerPaymentId createdAt')
    .lean();

  return rows.map((r) => ({
    ...r,
    amountRupees: rupees(r.amountPaise),
    planName: PLAN_BY_CODE[r.planCode]?.name || r.planCode,
  }));
}
