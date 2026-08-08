import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Sabhi zaroori folder yahin se milte hain.
 *
 * Pehle `process.cwd()` use hota tha — us se dikkat ye thi ki server ko kahan se
 * chalaya gaya hai us par folder badal jata tha:
 *   server/ me `npm run dev`  -> server/uploads
 *   root me  `npm start`      -> uploads
 * Do alag folder ban jate the aur purani photo gayab dikhti thi.
 *
 * Ab raasta file ki apni jagah se nikalta hai, isliye kahin se bhi chalao — ek hi rehta hai.
 */
const here = path.dirname(fileURLToPath(import.meta.url)); // server/src/config

/** server/ folder */
export const SERVER_ROOT = path.resolve(here, '../..');

/** poore project ka root (jahan package.json aur render.yaml hain) */
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

/** client ka bana hua build — production me isi ko serve karte hain */
export const CLIENT_DIST = path.join(PROJECT_ROOT, 'client', 'dist');

/** local par save hui images (Cloudinary set na ho to) */
export const UPLOAD_DIR = path.join(SERVER_ROOT, 'uploads');

/** server/.env — root se chalane par bhi yahi padhni hai */
export const ENV_FILE = path.join(SERVER_ROOT, '.env');
