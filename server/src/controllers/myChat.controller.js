import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as myChatService from '../services/myChat.service.js';

export const listConversations = asyncHandler(async (req, res) =>
  ok(res, await myChatService.listConversationsForRetailer(req.user)));

export const search = asyncHandler(async (req, res) =>
  ok(res, await myChatService.searchShopsForRetailer(req.user, req.query.q || '')));

// Ye do `withBuyerTenant` ke peeche chalte hain — X-Shop-Id se businessId/partyId aata hai
export const getMessages = asyncHandler(async (req, res) =>
  ok(res, await myChatService.getMessages(req.businessId, req.partyId, 'retailer', {
    before: req.query.before,
  })));

export const sendMessage = asyncHandler(async (req, res) =>
  ok(res, await myChatService.sendMessage(
    req.businessId, req.partyId, req.body, req.file, 'retailer', req.user._id,
  ), 'Bhej diya'));
