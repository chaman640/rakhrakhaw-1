/**
 * FEATURE — kaunsa kaam kis plan me. POORE APP ME EK HI JAGAH.
 *
 * Har bada feature ki ek chaabi (`key`) hai. Backend `requireFeature(key)` se
 * rokta hai (middleware/feature.js), frontend `useFeature(key)` se button pe
 * "upgrade" dikhata hai — dono yahi list padhte hain. Kahin bhi "agar plan
 * ₹500 hai to..." haath se likhna mana hai.
 *
 * `plans` sirf DEFAULT hai. Admin Panel → Plans & Features se badla ja sakta
 * hai (PlatformConfig.featurePlans), code chhue bina.
 *
 * Hisaab-kitaab (bill, khata, stock, GST, P&L) KABHI plan se band nahi hota —
 * wo har paid plan me barabar hai. Plan se sirf pesh-kadam cheezein badhti hain:
 * CRM, team ko kaam dena, automation, maang ka vishleshan.
 */
export const FEATURES = [
  {
    key: 'crm_basic',
    name: 'CRM — retailer follow-up',
    desc: 'Kaun retailer order nahi kar raha, kisko follow-up chahiye',
    plans: ['CHOTI', 'BADHTI', 'BADI', 'ASEEM'],
  },
  {
    key: 'crm_leads',
    name: 'CRM — leads, pipeline aur kaam (task)',
    desc: 'Naye grahak (lead), unki stage, aur follow-up ka kaam',
    plans: ['BADHTI', 'BADI', 'ASEEM'],
  },
  {
    key: 'crm_assign',
    name: 'Staff ko lead/kaam dena',
    desc: 'Lead aur kaam kisi staff ko do — use sirf apna kaam dikhega',
    plans: ['BADHTI', 'BADI', 'ASEEM'],
  },
  {
    key: 'crm_smart',
    name: 'CRM — scoring, re-order, automation',
    desc: 'Customer score, re-order aur inactivity alert, auto follow-up, complaint assignment, sales target',
    plans: ['BADI', 'ASEEM'],
  },
  {
    key: 'crm_pro',
    name: 'CRM — territory aur lead rules',
    desc: 'Area-wise retailer, city/value se lead apne aap sahi staff ko',
    plans: ['ASEEM'],
  },
  {
    key: 'demand',
    name: 'Maang (retailer wishlist)',
    desc: 'Retailer kya maang rahe hain — wishlist aur jo maal aapke paas nahi',
    plans: ['BADHTI', 'BADI', 'ASEEM'],
  },
  {
    key: 'hr_basic',
    name: 'HR — employee, attendance, chhutti, salary',
    desc: 'Employee profile, attendance, chhutti aur mahine ki salary',
    plans: ['CHOTI', 'BADHTI', 'BADI', 'ASEEM'],
  },
  {
    key: 'hr_teams',
    name: 'HR — department, team aur reports',
    desc: 'Department, designation, team aur HR reports',
    plans: ['BADHTI', 'BADI', 'ASEEM'],
  },
  {
    key: 'hr_advanced',
    name: 'HR — commission, performance, team target',
    desc: 'Sales se commission, employee aur team performance',
    plans: ['BADI', 'ASEEM'],
  },
  {
    key: 'sales_pro',
    name: 'Quotation, sales order, delivery challan',
    desc: 'Bade wholesaler/importer ke liye: quotation → order → dispatch → bill',
    plans: ['BADHTI', 'BADI', 'ASEEM'],
  },
  {
    key: 'bulk_import',
    name: 'File/photo se ek saath maal',
    desc: 'Excel, PDF ya bill ki photo se saara maal ek baar me',
    plans: ['BADHTI', 'BADI', 'ASEEM'],
  },
];

export const FEATURE_BY_KEY = Object.fromEntries(FEATURES.map((f) => [f.key, f]));
