import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

export async function connectDB() {
  try {
    const conn = await mongoose.connect(env.mongoUri, {
      /*
        Pool ki hadd. Default 100 hai — Atlas ke chhote plan par utne connection
        khulte hi nahi, aur har extra connection ka apna kharch hai. 10 ek node
        ke liye kaafi hai; barhne par node badhaiye, pool nahi.
      */
      maxPoolSize: Number(process.env.MONGO_POOL || 10),
      minPoolSize: 1,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      // Index apne aap banana sirf dev me. Live pe ye har boot pe chalta hai
      // aur bade collection par server ko minaton dabaye rakhta hai.
      autoIndex: env.nodeEnv !== 'production',
    });
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
