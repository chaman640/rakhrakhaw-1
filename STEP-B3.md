# Step 3 — phone pe notification, aur OTP APITxT se

## Sabse zaroori baat: SMS ka bill

| | Kaise jata hai | Paisa |
|---|---|---|
| Naya order, paisa aaya, stock khatam, plan, sab kuch | **App ke through phone pe** | **₹0** |
| OTP (signup / password bhool gaye) | SMS | sirf itna |

Notification bilkul waise aate hain jaise YouTube ya WhatsApp ke aate hain — phone
band ho, app khuli na ho, tab bhi. **Iske paise nahi lagte.** SMS sirf OTP ke liye
bachta hai, isliye bill bahut kam rehta hai.

---

## Chalu kaise karein

**1. VAPID key banayein (ek baar):**

```bash
npm run vapid --prefix server
```

Do line milengi, `server/.env` me daal dein:
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

> Ye key **ek baar** banti hai. Baad me badalne par sab purane phone ka subscription
> mar jata hai aur sabko dobara chalu karna padta hai.

**2. OTP ke liye APITxT:**
```
SMS_PROVIDER=apitxt
APITXT_API_KEY=apna-apitxt-key-yahan
SMS_SENDER_ID=<aapka approved sender id>
```

**3. User apne phone pe chalu kare** — Notifications page pe ek button hai:
*"Phone pe notification — Chalu karein"*. Phone puchhega, haan karte hi chalu.

---

## APITxT ke baare me ek baat saaf

Maine APITxT ka **exact API URL public docs me nahi mila** — unke page pe sirf ye
likha hai ki REST API hai, endpoint aur parameter ke naam nahi diye. Isliye maine URL
ko **`.env` se configurable** bana diya:

```
APITXT_URL=https://api.apitxt.com/api/v2/sms/send?apikey={key}&mobile={phone}&senderid={sender}&message={message}&type=otp
```

`{key}` `{phone}` `{sender}` `{otp}` `{message}` apne aap bhar jate hain.

**Aap apne APITxT dashboard/docs se exact URL copy karke ye ek line badal dijiye** —
code me kuch chhune ki zarurat nahi. Maine andaze se URL likh kar "ho gaya" kehna
theek nahi samjha; wo galti tab pakdi jati jab pehla graahak signup na kar pata.

Fast2SMS wala purana rasta abhi bhi maujood hai — `SMS_PROVIDER=fast2sms` se chal
jayega.

---

## Kya kya push jata hai

Push `notify()` ke andar se jata hai — poore app me notification banane ka **ek hi
darwaza**. Matlab jo bhi alert aaj app ke andar aata hai, wo ab phone pe bhi jayega:

naya order · order ki halat · paisa aaya · payment confirm/reject · bill bana ·
udhaar ki yaad · stock khatam · maal aaya (intake) · plan/mohlat

Naya alert jodne par phone wala hissa **apne aap** jud jata hai — alag se kuch likhna
nahi padta.

---

## Char cheezein jo dhyan se ki

**Push fail hone se asli kaam nahi rukta.** Bill banate waqt push na ja paye to bill
phir bhi banega — push `catch` ke andar hai.

**Mara hua device turant hat jata hai.** Phone se app hatane par uska endpoint 404/410
deta hai. Use rakhe rehna matlab har notification pe ek bekaar HTTP call — ek lakh user
pe wo seedha paisa aur waqt dono ka nuksan. Isliye turant delete.

**Ek user ke 10 device tak.** Bina hadd ke ek account sau device jama kar sakta hai aur
har alert sau call ban jata hai.

**Service worker kabhi cache nahi hota.** Purana `sw.js` chipak jaye to notification ka
naya code kabhi pahunchta hi nahi — aur ye bug pakadna sabse mushkil hai, kyunki sab
kuch theek dikhta hai, bas alert nahi aate.

Aur chhoti si baat jo roz kaam aati hai: ek hi tarah ke alert `tag` se ek doosre ki
jagah le lete hain. Bina iske das order aane par phone pe das line ban jati hai.

---

## Test

```
205 selfcheck pass    (Step 2 ke baad 192 the — 13 naye)
i18n 100% (app ke shabd)
server boot verify · VAPID key ke saath push ready ✓
```

Smoke me: device jodna, wahi device dobara jodne pe **do entry na banna**, adhoori
subscription pe crash na hona, aur hatane par saaf ho jana.

---

## Chalane ka tarika

```bash
unzip -o rakhrakhav-step-b3.zip -d rakhrakhav
cd rakhrakhav
bash setup.sh
npm run vapid --prefix server     # do line .env me daal dein
```

VAPID key na daalein to push chup-chaap band rehta hai — app poori tarah chalti hai,
bas phone pe alert nahi jate. Kuch tootta nahi.

---

## Aage — Step 4 (aakhri)

1 lakh user: index ka audit, query ka budget, cache, rate limit, purana data ka
safai, aur database ka bill kaabu me.
