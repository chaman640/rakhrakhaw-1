import {
  LayoutDashboard, Package, ShoppingCart, Users, Truck,
  FileText, BookOpen, Wallet, BarChart3, Settings, Store, Bell, Receipt, Undo2,
  House, UserCircle, Wallet2, UsersRound,
} from 'lucide-react';

/**
 * Wholesaler ka poora menu.
 *
 * `perm` (Part 11) se staff ko wahi menu dikhta hai jiski use ijazat hai —
 * malik ko sab kuch.
 *
 * `desc` Part 15 step 5 me juda. Wajah: Menu page pe ab sirf naam kaafi nahi
 * hai. "Khata" aur "Payment" — dono me paisa hai; "Return" aur "Purchase" —
 * dono me maal. Naya banda naam padh kar bhi galat page kholta tha. Ek line ka
 * matlab saath likh dene se wo bhatakna khatam ho jata hai, aur khoj bhi isi
 * line me dhoondhti hai (jaise "udhaar" likhne pe Khata mil jata hai).
 */
export const wholesalerNav = [
  // Home sabse pehle — roz ka kaam yahi hai. Dashboard "hisaab" ke liye hai.
  {
    to: '/home', label: 'Home', icon: House, part: 15, perm: 'invoices',
    desc: 'Aaj ka kaam — bill banaein, chhapein, bhejein',
  },
  {
    to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, part: 10,
    desc: 'Ek nazar me poori dukaan — sale, kharch aur graph',
  },
  {
    to: '/orders', label: 'Orders', icon: ShoppingCart, part: 7, badgeKey: 'newOrders', perm: 'orders',
    desc: 'Retailer ne app se jo maal manga hai',
  },
  {
    to: '/items', label: 'Items', icon: Package, part: 3, perm: 'items',
    desc: 'Maal ki list, rate aur stock',
  },
  {
    to: '/retailers', label: 'Retailers', icon: Users, part: 4, perm: 'parties',
    desc: 'Jinko aap maal bechte hain',
  },
  /*
    Teen ki jagah ek: "Kharid".

    Purchase, Supplier aur Kharch teeno ek hi page ke tab ban gaye hain
    (Buying.jsx me poori wajah likhi hai), isliye menu me bhi teen jagah lene
    ka koi matlab nahi bacha. Menu jitna lamba, usme dhoondhna utna hi mushkil
    — aur ye teen ek hi sawal ke hisse hain: "paisa kahan gaya?"

    Khoj (search) me teeno naam se milta hai — `alt` neeche.
  */
  {
    to: '/purchases', label: 'Kharid', icon: Truck, part: 16, perm: 'purchases',
    desc: 'Maal andar aaya, supplier, aur dukaan ka kharcha — teeno ek jagah',
    alt: 'purchase supplier kharch expense buying',
  },
  // Menu me "Sale" — dukaandaar bill ki list ko "invoices" nahi, sale hi
  // kehta hai. Page wahi hai; /invoices bhi chalta rehta hai (purane link).
  {
    to: '/sales', label: 'Sale', icon: FileText, part: 15, perm: 'invoices',
    desc: 'Kis din kitna bika aur kiska paisa baaki hai',
  },
  {
    to: '/returns', label: 'Return', icon: Undo2, part: 11, perm: 'returns',
    desc: 'Maal wapas aaya ya wapas bheja',
  },
  {
    to: '/khata', label: 'Khata', icon: BookOpen, part: 9, perm: 'khata:view',
    desc: 'Har party ka poora lena-dena, ek ek entry',
  },
  // Payments PAISA ENTRY ka page hai, sirf dekhne ka nahi. Isliye ismein
  // `khata:create` chahiye — warna salesman ko (jise khata sirf dekhna hai)
  // ye menu dikh jata tha aur page khul bhi jata tha.
  {
    to: '/payments', label: 'Payment', icon: Wallet, part: 15, perm: 'khata:create',
    desc: 'Kisse udhaar lena hai, aur paisa aane-jaane ka record',
  },
  {
    to: '/reports', label: 'Reports', icon: BarChart3, part: 10, perm: 'reports',
    desc: 'Fayda-nuksan, GST, stock aur baaki hisaab',
  },
  // Part 15 step 5: staff aur "kisne kya kiya" ab ek hi page pe
  {
    to: '/staff', label: 'Staff', icon: UsersRound, part: 15, perm: 'staff',
    desc: 'Log, unki ijazat, hadd — aur kisne kya kiya',
  },
  {
    to: '/profile', label: 'Profile', icon: UserCircle, part: 15,
    desc: 'Dukaan ka naam, UPI, bank aur apna account',
  },
  {
    to: '/settings', label: 'Settings', icon: Settings, part: 2,
    desc: 'Bhasha, roshni, akshar ka size aur backup',
  },
];

export const retailerNav = [
  { to: '/home', label: 'Home', icon: LayoutDashboard, part: 10, desc: 'Aapka hisaab ek nazar me' },
  { to: '/shop', label: 'Catalog', icon: Store, part: 6, desc: 'Poora maal aur uske rate' },
  { to: '/cart', label: 'Cart', icon: ShoppingCart, part: 6, badgeKey: 'cartCount', desc: 'Jo maal aapne chuna hai' },
  { to: '/my-orders', label: 'My Orders', icon: FileText, part: 7, desc: 'Aapke bheje hue order' },
  { to: '/my-bills', label: 'Mere Bills', icon: Receipt, part: 8, desc: 'Aapke saare bill' },
  { to: '/my-khata', label: 'My Khata', icon: BookOpen, part: 9, desc: 'Kitna baaki hai' },
  { to: '/notifications', label: 'Notifications', icon: Bell, part: 10, desc: 'Naye alert' },
  /*
    Profile aur Settings ALAG hain, aur alag hi rehne chahiye.

    Pehle sirf Profile tha, aur uspe bhi Settings wala hi icon laga tha —
    isliye jo aadmi bhasha ya akshar ka size dhoondh raha hota tha wo wahi
    khol kar khali haath laut aata tha. Ab Profile = account (dukaan ka naam,
    password, logout), aur Settings = ISI phone ka roop (bhasha, roshni,
    akshar). Icon bhi ab alag hain, warna do khane ek jaise dikhte hain.
  */
  { to: '/profile', label: 'Profile', icon: UserCircle, part: 2, desc: 'Aapka account' },
  { to: '/settings', label: 'Settings', icon: Settings, part: 2, desc: 'Bhasha, roshni aur akshar ka size' },
];

/* ─────────────────────────────────────────────────────────────────────────
   NEECHE WALI PATTI (mobile aur tablet)

   Dukaandar ka phone ek haath me hota hai aur doosre haath me maal. Upar wale
   teen line wale button tak angootha pahunchta hi nahi — isliye jo char kaam
   sabse zyada hote hain wo neeche, angoothe ke paas rakhe hain.

   Paanchva khana hamesha "Menu" hai — ab wo daraz nahi, apna page hai.

   CHAR hi kyun: paanch se zyada khane 360px ke phone pe itne patle ho jate
   hain ki naam kat jata hai aur galat button dab jata hai.

   AAKHRI CHUNAAV (Part 15 step 5): Home · Dashboard · Sale · Payment
   — Items aur Orders yahan se hate. Dono din me ek-do baar khulte hain aur
     ab Menu ek hi tap door hai.
   — Kharch bhi yahan nahi hai, par wo door nahi hua: uska button Dashboard pe
     hi hai, aur Dashboard is patti me hai.
   — Payment isliye hai ki "kisse paisa lena hai" roz ka kaam hai aur uska
     koi doosra shortcut app me kahin nahi hai.
   ───────────────────────────────────────────────────────────────────────── */

const BOTTOM_WHOLESALER = ['/home', '/dashboard', '/sales', '/payments'];
const BOTTOM_RETAILER = ['/home', '/shop', '/cart', '/my-orders'];

/**
 * Neeche wali patti ke char khane nikalna.
 *
 * Staff ke paas kisi ki ijazat na ho (jaise salesman ke paas khata nahi) to us
 * khane ki jagah khali nahi chhodte — poore menu me se agla kaam ka item utha
 * lete hain. Isse patti hamesha bhari rehti hai aur koi mara hua button nahi dikhta.
 */
export function bottomNavFor(nav, isRetailer) {
  const wanted = isRetailer ? BOTTOM_RETAILER : BOTTOM_WHOLESALER;

  const picked = wanted
    .map((to) => nav.find((n) => n.to === to))
    .filter(Boolean);

  if (picked.length < 4) {
    for (const item of nav) {
      if (picked.length >= 4) break;
      if (!picked.some((p) => p.to === item.to)) picked.push(item);
    }
  }

  return picked.slice(0, 4);
}

/**
 * Ye wo pages hain jinpe "back" ka koi matlab nahi — yahi to shuruaat hai.
 *
 * `/menu` bhi ismein hai: wo patti ka apna khana hai, isliye uspe back dikhana
 * ulta lagta hai (kahan se peeche? patti to saamne hi hai).
 */
export function isRootPage(pathname, nav, isRetailer) {
  if (pathname === '/menu') return true;
  return bottomNavFor(nav, isRetailer).some((n) => n.to === pathname);
}
