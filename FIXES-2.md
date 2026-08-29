# Doosre review ke 9 bug + OTP ka system naye sire se

Har bug khud verify kiya. **Bug 9, 10 aur 14 sach me utne hi bure the jitna likha tha.**

---

## 🔴 Bug 9 — supplier ki payment delete karo, purchase "chukta" hi rehti
Supplier ki payment me `allocations[].invoiceId` ke andar **Purchase ki id** hoti hai
(khaane ka naam purana hai, matlab nahi). Par reversal hamesha `'Invoice'` me hota tha —
Purchase ki id Invoice collection me dhoondhi jati, **kuch milta hi nahi, koi error bhi
nahi**, aur reversal chup-chaap gayab.

Khata bolta "dena hai", purchase bolti "chukta ho gaya" — bilkul wahi do-alag-jawab
wala bug jise khatam karne ke liye `settlement.service.js` likha gaya tha.

**Fix:** party ke type se tay hota hai kis collection me wapas karna hai. Aur
`allocations[].invoiceId` se `ref` hata diya — wo do alag collection point karta tha.

## 🔴 Bug 10 — ek wholesaler doosre ka retailer account uda sakta tha
`User.isActive` **global** hai, par 4 jagah use per-business samajh kar chhua ja raha tha.

- A ne block kiya → Ramesh ka **B, C, D** me bhi login band
- A ne `deleteParty` dabaya → `User.deleteOne()` → **poora account, saari membership khatam**
- Ulta bhi: A "active" karke B ka lagaya block hata deta

**Fix:** `User` ko chhua hi nahi jata. Per-business pehra `requireActiveParty` pehle se
`party.status` se lagata hai — wahi sahi jagah hai. Aur `User` tabhi mitta hai jab uski
**aur koi dukaan na bache**.

## 🟠 Bug 11 — GST report me credit note ginte hi nahi the
₹1,00,000 bikri, ₹20,000 wapas, 18% → report **₹18,000** maangti, asli zimmedari
**₹14,400**. Har mahine ₹3,600 extra, saal me ₹43,000.

Ulta bhi: purchase return input credit se nahi ghatta tha → zyada credit claim → notice.

**Fix:** dono note ab ginte hain. Report me `grossOutputTax` aur `creditNote` alag
dikhte hain, taaki kagaz pe dono number saaf rahein.

## 🟠 Bug 12 — sale report wapasi nahi ghatati
Jaan-boojh kar sale register me sirf bill rehte hain, par ab `returnTotal` aur
`netSale` **alag se** jate hain — warna Home ka jod aur report ka jod alag milte the.

## 🟠 Bug 13 — `deletePurchase` me do pehre nahi the
1. **Return check** — `soldLots` wali jaanch ise pakadti hi nahi, kyunki purchase return
   FIFO pe chalta hai aur purani khep pehle katti hai.
2. **Payment release** — alag se bani supplier payment jo is purchase pe lagi thi, uska
   `allocations[]` ek mit chuki purchase ko takta reh jata, aur wo paisa kisi doosri
   khuli purchase pe kabhi lagta hi nahi.

Dono ab hain — doosra wahi kaam karta hai jo `releaseInvoiceFromPayments` bill wali
taraf karta hai.

## 🟠 Bug 14 — seat limit teen raaste se bypass
`assertSeat` **sirf `addStaff`** me tha. Nahi tha: `createInvite` (20 link bana lo),
`acceptInvite` (20 log andar), `updateStaff` (band → chalu, koi check nahi).

Mazedaar baat: `assertSeat` ke apne comment me likha tha *"band pade staff ko chalu karte
waqt (+1)"* — wo parameter isi ke liye banaya gaya tha, par call kabhi likhi hi nahi gayi.

**Fix:** chaaron jagah.

## 🟡 Bug 15 — intake me "peeche" dabao to phans jate the
Naya item banao → peeche → wahi naam dobara → *"item pehle se hai"* → aage badhne ka
rasta hi nahi, aur catalog me wo item 0 stock ke saath pada.

**Fix:** faisla ulta karne pe uske saath bana item bhi hat jata hai — par **sirf tab jab
uska stock 0 ho** (beech me kisi ne maal daal diya to wo item ab kaam ka hai).

## 🟡 Bug 16 — bill discount me paisa girta tha
₹100 discount, 3 barabar line → 33.33 × 3 = **99.99**, par `discountTotal` me poora 100.
`subTotal − discountTotal ≠ taxableTotal` — ek paisa, par GST audit me bill ka arithmetic
match nahi karta, aur CA sabse pehle wahi dekhta hai.

**Fix:** aakhri line ko bacha hua poora. (Yahi ilaaj CGST/SGST me pehle se laga tha.)
Test me ab wo jod milaya jata hai.

## 🟡 Bug 17 — `round2` minus me ulti taraf
`EPSILON` hamesha positive jodta tha → `round2(-1.005)` = `-1.00` (galat).
Minus har paise wale raste me hai — `roundOff`, jama paisa, har reversal ka `-amount`.

**Fix:** ishara number ke apne sign ki taraf. Aur `-0` ko `0` bana diya — warna bill pe
"−₹0.00" chhap jata.

---

# OTP — naye sire se

## Kyun nahi aa raha tha

**Meri galti.** Maine APITxT ka URL **andaze se** likha tha (unke docs public nahi hain).
Galat URL pe request jati, galat jawab aata, aur wo *"OTP bhej nahi paye"* me dab kar
gayab ho jata — **aap dekh hi nahi sakte the ki asal me hua kya.**

## Ab kya hai

**1 · Turant kaam chalane ke liye — Fast2SMS default hai.**
Uska `route=otp` **bina sender id aur bina DLT template** ke chalta hai. Aapke paas key
pehle se hai:
```
SMS_PROVIDER=fast2sms
FAST2SMS_API_KEY=f1534ea6-8f06-11f1-908b-0200cd936042
SMS_SENDER_ID=          ← khali hi rehne dein
```

**2 · Jaanchne ka auzaar — yahi wo cheez thi jo missing thi.**
```bash
npm run sms:test 9876543210 --prefix server
```
Wo asli rasta chalata hai aur gateway ka **poora jawab** screen pe rakh deta hai —
provider, HTTP status, URL (key chhupi hui), aur unka exact response. Ab
*"OTP nahi aa raha"* andhera kamra nahi hai: key galat, URL galat, balance khatam,
ya number DND — sab saaf dikhta hai.

**3 · Sender ID kahin zaroori nahi.**
Khali ho to wo khaana **URL se poora nikal** jata hai. Khali `senderid=` chhodna sabse
bura hota — bahut gateway use "galat sender" maan kar mana kar dete hain. Teeno position
(shuru/beech/aakhir) pe test hai.

**4 · "HTTP 200" ka matlab "SMS gaya" nahi maana jata.**
Zyadatar Indian gateway galti bhi 200 ke saath bhejte hain, body me `"status":"error"`
likha hota hai. Ab body bhi dekhi jati hai.

**5 · Key kabhi poori log ya jawab me nahi jati.**

## APITxT chalu karna ho to
```
SMS_PROVIDER=apitxt
APITXT_API_KEY=Qjca7D1Q8pMKxgQnU9FJMh79LBtcGbQ9v2lU3Jkq7_4
APITXT_URL=<apne panel ka EXACT url>
```
`{key}` `{phone}` `{sender}` `{otp}` `{message}` apne aap bhar jate hain. Daalne ke baad
**pehle `sms:test` chalayein** — code chhune ki zarurat nahi padegi.

---

## Test

```
262 selfcheck pass    (pehle 238 the — 24 naye)
i18n 100% · client build ✓ · server boot ✓
```

Bug 16 ka test khaas hai — wo bill ka **asli jod** milata hai
(`subTotal − discountTotal === taxableTotal`), sirf "fix laga hai" nahi dekhta.
