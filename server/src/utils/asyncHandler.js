// Har async controller ko isme wrap karo — try/catch likhne ki zarurat nahi.
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
