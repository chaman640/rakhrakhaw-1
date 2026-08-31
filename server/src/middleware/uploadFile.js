import multer from 'multer';
import ApiError from '../utils/ApiError.js';

/*
  Excel / PDF / photo — 10 MB tak.

  Disk pe nahi rakhte; memory me hi padh kar chhod dete hain. Render ki disk
  har deploy pe saaf ho jati hai, aur ye file sirf ek baar padhni hoti hai.
*/
const OK = /(sheet|excel|csv|pdf|^image\/)/i;

export const uploadFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (OK.test(file.mimetype) || /\.(xlsx|xls|csv|pdf)$/i.test(file.originalname || '')) {
      return cb(null, true);
    }
    return cb(ApiError.badRequest('Sirf Excel, CSV, PDF ya photo chalti hai'));
  },
}).single('file');
