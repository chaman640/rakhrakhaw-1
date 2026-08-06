import ApiError from '../utils/ApiError.js';

// Zod schema se body/query/params validate karta hai.
// Use: router.post('/', validate({ body: createItemSchema }), controller)
export const validate = (schemas) => (req, res, next) => {
  try {
    for (const key of ['body', 'query', 'params']) {
      if (schemas[key]) {
        const result = schemas[key].safeParse(req[key]);
        if (!result.success) {
          const details = result.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          }));
          throw ApiError.badRequest('Validation failed', details);
        }
        req[key] = result.data;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
};
