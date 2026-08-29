import webpush from 'web-push';
import { env } from '../config/env.js';
import { PushSubscription } from '../models/index.js';

let ready = false;

/*
  Galat VAPID key se POORA SERVER nahi girna chahiye — push band ho, bas.

  Sabse aam galti: Render/host ke "Value" box me poori line paste ho jati hai
  (`VAPID_PRIVATE_KEY=abc...`), isliye value ke andar `=` chala jata hai aur
  web-push mana kar deta hai. `trim()` aur `KEY=` wala hissa kaat dena us
  galti ko chup-chaap sudhar deta hai.
*/
const clean = (v) => String(v || '').trim().replace(/^[A-Z_]+=/, '');

const pubKey = clean(env.push.publicKey);
const privKey = clean(env.push.privateKey);

if (pubKey && privKey) {
  try {
    webpush.setVapidDetails(env.push.subject, pubKey, privKey);
    ready = true;
  } catch (err) {
    console.error(`[push] VAPID key theek nahi hai — phone pe notification band rahenge. ${err.message}`);
    console.error('[push] Nayi key: npm run vapid --prefix server');
    console.error('[push] Dhyan: host ke Value box me SIRF key daalein, "VAPID_PRIVATE_KEY=" ke bina.');
  }
}

export const pushReady = () => ready;
export const publicKey = () => pubKey;

export async function saveSubscription(userId, businessId, sub, ua = '') {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return null;
  return PushSubscription.findOneAndUpdate(
    { endpoint: sub.endpoint },
    {
      $set: {
        userId, businessId,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent: String(ua).slice(0, 200),
        lastSeenAt: new Date(),
        failures: 0,
      },
    },
    { new: true, upsert: true },
  ).lean();
}

export async function removeSubscription(endpoint) {
  if (!endpoint) return;
  await PushSubscription.deleteOne({ endpoint });
}

/**
 * Ek user ke sab device pe bhejo.
 *
 * 404/410 = wo device hamesha ke liye ja chuka — turant hata dete hain, warna
 * mari hui subscription har notification pe ek bekaar HTTP call banti rehti
 * hai aur ek lakh user pe wo seedha paisa hai.
 */
export async function pushToUser(userId, payload) {
  if (!ready || !userId) return { sent: 0 };

  const subs = await PushSubscription.find({ userId })
    .select('endpoint p256dh auth').limit(10).lean();
  if (!subs.length) return { sent: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  const dead = [];

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
        { TTL: 24 * 3600, urgency: 'normal' },
      );
      sent += 1;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) dead.push(s.endpoint);
      else await PushSubscription.updateOne({ endpoint: s.endpoint }, { $inc: { failures: 1 } });
    }
  }));

  if (dead.length) await PushSubscription.deleteMany({ endpoint: { $in: dead } });
  return { sent, removed: dead.length };
}
