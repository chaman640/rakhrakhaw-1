import { Router } from 'express';
import authRoutes from './auth.routes.js';
import businessRoutes from './business.routes.js';
import categoryRoutes from './category.routes.js';
import itemRoutes from './item.routes.js';
import partyRoutes from './party.routes.js';
import purchaseRoutes from './purchase.routes.js';
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

// Part 6 — retailer ka side
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

/**
 * Aage ke parts yahan mount honge:
 *
 * Part 10 router.use('/reports', reportRoutes);
 */

export default router;
