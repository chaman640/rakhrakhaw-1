import webpush from 'web-push';
import { env } from '../config/env.js';
import { PushSubscription } from '../models/index.js';

let ready = false;
if (env.push.publicKey && env.push.privateKey) {
  webpush.setVapidDetails(env.push.subject, env.push.publicKey, env.push.privateKey);
  ready = true;
}

export const pushReady = () => ready;
export const publicKey = () => env.push.publicKey;

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
