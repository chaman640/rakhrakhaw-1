/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PAISA LAGEGA YA NAHI — POORE APP KA EK HI SWITCH.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `BILLING_MODE` bilkul `NODE_ENV` jaisa hai:
 *
 *     BILLING_MODE=free    ->  aaj jaisa hi sab kuch, sabke liye khula
 *     BILLING_MODE=paid    ->  bechne wala hissa paise maangega
 *
 * Ek line badli, server dobara chala, ho gaya. Na koi migration, na koi
 * database ka kaam, na code me kahin haath.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * KAUN SA HISSA PAISE MAANGTA HAI — aur kyun sirf wahi
 *
 *   BECHNE WALA (wholesaler)  ->  PAISE LAGENGE
 *   KHAREEDNE WALA (retailer) ->  HAMESHA FREE
 *
 * Ye ek soch-samajh kar liya gaya faisla hai, koi shortcut nahi.
 *
 * Retailer se paisa maangna poore dhande ko hi maar deta hai: wholesaler app
 * isliye leta hai ki uske retailer usme aayein aur uska maal dekhein. Agar
 * retailer ko paisa dena pada to wo aayega hi nahi — aur wholesaler ke liye
 * app ka matlab hi khatam. Yaani retailer ka free hona wholesaler ki hi
 * zarurat hai, uspe ehsaan nahi.
 *
 * Aur jis din wahi retailer khud bechna chahe — apna stock, apna bill, apne
 * retailer — us din wo bechne wala ban gaya. Tab paise lagenge. Line saaf hai
 * aur usse samjhana bhi aasan hai: "dekhna free hai, bechna nahi".
 *
 * ───────────────────────────────────────────────────────────────────────────
 * GINTI ACCOUNT KI HAI, DUKAAN KI NAHI
 *
 * Plan me jo number hai wo LOGIN karne wale aadmiyon ka hai — malik khud bhi
 * usi me gina jata hai. Isliye "3 account" ka matlab hai malik + 2 staff, aur
 * dukaandaar ko yahi hisaab samajh aata hai: "mere yahan teen log app chalate
 * hain".
 *
 * Retailer is ginti me KABHI nahi aate, chahe hazaar hon. Wo dukaan ke apne
 * log nahi hain — wo graahak hain.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const BILLING_MODES = { FREE: 'free', PAID: 'paid' };

/**
 * PLAN — daam mahine ka, paise (paisa) me.
 *
 * Rupaye nahi, PAISE. Razorpay bhi paise me hi kaam karta hai, aur poore
 * system me ek hi ikai rakhne se wo galti hoti hi nahi jisme ₹50 ka bill
 * ₹0.50 ka ya ₹5,000 ka ban jata hai. Dikhate waqt 100 se bhaag dete hain —
 * wo ek hi jagah hota hai.
 *
 * `seats: null` = jitne chahein. `null` isliye ki koi bada number (999999)
 * likh dena ek din kisi jaanch me sach maan liya jata hai; `null` ka matlab
 * har jagah saaf rehta hai — "ginti hai hi nahi".
 */
export const PLANS = [
  {
    code: 'FREE',
    name: 'Free',
    seats: 3,
    pricePaise: 0,
    tagline: 'Kharidne ke liye — hamesha free',
    features: [
      'Dukaanein dhundhein aur maal dekhein',
      'Order bhejein, apna khata dekhein',
      'Bill aur payment ka poora record',
    ],
  },
  {
    code: 'CHOTI',
    name: 'Chhoti dukaan',
    seats: 3,
    pricePaise: 5000,          // ₹50
    tagline: 'Aap aur do log',
    features: [
      'Apna stock, apna bill, apna khata',
      'Retailer aap se seedha order karein',
      '3 account — aap + 2 staff',
    ],
  },
  {
    code: 'BADHTI',
    name: 'Badhti dukaan',
    seats: 10,
    pricePaise: 10000,         // ₹100
    tagline: 'Das log tak',
    popular: true,
    features: [
      'Chhoti dukaan wala sab kuch',
      '10 account — salesman, munshi, godown',
      'Har aadmi ko sirf uska kaam',
    ],
  },
  {
    code: 'BADI',
    name: 'Badi dukaan',
    seats: 20,
    pricePaise: 50000,         // ₹500
    tagline: 'Bees log tak',
    features: [
      'Badhti dukaan wala sab kuch',
      '20 account',
      'Kai counter, kai godown',
    ],
  },
  {
    code: 'ASEEM',
    name: 'Aseem',
    seats: null,               // jitne chahein
    pricePaise: 200000,        // ₹2000
    tagline: 'Jitne account chahein',
    features: [
      'Badi dukaan wala sab kuch',
      'Account ki koi ginti nahi',
      'Kitni bhi badi team',
    ],
  },
];

export const PLAN_BY_CODE = Object.fromEntries(PLANS.map((p) => [p.code, p]));

/** Free ko chhod kar wahi plan jo sach me kharide ja sakte hain */
export const PAID_PLANS = PLANS.filter((p) => p.pricePaise > 0);

export const FREE_PLAN = PLAN_BY_CODE.FREE;

/**
 * Subscription ki haalat.
 *
 * `GRACE` khaas hai. Payment fail hona bahut aam hai — card ki limit, UPI ka
 * mandate, bank ka server. Us ek pal me poori dukaan band kar dena sabse bura
 * jawab hai: aadmi ka bill beech me ruk jata hai aur uska graahak saamne khada
 * hota hai. Isliye kuch din ki mohlat milti hai, jisme sab chalta rehta hai
 * aur app roz yaad dilata hai.
 */
export const SUB_STATUS = {
  ACTIVE: 'active',
  GRACE: 'grace',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
};

/** ₹ me dikhane ke liye — poore app me yahi ek jagah bhaag lagti hai */
export function rupees(paise) {
  return Math.round(Number(paise || 0)) / 100;
}

/**
 * Kitne account is plan me aa sakte hain.
 *
 * `null` ka matlab "koi hadd nahi" — aur wahi wapas jata hai, koi bada number
 * nahi. Bulane wale ko `null` ki jaanch karni hi padegi, aur yahi hum chahte
 * hain: hadd na hone ko galti se ek number samajh liya jana wo bug hai jo
 * mahine baad pakda jata hai.
 */
export function seatsOf(planCode) {
  const plan = PLAN_BY_CODE[planCode];
  return plan ? plan.seats : FREE_PLAN.seats;
}

/**
 * Is plan me itne account aa sakte hain ya nahi.
 *
 * Ek jagah likha hai kyunki ye jaanch teen jagah lagti hai — staff jodte waqt,
 * staff ko wapas chalu karte waqt, aur plan chhota karte waqt. Teen jagah teen
 * baar likhne ka matlab hota ek jagah `<` aur doosri jagah `<=`.
 */
export function seatsAllow(planCode, count) {
  const max = seatsOf(planCode);
  if (max === null) return true;
  return Number(count) <= max;
}
