# Step 2 — Razorpay

`.env` me key daali, aur paisa lena chalu. Bas itna:

```
BILLING_MODE=paid
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx
```

**Razorpay Dashboard → Settings → Webhooks** me ek webhook banayein:

| | |
|---|---|
| URL | `https://rakhrakhav.in/api/billing/webhook` |
| Events | `payment.captured`, `payment.failed`, `order.paid` |
| Secret | wahi jo `RAZORPAY_WEBHOOK_SECRET` me daala |

---

## Kya bana

**Checkout** — plan chunein, mahine chunein (1/3/6/12), Razorpay ka page khulta hai.
Paisa dete hi plan chalu. Settings → **Plan** me poora hisaab: kaunsa plan, kitne
account bache, mohlat kab tak, aur payment ka record.

**Rakam server pe tay hoti hai.** Client se aayi rakam kabhi nahi maani jati — warna
koi browser me ₹2000 ko ₹1 bana kar bhej deta.

**Razorpay ka naam sirf ek file me hai** (`razorpay.service.js`). Baaki poora billing
provider ke baare me kuch nahi jaanta — kal koi doosra gateway lena ho to sirf wo ek
file badlegi.

---

## Teen jagah jahan aise system aksar tootte hain

**1 · Ek payment do baar chalu na ho jaye.**
Paisa chukne ki khabar **do raste** se aati hai — browser se, aur Razorpay ke webhook
se — aur dono aksar ek saath aate hain. Isliye order ka `status: 'created'` seedha
`findOneAndUpdate` ke **filter** me hai: MongoDB do me se ek hi request ko doc deta hai,
doosri ko `null` milta hai aur wo chup-chaap "pehle se ho chuka" maan leti hai.

**2 · Webhook ka RAW body.**
Signature poore raw bytes pe banta hai. Ek baar `express.json()` ne padh liya to wo
bytes wapas nahi milte — `JSON.stringify` se dobara banaya hua text kabhi bilkul wahi
nahi hota (space, key ka kram, sab badal jata hai) — aur HMAC kabhi match nahi karega.
Isliye **sirf us ek raste pe** raw parser, aur wo `express.json()` se **pehle**.

**3 · Browser bharosemand nahi hai.**
Net kat sakta hai, tab band ho sakta hai, aadmi wapas aa hi na. Isliye plan chalu karne
ka **asli zimma webhook ka** hai; browser wala rasta sirf turant dikhane ke liye hai.
Agar paisa kat gaya par verify fail ho — aadmi ko *"payment fail"* nahi dikhta, balki
*"paisa mil gaya hai, ek minute me page dobara kholein"*. Webhook wahi kaam khud kar
deta hai.

---

## Do rok jo maine jaan-boojh kar lagayi

**Paid mode bina key ke chalta hi nahi.** Server shuru hote hi saaf error deta hai aur
batata hai kaunsi setting nahi mili. Chup-chaap chalne dena sabse mehnga hota: plan ka
page khulta, checkout par kuch na hota, aur pata us din chalta jis din pehla graahak
paisa dene aata.

**Ek baar me 12 mahine se zyada nahi.** Ek galti se saal bhar ka paisa kat jana bahut
mehnga hai.

---

## Raaste me apna hi ek bug pakda

`express.raw({ type: '*/*' })` — us glob ke beech ke do akshar (`*` ke baad `/`)
comment padhne wale auzaar ko lagta hai ki wahan comment khul raha hai, aur wo aage ka
poora code kha jata hai. Mera apna check isi wajah se `express.json(` dhoondh nahi paya.

App to theek chal rahi thi, par har wo auzaar jo code padhta hai (check, lint, koi bhi)
us file ko aage se galat padhta. `type: () => true` kar diya — wahi kaam, aur wo jaal
hi hat gaya.

---

## Test

```
192 selfcheck pass    (Step 1 ke baad 179 the — 13 naye)
i18n 100% (app ke shabd)
free aur paid+keys — dono mode me server boot verify
```

Signature ki jaanch alag se rakhi hai, kyunki yahi wo ek cheez hai jiske toote bina
koi nakli payment andar aa sakta hai:

- sahi saboot manzoor, galat reject
- **ek order ka saboot doosre order pe nahi chalta** — warna koi apne ₹50 wale payment
  ka saboot ₹2000 wale plan pe chipka deta
- webhook ki body ek byte badalte hi saboot toot jata hai

---

## Chalane ka tarika

```bash
unzip -o rakhrakhav-step-b2.zip -d rakhrakhav
cd rakhrakhav
bash setup.sh
```

`.env` me kuch bharna zaroori nahi — `free` pe sab aaj jaisa chalta hai. Razorpay ki
key jab mil jaye tab upar wali char line daal dijiye.

---

## Aage

**Step 3** — OTP APITxT se, aur phone pe notification (jaise YouTube ki aati hai) —
order, payment, stock, sab ka.
**Step 4** — 1 lakh user: index, query ka budget, cache, rate limit, database ka bill.
