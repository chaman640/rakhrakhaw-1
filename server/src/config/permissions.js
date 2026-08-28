/**
 * KISKO KYA KARNE KI IJAZAT HAI — poore app ka ek hi kanoon.
 *
 * Pehle ijazat sirf itni thi: "Orders ka access hai ya nahi". Uska matlab tha
 * ki jise order dekhne diya, wo order MITA bhi sakta tha. CA ko sirf hisaab
 * dikhana chahte the — mumkin hi nahi tha, kyunki dikhane ke saath badalne ka
 * haq bhi chala jata tha.
 *
 * Ab ijazat do hisso me hai:
 *
 *      module   :   kaam
 *      ───────      ────
 *      invoices :   create      →  "bill bana sakta hai"
 *      khata    :   view        →  "hisaab sirf dekh sakta hai"
 *
 * Poore app me ijazat hamesha isi shakal me likhi jati hai: `module:kaam`.
 */

/* ─────────────────────────────── module ─────────────────────────────── */

export const MODULES = {
  ITEMS: 'items',
  PARTIES: 'parties',
  PURCHASES: 'purchases',
  ORDERS: 'orders',
  INVOICES: 'invoices',
  RETURNS: 'returns',
  KHATA: 'khata',
  // Dukaan ka kharch — chai, petrol, tankhwah, kiraya... (Part 15 step 3)
  EXPENSES: 'expenses',
  REPORTS: 'reports',
  STAFF: 'staff',
  SETTINGS: 'settings',
};

/* ─────────────────────────────── kaam ─────────────────────────────── */

export const ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  APPROVE: 'approve',   // retailer approve/block, payment confirm
  EXPORT: 'export',     // CSV / backup
};

/** `invoices` + `create`  ->  `invoices:create` */
export const P = (module, action) => `${module}:${action}`;

/**
 * Har module me kaunse kaam hote hain.
 *
 * Sab module me chaaron kaam nahi hote — report "banai" nahi jati, use dekha
 * ya download kiya jata hai. Settings "mitai" nahi jati. Isliye har module ki
 * apni list hai — isse UI me bhi wahi checkbox dikhte hain jinka matlab hai.
 */
export const MODULE_ACTIONS = {
  [MODULES.ITEMS]: ['view', 'create', 'edit', 'delete'],
  [MODULES.PARTIES]: ['view', 'create', 'edit', 'delete', 'approve'],
  [MODULES.PURCHASES]: ['view', 'create', 'edit', 'delete'],
  [MODULES.ORDERS]: ['view', 'create', 'edit', 'delete'],
  [MODULES.INVOICES]: ['view', 'create', 'edit', 'delete'],
  [MODULES.RETURNS]: ['view', 'create', 'edit', 'delete'],
  [MODULES.KHATA]: ['view', 'create', 'edit', 'delete', 'approve'],
  [MODULES.EXPENSES]: ['view', 'create', 'edit', 'delete'],
  /*
    `profit` ek ALAG chaabi hai (item 22).

    Pehle `reports:view` se saari report khul jati thin — "pl" (munafa) aur
    "stock" (har item ki LAGAT) bhi. Yaani counter wale ladke ko dukaan ka
    poora munafa aur har maal ki lagat dikh jati thi. Wo ek number koi bhi
    dukaandaar apne staff ko nahi dikhana chahta, aur wo apne aap khula pada
    tha.

    Malik chahe to kisi ko bhi de sakta hai — bas ab wo ek SOCHA HUA faisla
    hai, "reports dekhne do" ka side-effect nahi.
  */
  [MODULES.REPORTS]: ['view', 'export', 'profit'],
  [MODULES.STAFF]: ['view', 'create', 'edit', 'delete'],
  [MODULES.SETTINGS]: ['view', 'edit'],
};

/** Saari mumkin ijazatein — ek lambi list */
export const ALL_PERMISSIONS = Object.entries(MODULE_ACTIONS)
  .flatMap(([m, actions]) => actions.map((a) => P(m, a)));

/* ─────────────────────────────── role ─────────────────────────────── */

export const STAFF_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  SALESMAN: 'salesman',
  ACCOUNTANT: 'accountant',
  CA: 'ca',
  STOREKEEPER: 'storekeeper',
  CASHIER: 'cashier',
  CUSTOM: 'custom',
};

const M = MODULES;
const all = (m) => MODULE_ACTIONS[m].map((a) => P(m, a));
const only = (m, ...actions) => actions.map((a) => P(m, a));

/**
 * Har role ko shuruaat me kya milta hai.
 *
 * Ye sirf SHURUAAT hai — malik har aadmi ke liye alag se ghata-badha sakta
 * hai. Tab uska role "custom" ho jata hai, taaki dekhte hi pata chale ki ye
 * banaa-banaya role nahi hai.
 */
export const ROLE_PERMISSIONS = {
  // Malik — sab kuch, hamesha (code me alag se bhi handle hota hai)
  [STAFF_ROLES.OWNER]: ALL_PERMISSIONS,

  // Sah-malik — malik jitna hi kaam. Farak sirf itna: malik ko chhed nahi
  // sakta, aur naya sah-malik sirf malik hi bana sakta hai (warna ek sah-malik
  // doosre ko nikal kar poori dukaan par kabza kar leta).
  [STAFF_ROLES.ADMIN]: ALL_PERMISSIONS,

  // Manager — poori dukaan chalata hai, par staff aur settings se door
  [STAFF_ROLES.MANAGER]: [
    ...all(M.ITEMS), ...all(M.PARTIES), ...all(M.PURCHASES), ...all(M.ORDERS),
    ...all(M.INVOICES), ...all(M.RETURNS),
    ...only(M.KHATA, 'view', 'create', 'edit', 'approve'),
    ...only(M.EXPENSES, 'view', 'create', 'edit'),
    ...all(M.REPORTS),
    ...only(M.SETTINGS, 'view'),
  ],

  // Salesman — order aur bill banata hai. Mitata kuch bhi nahi.
  // Iska data bhi apne tak hi rehta hai (scope: own).
  [STAFF_ROLES.SALESMAN]: [
    ...only(M.ITEMS, 'view'),
    ...only(M.PARTIES, 'view', 'create'),
    ...only(M.ORDERS, 'view', 'create', 'edit'),
    ...only(M.INVOICES, 'view', 'create'),
    ...only(M.KHATA, 'view'),
  ],

  // Munshi — paisa aur hisaab. Stock se koi lena dena nahi.
  [STAFF_ROLES.ACCOUNTANT]: [
    ...only(M.PARTIES, 'view'),
    ...only(M.PURCHASES, 'view', 'create', 'edit'),
    ...only(M.INVOICES, 'view', 'create', 'edit'),
    ...only(M.RETURNS, 'view', 'create'),
    ...only(M.KHATA, 'view', 'create', 'edit', 'approve'),
    ...only(M.EXPENSES, 'view', 'create', 'edit'),
    ...all(M.REPORTS),
  ],

  // CA / auditor — SIRF DEKHNA. Ek bhi cheez badal nahi sakta.
  // Saal ke aakhir me CA ko login de dijiye, wo sab dekh lega aur data ko
  // haath bhi nahi lagega.
  [STAFF_ROLES.CA]: [
    ...only(M.ITEMS, 'view'),
    ...only(M.PARTIES, 'view'),
    ...only(M.PURCHASES, 'view'),
    ...only(M.INVOICES, 'view'),
    ...only(M.RETURNS, 'view'),
    ...only(M.KHATA, 'view'),
    ...only(M.EXPENSES, 'view'),
    ...all(M.REPORTS),
  ],

  // Godown wala — maal andar-bahar. Paise ka kuch nahi dikhta.
  [STAFF_ROLES.STOREKEEPER]: [
    ...only(M.ITEMS, 'view', 'create', 'edit'),
    ...only(M.PURCHASES, 'view', 'create'),
    ...only(M.ORDERS, 'view', 'edit'),
    ...only(M.RETURNS, 'view', 'create'),
  ],

  // Cash counter — sirf paisa lena-dena
  [STAFF_ROLES.CASHIER]: [
    ...only(M.PARTIES, 'view'),
    ...only(M.INVOICES, 'view'),
    ...only(M.KHATA, 'view', 'create'),
    // Chai-paani, petrol jaisa roz ka kharch counter wala hi likhta hai
    ...only(M.EXPENSES, 'view', 'create'),
    ...only(M.REPORTS, 'view'),
  ],

  // Apni marzi se banaya hua — kuch bhi pehle se nahi
  [STAFF_ROLES.CUSTOM]: [],
};

/* ─────────────────────────────── naam ─────────────────────────────── */

export const STAFF_ROLE_LABEL = {
  [STAFF_ROLES.OWNER]: 'Malik',
  [STAFF_ROLES.ADMIN]: 'Sah-malik',
  [STAFF_ROLES.MANAGER]: 'Manager',
  [STAFF_ROLES.SALESMAN]: 'Salesman',
  [STAFF_ROLES.ACCOUNTANT]: 'Munshi',
  [STAFF_ROLES.CA]: 'CA / Auditor',
  [STAFF_ROLES.STOREKEEPER]: 'Godown incharge',
  [STAFF_ROLES.CASHIER]: 'Cash counter',
  [STAFF_ROLES.CUSTOM]: 'Apni marzi se',
};

export const STAFF_ROLE_HINT = {
  [STAFF_ROLES.OWNER]: 'Dukaan ka malik — sab kuch kar sakta hai',
  [STAFF_ROLES.ADMIN]: 'Malik jitna hi kaam. Malik ko chhed nahi sakta',
  [STAFF_ROLES.MANAGER]: 'Poori dukaan chalata hai — staff aur settings chhod kar',
  [STAFF_ROLES.SALESMAN]: 'Order aur bill banata hai. Sirf apne retailer dikhte hain',
  [STAFF_ROLES.ACCOUNTANT]: 'Paisa aur hisaab. Stock se lena-dena nahi',
  [STAFF_ROLES.CA]: 'Sirf dekh sakta hai — ek bhi cheez badal nahi sakta',
  [STAFF_ROLES.STOREKEEPER]: 'Maal andar-bahar. Paise ka kuch nahi dikhta',
  [STAFF_ROLES.CASHIER]: 'Sirf paisa lena-dena',
  [STAFF_ROLES.CUSTOM]: 'Aap khud tay karein ki kya kar sakta hai',
};

export const MODULE_LABEL = {
  [MODULES.ITEMS]: 'Items aur stock',
  [MODULES.PARTIES]: 'Retailer aur supplier',
  [MODULES.PURCHASES]: 'Purchase (maal khareedna)',
  [MODULES.ORDERS]: 'Orders',
  [MODULES.INVOICES]: 'Bill',
  [MODULES.RETURNS]: 'Maal wapasi',
  [MODULES.KHATA]: 'Khata aur payment',
  [MODULES.EXPENSES]: 'Dukaan ka kharch',
  [MODULES.REPORTS]: 'Reports',
  [MODULES.STAFF]: 'Staff',
  [MODULES.SETTINGS]: 'Settings',
};

export const ACTION_LABEL = {
  view: 'Dekhna',
  create: 'Banana',
  edit: 'Badalna',
  delete: 'Mitana',
  approve: 'Manzoori dena',
  export: 'Download karna',
};

/* ───────────────────────── data ki hadd (scope) ───────────────────────── */

export const SCOPES = {
  ALL: 'all',   // poori dukaan ka data
  OWN: 'own',   // sirf apna banaya hua / apne naam wale retailer
};

export const SCOPE_LABEL = {
  [SCOPES.ALL]: 'Poori dukaan ka',
  [SCOPES.OWN]: 'Sirf apna kaam',
};

/** Kis role ko shuruaat me kitna data dikhna chahiye */
export const ROLE_SCOPE = {
  [STAFF_ROLES.SALESMAN]: SCOPES.OWN,
};

/* ───────────────────────── paise ki hadd ───────────────────────── */

/**
 * `null` ka matlab hai "koi hadd nahi".
 *
 * 0 ka matlab hota "kuch bhi nahi" — jo bilkul alag baat hai. Isliye khali
 * dabbe ko null hi maanna hai, 0 nahi. (Ye galti aasani se ho jati hai.)
 */
export const DEFAULT_LIMITS = {
  maxDiscountPercent: null,
  maxInvoiceAmount: null,
  canSellOnCredit: true,
};

export const ROLE_LIMITS = {
  [STAFF_ROLES.SALESMAN]: {
    maxDiscountPercent: 10,
    maxInvoiceAmount: null,
    canSellOnCredit: true,
  },
};

/* ─────────────────────────────── helpers ─────────────────────────────── */

const PERM_SET = new Set(ALL_PERMISSIONS);

/** Ye ijazat asli hai bhi ya nahi (galat naam chupchaap na chale) */
export const isValidPermission = (p) => PERM_SET.has(p);

export function permissionsForRole(role) {
  return [...(ROLE_PERMISSIONS[role] || [])];
}

export function scopeForRole(role) {
  return ROLE_SCOPE[role] || SCOPES.ALL;
}

export function limitsForRole(role) {
  return { ...DEFAULT_LIMITS, ...(ROLE_LIMITS[role] || {}) };
}

/**
 * PURANE data ko naye roop me badalna.
 *
 * Pehle permission bas `['invoices','khata']` aisi hoti thi. Us waqt uska
 * matlab tha "is module me sab kuch kar sakta hai", isliye purane aadmi ka haq
 * kam na ho jaye — har purane module ko uske SAARE kaam me khol dete hain.
 *
 * Chupchaap kam kar dena isse bhi bura hota: kal subah munshi bill nahi bana
 * pata aur kisi ko samajh nahi aata kyun.
 */
export function expandLegacyPermissions(list) {
  const out = new Set();
  for (const raw of list || []) {
    const value = String(raw);
    if (value.includes(':')) {
      if (isValidPermission(value)) out.add(value);
      continue;
    }
    for (const action of MODULE_ACTIONS[value] || []) out.add(P(value, action));
  }
  return [...out];
}

/** Is list me ek bhi purane roop wali ijazat hai? (backfill isse poochhta hai) */
export const hasLegacyPermission = (list) =>
  (list || []).some((p) => !String(p).includes(':'));

/**
 * Aakhri faisla: ye aadmi ye kaam kar sakta hai ya nahi.
 *
 * Malik se kabhi nahi poochha jata — uske paas hamesha sab kuch hai, chahe
 * uski list khali ho. (Warna ek galat update malik ko hi apni dukaan se bahar
 * kar deta.)
 */
export function userCan(user, permission) {
  if (!user) return false;
  if (user.role !== 'wholesaler') return false;
  if ((user.staffRole || STAFF_ROLES.OWNER) === STAFF_ROLES.OWNER) return true;

  const list = user.permissions || [];
  if (list.includes(permission)) return true;

  /**
   * PURANE ROOP WALI IJAZAT — bina badle bhi chalti rahegi.
   *
   * Startup pe backfill inhe naye roop me badal deta hai. Par backfill kisi
   * wajah se na chal paye (database dheema tha, ya wo 20 second wali race
   * haar gaya), to bina is line ke agli subah munshi bill nahi bana pata aur
   * kisi ko wajah samajh nahi aati — kyunki kahin koi error bhi nahi dikhta.
   *
   * Niyam saaf hai: format badalne se kisi ka haq CHHIN nahi sakta. Purana
   * `invoices` ka matlab tha "is module me sab kuch", aur wahi matlab yahan
   * bhi rakha hai. Jaise hi malik us aadmi ko ek baar save karta hai, list
   * naye roop me badal jati hai aur ye line bekaar ho jati hai.
   */
  const [module] = String(permission).split(':');
  return list.includes(module);
}

/** Module me se kuch bhi kar sakta hai? (menu dikhane ke liye) */
export function userCanModule(user, module) {
  if (!user) return false;
  if ((user.staffRole || STAFF_ROLES.OWNER) === STAFF_ROLES.OWNER
    && user.role === 'wholesaler') return true;
  const prefix = `${module}:`;
  return (user.permissions || []).some((p) => p.startsWith(prefix));
}
