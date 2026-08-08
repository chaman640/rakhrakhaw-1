import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

export async function connectDB() {
  try {
    const conn = await mongoose.connect(env.mongoUri);
    console.log(`[db] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.error('[db] MongoDB connection failed:', err.message);
    // Deploy pe log me sirf "connection failed" dikhe to samajh nahi aata kya karna hai —
    // isliye teeno aam wajah yahin likh dete hain.
    console.error('[db] Aksar ye teen wajah hoti hain:');
    console.error('     1. Atlas → Network Access me 0.0.0.0/0 add nahi kiya');
    console.error('     2. MONGO_URI me password galat, ya usme @ # $ % hai (URL-encode karein)');
    console.error('     3. URI me database ka naam nahi — .net/ ke baad rakhrakhav likhna hai');
    process.exit(1);
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
