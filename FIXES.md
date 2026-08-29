# Review ke bugs — sab band, aur SMS bina sender ID ke

Har bug maine khud code me verify kiya, phir hi fix kiya. **Chaaron critical/high
sach the.**

---

## 🔴 Bug 1 — ek order pe unlimited payment
`order.service.js` · **seedha paisa ka nuksan**

`createPayment` `{ payment, advance }` deta hai — payment nahi. Bina destructure
ke `payment._id` **undefined** tha, isliye upar wala "pehle se payment chadh chuki
hai" wala pehra **kabhi nahi lagta tha**.

₹10,000 ka order, "Payment mili" 5 baar → 5 asli payment, khate me ₹50,000 credit.
Retailer ka poora udhaar saaf. Aur `deletePayment` ka `Order.updateOne({ paymentId })`
bhi kabhi match nahi karta tha, isliye order hamesha "paisa aa gaya" dikhata rehta.

**Fix:** `const { payment } = await createPayment(...)` — ek shabd.

## 🔴 Bug 2 — bina-bill wapasi se bill wali hadd bypass
`return.service.js`

`returnedSoFar` sirf `invoiceId` pe match karta hai; bina-bill wapasi `invoiceId: null`
se save hoti hai — wo is ginti me dikhti hi nahi.

1. INV-1 pe 10 piece bike
2. **bina bill** ka return, 10 piece → party wali ginti se paas
3. INV-1 ke saath return, 10 piece → bill wali ginti ko #2 dikha hi nahi → paas

10 beche, **20 wapas**. Stock me phantom, khate me dohra credit.

**Fix:** bill wali branch me party ki poori ginti bhi — **jo chhoti ho wahi hadd**.
Ulta kram pehle se safe tha; sirf ye ek direction toota tha.

## 🔴 Bug 3 — bina-bill wapasi bill cancel ko nahi rokti
`invoice.service.js` · wahi jad, doosri jagah

`ReturnNote.findOne({ invoiceId })` bina-bill wapasi ko miss karta tha → bill cancel
ho jata → stock **dobara** wapas jud jata. Jo pehra jaan-boojh kar lagaya gaya tha,
wo aadha hi kaam kar raha tha.

**Fix:** us party ki bina-bill wapasi bhi dekhi jati hai jisme is bill ka koi item ho.

## 🟠 Bug 4 — bill ke baad bhi order cancel/edit
`order.service.js` me `invoiceId` ka **ek bhi** reference nahi tha.

Bill bane order ko CONFIRMED me cancel karo → retailer ko "cancel ho gaya" jata hai,
par bill zinda hai aur ₹10,000 udhaar khate me chadha hua. `updateOrderItems` se
quantity bhi badal sakte the — order aur bill hamesha ke liye alag.

**Fix:** dono jagah `if (order.invoiceId) throw`.

## 🟠 Bug 5 — postEntry me aadha kaam
`ledger.service.js`

`$inc` lag chuka aur `LedgerEntry.create` fail → `Party.balance` aur khata **hamesha
ke liye** alag. Wo farak apne aap kabhi theek nahi hota.

**Fix:** wahi compensating pattern jo `createInvoice` me hai — fail par apna `$inc`
ulta, wo bhi na chale to `recalcBalances`.

> Transaction (`withTransaction`) tab lagega jab Atlas replica set pakka ho — abhi
> standalone Mongo pe wo chalta hi nahi, isliye compensating hi sahi rasta hai.

## 🟠 Bug 6 — refund me TOCTOU, cash do baar
`payment.service.js`

`refundableForReturn` aur `createPayment` do alag pal hain, beech me koi lock nahi.
Double-tap ya slow net → dono paas → **asli cash do baar bahar**.

**Fix:** `ReturnNote` pe `refundLockedAt` jhanda, `findOneAndUpdate` ke **filter** me —
wahi pattern jo `confirmPayment` me hai. Paisa na jaye to jhanda khul bhi jata hai,
warna wapasi hamesha ke liye atak jati.

## 🟡 Bug 7 — chup-chaap item gir jata tha
12 item ka cart → 8 ka order → koi khabar nahi. Retailer us maal ka intezaar karta
rehta jo order me tha hi nahi.

**Fix:** `dropped[]` jawab me jata hai, aur checkout ke baad screen pe saaf likha
aata hai — *"Ye item order me nahi aaye (stock khatam tha): …"*

## 🟡 Bug 8 — anaath refund payment
Refund ho chuki wapasi delete ho jati thi; `Payment.returnNoteId` ek aise note ko
takta reh jata jo hai hi nahi.

**Fix:** aisi wapasi delete se pehle ruk jati hai, saaf wajah ke saath.

---

## SMS — ab **sender ID ke bina** bhi jata hai

`SMS_SENDER_ID` khali chhod dijiye. Wo khaana URL se **apne aap nikal** jata hai aur
gateway ka apna default naam lag jata hai.

Khali `senderid=` chhod dena sabse bura hota — bahut se gateway use "galat sender"
maan kar mana kar dete hain. Isliye poora khaana hi hatta hai, aur `?` `&` ka jod bhi
theek ho jata hai (teeno position pe test kiya: shuru, beech, aakhir).

DLT approval mil jaye tab bhar dijiye — kuch aur badalna nahi padega.

---

## Aur wo VAPID wala crash

Aapke Render me `VAPID_PRIVATE_KEY=W9NA...` poori line Value box me chali gayi thi,
isliye value me `=` aa gaya aur web-push ne mana kar diya — **aur poora server gir
gaya.** Wo girna meri galti thi: push fail ho to push band ho, server nahi.

Ab do cheezein:
1. **Galat key se server nahi girta** — sirf push band rehta hai, log me saaf wajah.
2. **`KEY=` wala paste apne aap sudhar jata hai** — maine test kiya, aapki wahi
   galat wali value ab bhi kaam kar jayegi.

Phir bhi Render me theek kar lijiye: **Value** box me sirf key, `VAPID_PRIVATE_KEY=`
ke bina.

---

## Test

```
238 selfcheck pass    (pehle 226 the — 12 naye, har bug ka apna)
i18n 100% · client build ✓ · server boot ✓ (galat VAPID ke saath bhi)
```

Har bug ka test uske **exploit** pe likha hai, sirf "fix laga hai" pe nahi.
