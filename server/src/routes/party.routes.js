import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES, PERMISSIONS } from '../config/constants.js';
import * as ctrl from '../controllers/party.controller.js';
import {
  createPartySchema, updatePartySchema, listPartiesQuerySchema, statusSchema,
  idParamSchema, rateParamSchema, setRateSchema, listRatesQuerySchema, bulkRateSchema,
} from '../validators/party.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePermission(PERMISSIONS.PARTIES));

router.get('/stats', ctrl.stats);

router.get('/', validate({ query: listPartiesQuerySchema }), ctrl.list);
router.post('/', validate({ body: createPartySchema }), ctrl.create);

router.get('/:id', validate({ params: idParamSchema }), ctrl.detail);
router.put('/:id', validate({ params: idParamSchema, body: updatePartySchema }), ctrl.update);
router.delete('/:id', validate({ params: idParamSchema }), ctrl.remove);
router.post('/:id/status', validate({ params: idParamSchema, body: statusSchema }), ctrl.setStatus);

// Party-wise item rate
router.get('/:id/rates', validate({ params: idParamSchema, query: listRatesQuerySchema }), ctrl.listRates);
router.put('/:id/rates/:itemId', validate({ params: rateParamSchema, body: setRateSchema }), ctrl.setRate);
router.post('/:id/rates/bulk', validate({ params: idParamSchema, body: bulkRateSchema }), ctrl.bulkRates);

export default router;
