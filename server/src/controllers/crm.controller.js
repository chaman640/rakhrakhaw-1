import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/crm.service.js';

export const overview = asyncHandler(async (req, res) =>
  ok(res, await service.getCrmOverview(req.businessId, req.user)));
