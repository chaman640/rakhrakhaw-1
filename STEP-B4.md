# Step 4 — 1 lakh user, aur database ka bill kaabu me

## Sabse bada kaam: 24 bekaar index hataye

Har naya bill, payment ya order likhne pe **utne hi index update hote hain**. Bekaar
pade index sirf jagah nahi lete — wo har likhne ko dheema karte hain aur mahine ka
bill badhate hain.

Poore app me `businessId` ka apna alag index bhi tha **aur** `businessId + kuch aur`
wale compound bhi. Compound apne shuruaati hisse ke liye pehle se kaam kar leta hai,
isliye wo alag wala pura bekaar tha — bas kharcha.

```
pehle: 139 index      ab: 115 index
```

**Aur 8 naye index jode** — un jagah jahan sach me zarurat thi:

| Query | Kahan chalti hai |
|---|---|
| `businessId + partyId + dueAmount + invoiceDate` | jama paisa bill pe lagana (Batch A ki jaan) |
| `businessId + refType + refId` (khata) | bill cancel, payment delete |
| `businessId + allocations.invoiceId` | bill cancel pe uspe lagi payments |
| `businessId + refType + refId` (stock) | purchase/bill ka stock movement |

Ye chaaron har paise wale kaam me chalti hain. Bina index ke inme poori table padhni
padti hai — aur 1 lakh user pe wahi sabse pehle girta hai.

**Dekhne ka rasta:**
```bash
npm run dbcheck --prefix server            # index ka naksha
npm run dbcheck --prefix server -- --live  # asli size aur bojh
```

---

## Purana data apne aap saaf

Do collection aise hain jo kabhi ghatte nahi:

- **Notification** — 90 din baad apne aap hat jati hai
- **Audit log** — 180 din baad

1 lakh user pe yahi sabse tezi se badhne wala data hai. Bina iske ye do collection
saal bhar me baaki poore database se bade ho jate.

---

## Har request ka ek database call bacha

`protect` har request pe user ko database se padhta tha — poore system ki **sabse
garam query**. Ab wo **15 second** cache hota hai.

15 hi kyun: is beech me band kiya gaya staff ya doosre phone se nikala gaya aadmi utni
der aur chal sakta hai. 15 second me wo kuch aisa nahi kar sakta jo wapas na ho, aur
badle me har request ka ek call bach jata hai. Zyada rakhne se "ek number ek jagah"
wali rok bemaani ho jati; kam rakhne se cache ka faayda hi nahi bachta.

Aur **naya login karte hi wo cache turant saaf** hota hai — warna purana phone 15
second aur chalta aur wo rok us pal jhooth lagti.

Redis **jaan-boojh kar nahi**. Ek aur cheez chalana, uska bill, aur uske fail hone par
kya ho — teeno ka daam is faayde se zyada hai. Cache ki apni hadd bhi lagi hai (2000
entry), warna ek galat key chupchap badhti rehti aur ek din server ki memory kha jati
— aur wo crash 3 baje raat ko aata hai.

---

## Request ki hadd

| Rasta | Hadd | Kyun |
|---|---|---|
| `/api/auth/otp` | 12 / 10 min | **har call ek SMS = paisa** |
| `/api/auth` | 40 / 10 min | password guess karne wale |
| `/api` | 300 / minute | bhaag-daud rokne ke liye |
| webhook | koi hadd nahi | wo Razorpay se aata hai, aadmi se nahi |

Ginti IP se hoti hai. Ek dukaan ke kai log ek wifi pe ho sakte hain, isliye aam API ki
hadd udaar rakhi — 300/minute me koi asli aadmi nahi atakta.

---

## Baaki

- **Jawab dabaya jata hai** (compression) — mobile data pe seedha farak
- **Connection pool 10** — Atlas ke chhote plan par 100 connection khulte hi nahi, aur
  har extra connection ka apna kharch hai. Bhaar barhe to node badhaiye, pool nahi.
- **Live pe index apne aap nahi bante** (`autoIndex` sirf dev me) — warna har boot pe
  wo chalta hai aur bade collection par server minaton dabaya rehta hai

```
MONGO_POOL=10
RATE_LIMIT_PER_MIN=300
```

---

## Test

```
226 selfcheck pass    (Step 3 ke baad 205 the — 21 naye)
i18n 100% · server boot verify
```

Do jaanch aisi hain jo aage bhi bachaengi:

- **kul index 150 se kam, aur kisi ek model pe 9 se zyada nahi** — koi galti se
  bekaar index jodega to yahin ruk jayega
- **cache ki hadd** — 2600 entry daal kar dekha jata hai ki 2000 pe ruk gaya

---

## Chalane ka tarika

```bash
unzip -o rakhrakhav-step-b4.zip -d rakhrakhav
cd rakhrakhav
bash setup.sh
```

Pehli baar chalane ke baad **ek baar `dbcheck --live` chala lijiye** — usse pata chal
jayega ki asli data me kahan sabse zyada jagah ja rahi hai.

> **Ek baat jo maine nahi ki:** purane database me jo 24 bekaar index pehle se bane
> pade hain, wo apne aap nahi hatenge — Mongoose sirf naye banata hai, purane hataata
> nahi. Atlas ke UI se ya `db.collection.dropIndex()` se hataane padenge. Naye deploy
> pe ye samasya hai hi nahi. Aapka data abhi chhota hai, isliye jaldi nahi — par jab
> data bada ho jaye tab ye kaam sach me paise bachata hai.

---

## Chaaron step poore

| Step | Kya |
|---|---|
| 1 | rakhrakhav.in · policy ke 6 page · `BILLING_MODE` switch · plan aur seat |
| 2 | Razorpay — checkout, webhook, renew, rasid |
| 3 | Phone pe notification (₹0) · OTP APITxT se |
| 4 | 1 lakh user — index, TTL, cache, rate limit, pool |

**Live jaane se pehle `.env` me:**
```
BILLING_MODE=paid
RAZORPAY_KEY_ID= / RAZORPAY_KEY_SECRET= / RAZORPAY_WEBHOOK_SECRET=
VAPID_PUBLIC_KEY= / VAPID_PRIVATE_KEY=        (npm run vapid --prefix server)
APITXT_API_KEY= / APITXT_URL= / SMS_SENDER_ID=
CLIENT_URL=https://rakhrakhav.in
PUBLIC_URL=https://rakhrakhav.in
COMPANY_ADDRESS= / COMPANY_LEGAL_NAME= / COMPANY_GSTIN= / SUPPORT_PHONE=
```

Aur do cheezein jo main nahi kar sakta, par karni zaroori hain:

1. **Policy ke kagaz CA/wakil se dikhwa lijiye** — khaas kar company ka poora naam,
   pata aur GSTIN wala hissa.
2. **APITxT ka exact URL** apne panel se `APITXT_URL` me daal dijiye — unke public
   docs me endpoint diya hi nahi hai, isliye maine andaze wala URL nahi thopa.
