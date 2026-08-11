import {
  LayoutDashboard, Package, ShoppingCart, Users, Truck,
  FileText, BookOpen, Wallet, BarChart3, Settings, Store, Bell, Receipt, Undo2,
} from 'lucide-react';

// Wholesaler ka poora menu (sidebar / hamburger).
// `part` sirf reference ke liye. `perm` (Part 11) se staff ko wahi menu dikhta hai
// jiski use ijazat hai — malik ko sab kuch.
export const wholesalerNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, part: 10 },
  { to: '/orders', label: 'Orders', icon: ShoppingCart, part: 7, badgeKey: 'newOrders', perm: 'orders' },
  { to: '/items', label: 'Items', icon: Package, part: 3, perm: 'items' },
  { to: '/retailers', label: 'Retailers', icon: Users, part: 4, perm: 'parties' },
  { to: '/suppliers', label: 'Suppliers', icon: Truck, part: 4, perm: 'parties' },
  { to: '/purchases', label: 'Purchases', icon: Truck, part: 5, perm: 'purchases' },
  { to: '/invoices', label: 'Invoices', icon: FileText, part: 8, perm: 'invoices' },
  { to: '/returns', label: 'Return', icon: Undo2, part: 11, perm: 'returns' },
  { to: '/khata', label: 'Khata', icon: BookOpen, part: 9, perm: 'khata' },
  { to: '/payments', label: 'Payments', icon: Wallet, part: 9, perm: 'khata' },
  { to: '/reports', label: 'Reports', icon: BarChart3, part: 10, perm: 'reports' },
  { to: '/settings', label: 'Settings', icon: Settings, part: 2 },
];

export const retailerNav = [
  { to: '/home', label: 'Home', icon: LayoutDashboard, part: 10 },
  { to: '/shop', label: 'Catalog', icon: Store, part: 6 },
  { to: '/cart', label: 'Cart', icon: ShoppingCart, part: 6, badgeKey: 'cartCount' },
  { to: '/my-orders', label: 'My Orders', icon: FileText, part: 7 },
  { to: '/my-bills', label: 'Mere Bills', icon: Receipt, part: 8 },
  { to: '/my-khata', label: 'My Khata', icon: BookOpen, part: 9 },
  { to: '/notifications', label: 'Notifications', icon: Bell, part: 10 },
  { to: '/profile', label: 'Profile', icon: Settings, part: 2 },
];

/* ─────────────────────────────────────────────────────────────────────────
   NEECHE WALI PATTI (mobile aur tablet)

   Dukaandar ka phone ek haath me hota hai aur doosre haath me maal. Upar wale
   teen line wale button tak angootha pahunchta hi nahi — isliye jo char kaam
   sabse zyada hote hain wo neeche, angoothe ke paas rakhe hain.

   Paanchva khana hamesha "Menu" hai — wahi purana teen-line wala, ab neeche.
   Uske andar baaki sab (Retailers, Purchases, Bills, Khata, Reports...) hai.

   CHAR hi kyun: paanch se zyada khane 360px ke phone pe itne patle ho jate
   hain ki naam kat jata hai aur galat button dab jata hai.
   ───────────────────────────────────────────────────────────────────────── */

const BOTTOM_WHOLESALER = ['/dashboard', '/orders', '/payments', '/items'];
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

/** Ye wo pages hain jinpe "back" ka koi matlab nahi — yahi to shuruaat hai */
export function isRootPage(pathname, nav, isRetailer) {
  return bottomNavFor(nav, isRetailer).some((n) => n.to === pathname);
}
