import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as chatService from '../services/chat.service.js';

export const listConversations = asyncHandler(async (req, res) =>
  ok(res, await chatService.listConversationsForWholesaler(req.businessId)));

export const search = asyncHandler(async (req, res) =>
  ok(res, await chatService.searchPartiesForWholesaler(req.businessId, req.query.q || '')));

export const getMessages = asyncHandler(async (req, res) =>
  ok(res, await chatService.getMessages(req.businessId, req.params.partyId, 'wholesaler', {
    before: req.query.before,
  })));

export const sendMessage = asyncHandler(async (req, res) =>
  ok(res, await chatService.sendMessage(
    req.businessId, req.params.partyId, req.body, req.file, 'wholesaler', req.user._id,
  ), 'Bhej diya'));
