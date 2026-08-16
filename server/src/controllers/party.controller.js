import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as service from '../services/party.service.js';
import { logAction, diff } from '../services/audit.service.js';

export const list = asyncHandler(async (req, res) => {
  const { parties, meta } = await service.listParties(req.businessId, req.query, req.user);
  return res.json({ success: true, message: 'OK', data: parties, meta });
});

export const stats = asyncHandler(async (req, res) =>
  ok(res, await service.getStats(req.businessId, req.query.type || 'retailer', req.user)));

export const detail = asyncHandler(async (req, res) =>
  ok(res, await service.getParty(req.businessId, req.params.id, req.user)));

export const create = asyncHandler(async (req, res) => {
  const party = await service.createParty(req.businessId, req.body, req.user._id);
  await logAction(req, {
    action: 'party.create',
    entityType: 'Party', entityId: party._id, entityLabel: party.shopName || party.name,
    summary: `Naya ${party.type === 'supplier' ? 'supplier' : 'retailer'} "${party.shopName || party.name}" jodha`,
  });
  return created(res, party, `${req.body.name} add ho gaya`);
});

/**
 * Credit limit aur rate ka farak register me zaroor jana chahiye — yahi wo
 * cheezein hain jinme chupke se badlaav se dukaan ko sach me nuksaan hota hai.
 */
const PARTY_FIELDS = {
  name: 'Naam',
  shopName: 'Dukaan ka naam',
  phone: 'Phone',
  creditLimit: 'Credit limit',
  openingBalance: 'Purana hisaab',
  isActive: 'Chalu hai',
  assignedToUserId: 'Kiske naam',
};

export const update = asyncHandler(async (req, res) => {
  const before = await service.getParty(req.businessId, req.params.id, req.user).catch(() => null);
  const party = await service.updateParty(req.businessId, req.params.id, req.body, req.user);

  const changes = diff(before?.party || before, party, PARTY_FIELDS);
  if (changes.length) {
    await logAction(req, {
      action: 'party.update',
      entityType: 'Party', entityId: req.params.id,
      entityLabel: party.shopName || party.name,
      changes,
      summary: `"${party.shopName || party.name}" me ${changes.map((c) => c.label).join(', ')} badla`,
    });
  }

  return ok(res, party, 'Save ho gaya');
});

export const setStatus = asyncHandler(async (req, res) => {
  const party = await service.setStatus(req.businessId, req.params.id, req.body.status, req.user);
  const messages = {
    active: `${party.name} ab order kar sakta hai`,
    blocked: `${party.name} ko block kar diya`,
    pending: `${party.name} wapas pending me daal diya`,
  };
  await logAction(req, {
    action: `party.${req.body.status}`,
    entityType: 'Party', entityId: party._id, entityLabel: party.shopName || party.name,
    summary: `"${party.shopName || party.name}" ko ${req.body.status} kiya`,
  });
  return ok(res, party, messages[req.body.status]);
});

export const remove = asyncHandler(async (req, res) => {
  const before = await service.getParty(req.businessId, req.params.id, req.user).catch(() => null);
  const label = before?.party?.shopName || before?.party?.name || before?.shopName || before?.name || '';
  const result = await service.deleteParty(req.businessId, req.params.id, req.user);
  await logAction(req, {
    action: 'party.delete',
    entityType: 'Party', entityId: req.params.id, entityLabel: label,
    summary: `"${label}" hataya`,
  });
  return ok(res, result, result.message);
});

export const listRates = asyncHandler(async (req, res) => {
  const { party, rows, customCount, meta } = await service.listRates(req.businessId, req.params.id, req.query, req.user);
  return res.json({ success: true, message: 'OK', data: { party, rows, customCount }, meta });
});

export const setRate = asyncHandler(async (req, res) => {
  const result = await service.setRate(req.businessId, req.params.id, req.params.itemId, req.body.rate, req.user);
  await logAction(req, {
    action: 'party.rate',
    entityType: 'Party', entityId: req.params.id, entityLabel: result.partyName || '',
    summary: result.message,
  });
  return ok(res, result, result.message);
});

export const bulkRates = asyncHandler(async (req, res) => {
  const result = await service.bulkSetRates(req.businessId, req.params.id, req.body, req.user);
  return ok(res, result, result.message);
});
