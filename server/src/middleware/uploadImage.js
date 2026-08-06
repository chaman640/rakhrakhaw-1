import multer from 'multer';
import ApiError from '../utils/ApiError.js';

const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
  fileFilter(req, file, cb) {
    if (!ALLOWED.includes(file.mimetype)) {
      return cb(ApiError.badRequest('Sirf PNG, JPG ya WEBP image chalegi'));
    }
    cb(null, true);
  },
});

// Multer ke apne errors ko sudhar kar bhejo
export function handleUploadError(err, req, res, next) {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return next(ApiError.badRequest('Image 3 MB se choti honi chahiye'));
  }
  next(err);
}
