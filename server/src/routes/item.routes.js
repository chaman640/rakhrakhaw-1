import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { uploadImage, handleUploadError } from '../middleware/uploadImage.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/item.controller.js';
import {
  createItemSchema, updateItemSchema, listItemsQuerySchema,
  adjustStockSchema, bulkActionSchema, importSchema, idParamSchema,
} from '../validators/item.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant);

// DHYAN: ye fixed paths /:id se PEHLE aane chahiye, warna "stats" ko id samajh lega
router.get('/brands', requirePermission('items:view'), ctrl.brands);
router.get('/stats', requirePermission('items:view'), ctrl.stats);
router.get('/low-stock', requirePermission('items:view'), ctrl.lowStock);
router.get('/units', requirePermission('items:view'), ctrl.units);
router.get('/export', requirePermission('items:view'), ctrl.exportCsv);
router.get('/import/sample', requirePermission('items:view'), ctrl.sampleCsv);
router.post('/import', requirePermission('items:create'), validate({ body: importSchema }), ctrl.importCsv);
router.post('/bulk', requirePermission('items:edit'), validate({ body: bulkActionSchema }), ctrl.bulk);

router.get('/', requirePermission('items:view'), validate({ query: listItemsQuerySchema }), ctrl.list);
router.post('/', requirePermission('items:create'), validate({ body: createItemSchema }), ctrl.create);

router.get('/:id', requirePermission('items:view'), validate({ params: idParamSchema }), ctrl.detail);
router.put('/:id', requirePermission('items:edit'), validate({ params: idParamSchema, body: updateItemSchema }), ctrl.update);
router.delete('/:id', requirePermission('items:delete'), validate({ params: idParamSchema }), ctrl.remove);

router.get('/:id/movements', requirePermission('items:view'), validate({ params: idParamSchema }), ctrl.movements);
router.post('/:id/stock', requirePermission('items:edit'), validate({ params: idParamSchema, body: adjustStockSchema }), ctrl.adjustStock);
router.post('/:id/photo', requirePermission('items:edit'), validate({ params: idParamSchema }), uploadImage.single('photo'), handleUploadError, ctrl.uploadPhoto);
router.delete('/:id/photo', requirePermission('items:edit'), validate({ params: idParamSchema }), ctrl.deletePhoto);

export default router;
