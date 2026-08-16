export default class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg = 'Bad request', details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Login required') { return new ApiError(401, msg); }
  // details isliye: mana karte waqt client ko batana hota hai ki KIS cheez ki
  // ijazat chahiye thi — usi se UI sahi button chhupa/dikha pata hai
  static forbidden(msg = 'Aapko iski permission nahi hai', details) { return new ApiError(403, msg, details); }
  static notFound(msg = 'Not found') { return new ApiError(404, msg); }
  static conflict(msg = 'Already exists') { return new ApiError(409, msg); }
}
