import { Router } from 'express';
import authRoutes from './auth.routes.js';
import businessRoutes from './business.routes.js';
import categoryRoutes from './category.routes.js';
import itemRoutes from './item.routes.js';
import partyRoutes from './party.routes.js';
import purchaseRoutes from './purchase.routes.js';
import intakeRoutes from './intake.routes.js';
import shopRoutes from './shop.routes.js';
import buyRoutes from './buy.routes.js';
import catalogRoutes from './catalog.routes.js';
import cartRoutes from './cart.routes.js';
import myOrderRoutes from './myOrder.routes.js';
import orderRoutes from './order.routes.js';
import notificationRoutes from './notification.routes.js';
import invoiceRoutes from './invoice.routes.js';
import myInvoiceRoutes from './myInvoice.routes.js';
import khataRoutes from './khata.routes.js';
import paymentRoutes from './payment.routes.js';
import myKhataRoutes from './myKhata.routes.js';
import reportRoutes from './report.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import returnRoutes from './return.routes.js';
import expenseRoutes from './expense.routes.js';
import staffRoutes from './staff.routes.js';
import backupRoutes from './backup.routes.js';
import auditRoutes from './audit.routes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API zinda hai', data: { time: new Date().toISOString() } });
});

// Part 2
router.use('/auth', authRoutes);
router.use('/business', businessRoutes);

// Part 3
router.use('/categories', categoryRoutes);
router.use('/items', itemRoutes);

// Part 4
router.use('/parties', partyRoutes);

// Part 5
router.use('/purchases', purchaseRoutes);
// Part 17 step 3 — doosri dukaan se kharida hua maal apne stock me daalna
router.use('/stock-intake', intakeRoutes);

// Part 6 — kharidne ka side (retailer, aur wholesaler ka buy mode)
//
// Part 17: `/shops` — number se dukaan dhoondho aur judo. Yahi wo rasta hai
// jisne "ek retailer, ek hi wholesaler" wali gaanth kholi hai.
router.use('/shops', shopRoutes);
// `/buy` — kai dukaanein ek saath: poora cart, aur ek confirm pe har dukaan ka
// apna order (buy.routes.js me poori wajah)
router.use('/buy', buyRoutes);
router.use('/catalog', catalogRoutes);
router.use('/cart', cartRoutes);
router.use('/my-orders', myOrderRoutes);

// Part 7
router.use('/orders', orderRoutes);
router.use('/notifications', notificationRoutes);

// Part 8
router.use('/invoices', invoiceRoutes);
router.use('/my-bills', myInvoiceRoutes);

// Part 9 — khata aur paise
router.use('/khata', khataRoutes);
router.use('/payments', paymentRoutes);
router.use('/my', myKhataRoutes);   // /api/my/khata, /api/my/payments

// Part 10 — reports aur dashboard
router.use('/reports', reportRoutes);
router.use('/dashboard', dashboardRoutes);

// Part 11 — maal wapas
router.use('/returns', returnRoutes);
router.use('/expenses', expenseRoutes);
router.use('/staff', staffRoutes);
router.use('/backup', backupRoutes);

// Part 12 — sub-account, ijazat aur "kisne kya kiya"
router.use('/activity', auditRoutes);

export default router;
