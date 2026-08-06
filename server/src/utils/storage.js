import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env.js';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const cloudinaryConfigured = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
);

let cloudinary = null;
async function getCloudinary() {
  if (!cloudinaryConfigured) return null;
  if (cloudinary) return cloudinary;
  try {
    const mod = await import('cloudinary');
    cloudinary = mod.v2;
    cloudinary.config({
      cloud_name: env.cloudinary.cloudName,
      api_key: env.cloudinary.apiKey,
      api_secret: env.cloudinary.apiSecret,
    });
    return cloudinary;
  } catch {
    console.warn('[storage] cloudinary package nahi mila, local disk use ho rahi hai');
    return null;
  }
}

/**
 * Image save karta hai.
 * Cloudinary keys .env me hain -> wahan jayegi. Warna local uploads/ folder me.
 * Dono case me { url, publicId } wapas milta hai — baaki code ko farak nahi padta.
 */
export async function saveImage(file, folder = 'misc') {
  const cld = await getCloudinary();

  if (cld) {
    const result = await new Promise((resolve, reject) => {
      const stream = cld.uploader.upload_stream(
        { folder: `rakhrakhav/${folder}`, resource_type: 'image' },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      stream.end(file.buffer);
    });
    return { url: result.secure_url, publicId: result.public_id };
  }

  const dir = path.join(UPLOAD_DIR, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const ext = path.extname(file.originalname || '.png').toLowerCase() || '.png';
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  const filepath = path.join(dir, filename);

  await fs.promises.writeFile(filepath, file.buffer);

  return {
    url: `${env.serverUrl}/uploads/${folder}/${filename}`,
    publicId: `local:${folder}/${filename}`,
  };
}

export async function deleteImage(publicId) {
  if (!publicId) return;

  if (publicId.startsWith('local:')) {
    const rel = publicId.slice('local:'.length);
    const filepath = path.join(UPLOAD_DIR, rel);
    await fs.promises.unlink(filepath).catch(() => {});
    return;
  }

  const cld = await getCloudinary();
  if (cld) await cld.uploader.destroy(publicId).catch(() => {});
}

export { UPLOAD_DIR, cloudinaryConfigured };
