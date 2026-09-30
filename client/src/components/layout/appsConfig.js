import {
  FileText, Truck, Package, Landmark, Target, Briefcase, LayoutDashboard, UsersRound, Settings, MessageCircle,
  PlusCircle, IndianRupee, ShoppingBag, PackagePlus, Receipt, Undo2, UserPlus, Sparkles, BookOpen, Fingerprint, ClipboardList, FileSignature,
} from 'lucide-react';
import { wholesalerNav } from './navConfig';

/**
 * ODOO JAISE APPS — seller ke saare page chhote "apps" me.
 * Home pe har app ka ek button; app ke andar upar uska apna menu.
 * `menu` ke `to` wholesalerNav se hi ijazat (perm) lete hain — do jagah niyam nahi.
 */
export const APPS = [
  {
    key: 'sales', label: 'Sales', icon: FileText, tone: 'from-sky-500 to-blue-600',
    menu: [['/home', 'Counter'], ['/sales', 'Bills'], ['/quotations', 'Quotations'], ['/orders', 'Orders'], ['/returns', 'Returns'], ['/retailers', 'Customers'], ['/demand', 'Demand']],
    also: ['/invoices', '/sale/new'],
  },
  {
    key: 'purchase', label: 'Purchase', icon: Truck, tone: 'from-amber-500 to-orange-600',
    menu: [['/purchases', 'Purchases'], ['/suppliers', 'Suppliers', 'parties'], ['/expenses', 'Expenses'], ['/stock-intake', 'Stock intake']],
  },
  {
    key: 'inventory', label: 'Inventory', icon: Package, tone: 'from-emerald-500 to-teal-600',
    menu: [['/items', 'Items']],
  },
  {
    key: 'accounting', label: 'Accounting', icon: Landmark, tone: 'from-violet-500 to-purple-600',
    menu: [['/accounts', 'Accounts & GST'], ['/khata', 'Khata'], ['/payments', 'Payments'], ['/reports', 'Reports']],
  },
  {
    key: 'crm', label: 'CRM', icon: Target, tone: 'from-rose-500 to-pink-600',
    menu: [['/crm', 'CRM'], ['/today', "Today's work"]],
  },
  {
    key: 'chat', label: 'Chat', icon: MessageCircle, tone: 'from-cyan-500 to-sky-600',
    menu: [['/chat', 'Chat']],
  },
  {
    key: 'hr', label: 'HR', icon: Briefcase, tone: 'from-indigo-500 to-blue-700',
    menu: [['/hr', 'HR'], ['/emp', 'My Work']],
  },
  {
    key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, tone: 'from-slate-600 to-slate-800',
    menu: [['/dashboard', 'Dashboard']],
  },
  {
    key: 'staff', label: 'Staff', icon: UsersRound, tone: 'from-lime-500 to-green-600',
    menu: [['/staff', 'Staff']],
  },
  {
    key: 'settings', label: 'Settings', icon: Settings, tone: 'from-gray-500 to-gray-700',
    menu: [['/profile', 'Profile'], ['/settings', 'Settings'], ['/autopay', 'Plan & billing'], ['/help', 'Help & support']],
    also: ['/notifications', '/support'],
  },
];

const PERM = Object.fromEntries(wholesalerNav.map((n) => [n.to, n.perm]));
const NAV = Object.fromEntries(wholesalerNav.map((n) => [n.to, n]));

/** Is aadmi ko dikhne wale apps, har app me sirf uske khule page */
export function visibleApps(can) {
  return APPS.map((a) => ({
    ...a,
    menu: a.menu.filter(([to, , perm]) => (NAV[to] || perm) && (!(perm || PERM[to]) || can(perm || PERM[to])))
      .map(([to, label]) => ({ to, label, badgeKey: NAV[to]?.badgeKey })),
  })).filter((a) => a.menu.length);
}

/** Ye pata kis app ka hai */
export function appForPath(apps, pathname) {
  const hit = (to) => pathname === to || pathname.startsWith(`${to}/`);
  return apps.find((a) => a.menu.some((m) => hit(m.to)) || (a.also || []).some(hit)) || null;
}

/** Home ke shortcut — seller inme se chunta hai */
export const QUICK_ACTIONS = [
  { key: 'new_sale', label: 'New sale', icon: PlusCircle, to: '/sale/new', perm: 'invoices:create' },
  { key: 'receive_payment', label: 'Receive payment', icon: IndianRupee, to: '/payments', perm: 'khata:create' },
  { key: 'new_purchase', label: 'New purchase', icon: ShoppingBag, to: '/purchases/new', perm: 'purchases:create' },
  { key: 'add_item', label: 'Add item', icon: PackagePlus, to: '/items?new=1', perm: 'items:create' },
  { key: 'add_expense', label: 'Add expense', icon: Receipt, to: '/expenses?new=1', perm: 'expenses:create' },
  { key: 'sale_return', label: 'Sale return', icon: Undo2, to: '/returns/new', perm: 'returns:create' },
  { key: 'add_customer', label: 'Add customer', icon: UserPlus, to: '/retailers?new=1', perm: 'parties:create' },
  { key: 'new_lead', label: 'CRM leads', icon: Sparkles, to: '/crm', perm: 'parties:view' },
  { key: 'new_quote', label: 'New quotation', icon: FileSignature, to: '/quotations/new', perm: 'orders:create' },
  { key: 'orders', label: 'New orders', icon: ClipboardList, to: '/orders', perm: 'orders', badgeKey: 'newOrders' },
  { key: 'khata', label: 'Khata', icon: BookOpen, to: '/khata', perm: 'khata:view' },
  { key: 'check_in', label: 'Check in', icon: Fingerprint, to: '/emp' },
];
export const DEFAULT_SHORTCUTS = ['new_sale', 'receive_payment', 'new_purchase', 'add_item', 'add_expense', 'orders'];
