import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/party.controller.js';
import {
  createPartySchema, updatePartySchema, listPartiesQuerySchema, statusSchema,
  idParamSchema, rateParamSchema, setRateSchema, listRatesQuerySchema, bulkRateSchema,
} from '../validators/party.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant);

router.get('/stats', requirePermission('parties:view'), ctrl.stats);

router.get('/', requirePermission('parties:view'), validate({ query: listPartiesQuerySchema }), ctrl.list);
router.post('/', requirePermission('parties:create'), validate({ body: createPartySchema }), ctrl.create);

router.get('/:id', requirePermission('parties:view'), validate({ params: idParamSchema }), ctrl.detail);
router.put('/:id', requirePermission('parties:edit'), validate({ params: idParamSchema, body: updatePartySchema }), ctrl.update);
router.delete('/:id', requirePermission('parties:delete'), validate({ params: idParamSchema }), ctrl.remove);
router.post('/:id/status', requirePermission('parties:approve'), validate({ params: idParamSchema, body: statusSchema }), ctrl.setStatus);

// Party-wise item rate
router.get('/:id/rates', requirePermission('parties:view'), validate({ params: idParamSchema, query: listRatesQuerySchema }), ctrl.listRates);
router.put('/:id/rates/:itemId', requirePermission('parties:edit'), validate({ params: rateParamSchema, body: setRateSchema }), ctrl.setRate);
router.post('/:id/rates/bulk', requirePermission('parties:edit'), validate({ params: idParamSchema, body: bulkRateSchema }), ctrl.bulkRates);

export default router;
