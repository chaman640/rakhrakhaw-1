import { Router } from 'express';
import { z } from 'zod';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant, requirePaidSeller } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { logAction } from '../services/audit.service.js';
import * as acc from '../services/accounts.service.js';
import * as gst from '../services/gstReturns.service.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePaidSeller);

// Books munafa dikhati hain — isliye `reports:profit`; haath ki entry `khata:approve`
const view = requirePermission('reports:profit');
const post = requirePermission('khata:approve');

const oid = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const date = z.coerce.date().optional();
const range = z.object({ from: date, to: date });
const month = z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Invalid month') });
const h = (fn) => asyncHandler(async (req, res) => ok(res, await fn(req)));

router.get('/overview', view, h((req) => acc.overview(req.businessId)));
router.get('/trial-balance', view, validate({ query: range }), h((req) => acc.trialBalance(req.businessId, req.query)));
router.get('/profit-loss', view, validate({ query: range }), h((req) => acc.profitLoss(req.businessId, req.query)));
router.get('/balance-sheet', view, validate({ query: range }), h((req) => acc.balanceSheet(req.businessId, req.query)));
router.get('/cash-flow', view, validate({ query: range }), h((req) => acc.cashFlow(req.businessId, req.query)));
router.get('/day-book', view, validate({ query: range.extend({ type: z.string().trim().max(40).optional().default('') }) }),
  h((req) => acc.dayBook(req.businessId, req.query)));
router.get('/ledger', view, validate({
  query: range.extend({ account: z.string().trim().regex(/^(party:[a-f\d]{24}|head:[a-f\d]{24}|exp:[\wऀ-ॿ-]{1,40}|[a-z_]{2,30})$/i, 'Invalid account') }),
}), h((req) => acc.accountLedger(req.businessId, req.query.account, req.query)));
router.get('/ageing', view, validate({ query: z.object({ side: z.enum(['receivable', 'payable']).optional().default('receivable') }) }),
  h((req) => acc.ageing(req.businessId, req.query)));
router.get('/checks', view, h((req) => acc.bookChecks(req.businessId)));
router.get('/accounts', view, h((req) => acc.accountOptions(req.businessId)));

router.get('/gst/gstr1', view, validate({ query: month }), h((req) => gst.gstr1(req.businessId, req.query)));
router.get('/gst/gstr3b', view, validate({ query: month }), h((req) => gst.gstr3b(req.businessId, req.query)));
router.get('/gst/purchases', view, validate({ query: month }), h((req) => gst.purchaseGst(req.businessId, req.query)));
router.get('/gst/checks', view, validate({ query: month }), h((req) => gst.gstChecks(req.businessId, req.query)));

router.get('/journals', view, validate({ query: range }), h((req) => acc.listJournals(req.businessId, req.query)));
router.post('/journals', post, validate({
  body: z.object({
    kind: z.enum(['journal', 'contra']).optional().default('journal'),
    date: z.coerce.date(),
    narration: z.string().trim().min(3, 'Please write a narration').max(300),
    lines: z.array(z.object({
      account: z.string().trim().min(2).max(60),
      debit: z.coerce.number().min(0).max(1e10).optional().default(0),
      credit: z.coerce.number().min(0).max(1e10).optional().default(0),
    })).min(2).max(20),
  }),
}), asyncHandler(async (req, res) => {
  const j = await acc.createJournal(req.businessId, req.user, req.body);
  await logAction(req, { action: 'journal.create', entityType: 'JournalVoucher', entityId: j._id, entityLabel: j.voucherNo, summary: `${j.voucherNo}: ${j.narration}` });
  return created(res, j, `Voucher ${j.voucherNo} saved`);
}));
router.post('/journals/:id/cancel', post, validate({ params: z.object({ id: oid }), body: z.object({ reason: z.string().trim().min(3, 'Please give a reason').max(200) }) }),
  asyncHandler(async (req, res) => {
    const j = await acc.cancelJournal(req.businessId, req.params.id, req.body.reason);
    await logAction(req, { action: 'journal.cancel', entityType: 'JournalVoucher', entityId: j._id, entityLabel: j.voucherNo, summary: `${j.voucherNo} cancelled: ${req.body.reason}` });
    return ok(res, j, 'Voucher cancelled');
  }));

const head = z.object({ name: z.string().trim().min(2).max(80), group: z.enum(['asset', 'liability', 'equity', 'income', 'expense']), active: z.boolean().optional() });
router.get('/heads', view, h((req) => acc.listHeads(req.businessId)));
router.post('/heads', post, validate({ body: head }), asyncHandler(async (req, res) => created(res, await acc.saveHead(req.businessId, null, req.body), 'Account created')));
router.put('/heads/:id', post, validate({ params: z.object({ id: oid }), body: head.partial().extend({ name: z.string().trim().min(2).max(80) }) }),
  asyncHandler(async (req, res) => ok(res, await acc.saveHead(req.businessId, req.params.id, req.body), 'Account updated')));

export default router;
