import dotenv from 'dotenv';
dotenv.config();

function required(key, fallback) {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required env variable: ${key}. Check your .env file.`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',

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
