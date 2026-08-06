import {
  LayoutDashboard, Package, ShoppingCart, Users, Truck,
  FileText, BookOpen, Wallet, BarChart3, Settings, Store, Bell, Receipt,
} from 'lucide-react';

// Wholesaler ka menu. `part` sirf reference ke liye — kaunse part me banega.
export const wholesalerNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, part: 10 },
  { to: '/orders', label: 'Orders', icon: ShoppingCart, part: 7, badgeKey: 'newOrders' },
  { to: '/items', label: 'Items', icon: Package, part: 3 },
  { to: '/retailers', label: 'Retailers', icon: Users, part: 4 },
  { to: '/suppliers', label: 'Suppliers', icon: Truck, part: 4 },
  { to: '/purchases', label: 'Purchases', icon: Truck, part: 5 },
  { to: '/invoices', label: 'Invoices', icon: FileText, part: 8 },
  { to: '/khata', label: 'Khata', icon: BookOpen, part: 9 },
  { to: '/payments', label: 'Payments', icon: Wallet, part: 9 },
  { to: '/reports', label: 'Reports', icon: BarChart3, part: 10 },
  { to: '/settings', label: 'Settings', icon: Settings, part: 2 },
];

export const retailerNav = [
  { to: '/shop', label: 'Catalog', icon: Store, part: 6 },
  { to: '/cart', label: 'Cart', icon: ShoppingCart, part: 6, badgeKey: 'cartCount' },
  { to: '/my-orders', label: 'My Orders', icon: FileText, part: 7 },
  { to: '/my-bills', label: 'Mere Bills', icon: Receipt, part: 8 },
  { to: '/my-khata', label: 'My Khata', icon: BookOpen, part: 9 },
  { to: '/notifications', label: 'Notifications', icon: Bell, part: 10 },
  { to: '/profile', label: 'Profile', icon: Settings, part: 2 },
];
