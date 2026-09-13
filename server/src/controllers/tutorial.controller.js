import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/tutorial.service.js';

export const list = asyncHandler(async (req, res) => ok(res, await service.listTutorials()));

export const onboardingTour = asyncHandler(async (req, res) =>
  ok(res, await service.listOnboardingTour()));

export const one = asyncHandler(async (req, res) =>
  ok(res, await service.getTutorial(req.params.key)));
