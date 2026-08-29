#!/usr/bin/env node
/**
 * OTP ka SMS SACH ME jata hai ya nahi — aur na jaye to KYUN.
 *
 *   npm run sms:test 9876543210
 *
 * Ye wahi rasta chalata hai jo asli signup chalata hai, aur gateway ka POORA
 * jawab screen pe rakh deta hai. Bina iske "OTP nahi aa raha" ek andhera
 * kamra hai — pata hi nahi chalta ki key galat hai, URL galat hai, balance
 * khatam hai, ya number DND me hai.
 */
import { env } from '../src/config/env.js';
import { trySendOtp, smsReady, smsProvider } from '../src/services/sms.service.js';

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', N = '\x1b[0m';

const phone = (process.argv[2] || '').replace(/\D/g, '').slice(-10);
if (phone.length !== 10) {
  console.log(`\n${R}Number daalein:${N}  npm run sms:test 9876543210\n`);
  process.exit(1);
}

const code = String(Math.floor(100000 + Math.random() * 900000));

console.log(`\n${Y}SMS ki setting${N}`);
console.log(`  provider   : ${smsProvider()}`);
console.log(`  key hai?   : ${env.sms.provider === 'fast2sms'
  ? (env.fast2sms.apiKey ? 'haan' : `${R}NAHI${N}`)
  : (env.sms.apitxtKey ? 'haan' : `${R}NAHI${N}`)}`);
console.log(`  sender id  : ${env.sms.senderId || `${D}khali — bina sender ke koshish hogi${N}`}`);
if (env.sms.provider !== 'fast2sms') {
  console.log(`  url        : ${D}${env.sms.apitxtUrl}${N}`);
  console.log(`  route      : ${env.sms.route} ${D}(4 = transactional)${N}`);
  console.log(`  template   : ${env.sms.templateId || `${D}koi nahi${N}`}`);
}
console.log(`  ready      : ${smsReady() ? `${G}haan${N}` : `${R}nahi${N}`}`);

console.log(`\n${Y}Bhej rahe hain${N}  ${phone}  ->  OTP ${code}\n`);

const out = await trySendOtp(phone, code);

console.log(out.sent ? `${G}✔ Gateway ne HAAN kaha${N}` : `${R}✖ Nahi gaya${N}`);

/*
  DONO koshish dikhate hain — sender ke saath aur bina sender ke. Isi se pata
  chalta hai ki `.env` me `SMS_SENDER_ID` rakhna hai ya khali chhodna hai.
*/
for (const t of out.tries || [out]) {
  console.log(`\n  ${t.sent ? G + '✔' : R + '✖'}${N} koshish — sender: ${t.sender || '(bina sender)'}`);
  if (t.status) console.log(`     HTTP  : ${t.status}`);
  if (t.url) console.log(`     url   : ${D}${t.url}${N}`);
  console.log('     jawab :', typeof t.response === 'string' ? t.response : JSON.stringify(t.response));
}
if (out.reason) console.log(`\n  wajah : ${out.reason}`);

if (out.sent) {
  console.log(`\n${D}Ab phone dekhein. 2 minute me na aaye to gateway ne "haan" to kaha`);
  console.log(`par bheja nahi — aksar wajah: balance khatam, ya number DND me.${N}\n`);
} else {
  console.log(`\n${Y}Upar wale jawab me hi wajah likhi hoti hai. Aam wajah:${N}`);
  console.log('  · "Invalid authkey"        -> APITXT_API_KEY galat hai');
  console.log('  · "sender" wali baat       -> SMS_SENDER_ID bharein (APITxT panel me jo approve hua)');
  console.log('  · "template" wali baat     -> DLT_TEMPLATE_ID bharein');
  console.log('  · "balance" / "credit"     -> account me paisa daalein');
  console.log('  · "route"                  -> SMS_ROUTE=4 (transactional) rakhein');
  console.log(`\n${D}Jawab samajh na aaye to wo poori line APITxT support ko bhej dein —`);
  console.log(`unke liye wo saaf hoti hai.${N}\n`);
  process.exit(1);
}
