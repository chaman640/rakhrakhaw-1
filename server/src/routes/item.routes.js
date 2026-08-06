import { Router } from 'express';
import { protect, requireRole } from '../middleware/auth.js';
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
router.get('/stats', ctrl.stats);
router.get('/low-stock', ctrl.lowStock);
router.get('/units', ctrl.units);
router.get('/export', ctrl.exportCsv);
router.get('/import/sample', ctrl.sampleCsv);
router.post('/import', validate({ body: importSchema }), ctrl.importCsv);
router.post('/bulk', validate({ body: bulkActionSchema }), ctrl.bulk);

router.get('/', validate({ query: listItemsQuerySchema }), ctrl.list);
router.post('/', validate({ body: createItemSchema }), ctrl.create);

router.get('/:id', validate({ params: idParamSchema }), ctrl.detail);
router.put('/:id', validate({ params: idParamSchema, body: updateItemSchema }), ctrl.update);
router.delete('/:id', validate({ params: idParamSchema }), ctrl.remove);

router.get('/:id/movements', validate({ params: idParamSchema }), ctrl.movements);
router.post('/:id/stock', validate({ params: idParamSchema, body: adjustStockSchema }), ctrl.adjustStock);
router.post('/:id/photo', validate({ params: idParamSchema }), uploadImage.single('photo'), handleUploadError, ctrl.uploadPhoto);
router.delete('/:id/photo', validate({ params: idParamSchema }), ctrl.deletePhoto);

export default router;
