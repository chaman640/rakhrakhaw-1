import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as storyService from '../services/story.service.js';

/* ── wholesaler: apni stories banana/dekhna/hatana ── */

export const createStory = asyncHandler(async (req, res) =>
  ok(res, await storyService.createStory(req.businessId, req.file, req.body.caption), 'Story lag gayi'));

export const listMyStories = asyncHandler(async (req, res) =>
  ok(res, await storyService.listMyStories(req.businessId)));

export const deleteStory = asyncHandler(async (req, res) =>
  ok(res, await storyService.deleteStory(req.businessId, req.params.id), 'Story hata di'));

/* ── retailer/buyer: dukaan ki stories dekhna ── */

export const viewStories = asyncHandler(async (req, res) =>
  ok(res, await storyService.getStoriesForViewer(req.params.businessId, req.user)));

export const markViewed = asyncHandler(async (req, res) => {
  await storyService.markViewed(req.params.id, req.user);
  return ok(res, { seen: true });
});
