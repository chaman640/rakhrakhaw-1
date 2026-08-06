export function ok(res, data = null, message = 'OK') {
  return res.status(200).json({ success: true, message, data });
}

export function created(res, data = null, message = 'Created') {
  return res.status(201).json({ success: true, message, data });
}

export function paginated(res, items, { page, limit, total }) {
  return res.status(200).json({
    success: true,
    message: 'OK',
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}
