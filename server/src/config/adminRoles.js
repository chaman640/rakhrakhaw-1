/**
 * ADMIN KE ROLE — har admin ko sirf uske kaam ki ijazat (spec: "full access by default mat do").
 * Backend har raste pe `requireAdminPerm` se jaanchta hai; panel sirf wahi tab dikhata hai.
 */
export const ADMIN_PERMS = {
  dashboard: 'Dashboard',
  'businesses:view': 'View businesses & users',
  'businesses:manage': 'Suspend, extend, change plan',
  'payments:view': 'View payments & subscriptions',
  'plans:manage': 'Plans & features',
  'content:manage': 'Tutorials, help articles, FAQs',
  'announcements:manage': 'Announcements',
  'support:manage': 'Support tickets',
  'partners:manage': 'Salesman payouts',
  'audit:view': 'Audit log',
  'admins:manage': 'Admins & roles',
};

export const ADMIN_ROLES = {
  super: { label: 'Super Admin', perms: Object.keys(ADMIN_PERMS) },
  admin: { label: 'Admin', perms: Object.keys(ADMIN_PERMS).filter((p) => p !== 'admins:manage') },
  support: { label: 'Support Admin', perms: ['dashboard', 'businesses:view', 'support:manage'] },
  content: { label: 'Content Admin', perms: ['dashboard', 'content:manage', 'announcements:manage'] },
  finance: { label: 'Finance Admin', perms: ['dashboard', 'businesses:view', 'payments:view', 'partners:manage'] },
};

export const permsOfRole = (role) => ADMIN_ROLES[role]?.perms || [];
