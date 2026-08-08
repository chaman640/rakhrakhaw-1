import fs from 'fs';
import dotenv from 'dotenv';
import { ENV_FILE } from './paths.js';

// server/.env hamesha wahin se padho jahan wo pada hai.
// Root se `npm start` chalane par cwd root hota hai — bina iske .env milti hi nahi thi.
if (fs.existsSync(ENV_FILE)) dotenv.config({ path: ENV_FILE });
else dotenv.config(); // Render pe file nahi hoti, wahan values dashboard se aati hain

const IS_PROD = (process.env.NODE_ENV || 'development') === 'production';

/**
 * Dev me aasani ke liye fallback chalta hai.
 * Production (deploy) me fallback nahi milta — value na ho to saaf error deta hai,
 * warna Render pe log me "ECONNREFUSED 127.0.0.1:27017" aata hai aur samajh hi
 * nahi aata ki asli galti sirf ek khali env variable thi.
 */
function required(key, devFallback) {
  const value = process.env[key] || (IS_PROD ? '' : devFallback);
  if (!value) {
    throw new Error(
      `${key} set nahi hai.` +
        (IS_PROD
          ? ` Render → aapki service → Environment me ${key} bharein, phir "Save".`
          : ` server/.env me ${key} bharein.`)
    );
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: IS_PROD,

  mongoUri: required('MONGO_URI', 'mongodb://127.0.0.1:27017/rakhrakhav'),

  jwtSecret: required('JWT_SECRET', 'dev-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',

  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  // Local uploads ka public URL banane ke liye
  serverUrl: process.env.SERVER_URL || `http://localhost:${Number(process.env.PORT || 5000)}`,

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
};
