#!/usr/bin/env node
/* Ek baar chalao, do line .env me daal do. */
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log('\nPhone pe notification ke liye — ye do line server/.env me daalein:\n');
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('\nDhyan: ye ek baar banti hain. Baad me badalne par sab purane phone ka');
console.log('subscription mar jata hai aur sabko dobara chalu karna padta hai.\n');
