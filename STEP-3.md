# Part 17 — Do darwaze · **Step 3 / 3**

> **Ek line me:** doosri dukaan ne bill banaya → aapke yahan "ye maal stock me
> daal lijiye" ka kaam apne aap ban gaya → ek ek item pe **"Add karke aage"**,
> bechne ka rate, aur maal aapke stock me.

Ye aakhri step hai. Ab poora chakkar ban gaya: **dhoondho → order karo → bill
lo → apne stock me daalo → bech do.**

---

## 1. Kya bana (Step 3)

| # | Cheez | Kahan |
|---|-------|-------|
| 1 | **Bill bante hi kaam apne aap ban jata hai** | `server/src/services/intake.service.js` |
| 2 | Uska record — bill ka poora snapshot | `server/src/models/StockIntake.js` |
| 3 | **"Maal aaya" wali khabar** (apni alag chhalni) | `NOTIFICATION_TYPES.STOCK_INTAKE` |
| 4 | **Ek ek item — "Add karke aage"** | `client/src/pages/wholesaler/intake/IntakeReview.jsx` |
| 5 | App khud batati hai "ye aapka kaunsa item hai" | `matchesForLine` |
| 6 | **Bechne ka rate** — lagat ke saath, +10/20/30% ek tap me | usi file me |
| 7 | Aakhri kadam → wahi purana **`createPurchase()`** | `finishIntake` |
| 8 | **Bechne wala apne aap supplier** ban jata hai | `findOrCreateSupplier` |
| 9 | Bill cancel ho to kaam bhi ruk jata hai | `cancelIntakeForInvoice` |
| 10 | Menu me apni jagah + badge | `navConfig.js`, `useIntakeBadge.js` |

---

## 2. Naye endpoints

Sab pe `purchases` wali ijazat — isse **godown incharge** ko ye kaam apne aap
mil jata hai.

| Method | Path | Kaam |
|---|---|---|
| GET | `/api/stock-intake` | Jo kaam baaki hain (`?status=PENDING/DONE/CANCELLED/all`) |
| GET | `/api/stock-intake/count` | Menu ke badge ke liye |
| GET | `/api/stock-intake/:id` | Ek bill ka poora kaam |
| GET | `/api/stock-intake/:id/lines/:index/matches` | "Ye mera kaunsa item hai" ke andaze |
| POST | `/api/stock-intake/:id/lines/:index` | **Add karke aage** (ya `{ skip: true }`) |
| DELETE | `/api/stock-intake/:id/lines/:index` | Peeche — faisla badalna |
| POST | `/api/stock-intake/:id/finish` | **Stock me daal dein** → purchase ban jati hai |

---

## 3. VS Code me chalayein

```bash
cd rakhrakhav
bash setup.sh
```

Sirf test:

```bash
npm run check      # bina database ke — 61 jaanch
npm run smoke      # asli database pe poora flow
```

---

## 4. Haath se kaise check karein

**Do account chahiye** — ek "bada wholesaler", ek "aapka wholesaler".

1. **Aapka wholesaler** → Profile → **Buyer** → **Dukaan** → bade wholesaler ka
   number → **Jud jayein**
2. Uska maal cart me daalein → **Order bhejein**
3. **Bada wholesaler** apne account me: Orders → us order ka **bill bana dein**
4. **Aapka wholesaler** → Profile → **Seller** → menu me **"Maal stock me"** pe
   badge dikhega (aur notification bhi aayi hogi)
5. Us kaam ko kholein. Har item pe teen cheezein:
   - **Bill me ye likha hai** — naam, ginti, rate, GST, aur **"Aapko pada"**
   - **Ye aapka kaunsa item hai?** — mil jaye to *Pakka yahi*, warna *Naya item banayein*
   - **Bechne ka rate** — likhein, ya **+10% / +20% / +30%** ek tap me.
     Neeche munafa dikhta hai; lagat se kam rate pe **laal warning**.
6. **Add karke aage** → agla item khud aa jata hai
7. Sab hone par **Stock me daal dein**

**Ab ye zaroor dekhein:**

- **Items** page → naya item bana hai, uska **stock badha hai**, lagat aur
  bechne ka rate dono lage hain
- **Kharid** page → ek nayi purchase bani hai, bill ke number ke saath
- **Suppliers** → bada wholesaler apne aap supplier ban gaya, uske khate me
  poora bill chadha hua
- **Reports → Fayda-Nuksan** → is maal ki lagat wahi hai jo bill pe thi

---

## 5. Teen faisle jo galat hote to mehngе padte

**1. "Add karke aage" se stock NAHI badhta.**
Sabse aasan rasta yahi hota ki wahin stock badha dete. Wo bura hota: stock ke
saath **khep (FIFO ki lagat), supplier ka khata, GST ka input credit aur
purchase ka number** — sab ek saath banne chahiye, aur wo poora hisaab pehle se
`purchase.service.js` me ek hi jagah likha hai. Isliye ye page sirf **faisle**
yaad rakhta hai; maal aakhri kadam pe chadhta hai, wahi purane `createPurchase()`
se. Faayda: return, GST report, Fayda-Nuksan aur FIFO — kisi me ek line badalni
nahi padi, aur is raste se aaya maal bilkul waise hi bartaav karta hai jaise
haath se ki hui kharid.

**2. Bina GST wale ka tax lagat me jud jata hai.**
Aapki dukaan GST me registered na ho to bill ka GST ek **asli kharch** hai — wo
kabhi wapas nahi milega. Use chhod dena do jhooth bolta: lagat kam dikhti (aur
munafa zyada), aur supplier ke khate me bill se kam raqam chadhti. Isliye us
halat me rate me tax jod kar chadhta hai — **jod bill se poora milta hai**.

**3. "Shayad" wale milaan pe apne aap tick nahi lagta.**
App sirf tab pehle se chun kar deti hai jab milaan **pakka** ho (poora naam).
"Shayad" pe apne aap tick laga dena sabse khatarnak hota: aadmi aadhi nazar se
**Add karke aage** daba deta, aur galat item me maal chadh jata — wo galti stock
aur lagat dono me ghus kar mahino baad pakdi jati.

Saath me: **ek bill ka ek hi kaam** (unique index), **dobara finish nahi hota**
(status pehle pakda jata hai), aur purchase banne me gadbad ho to kaam wapas
"baaki" ho jata hai — adhoora nahi chhootta.

---

## 6. Teeno step ek nazar me

| Step | Kya khula |
|---|---|
| **1** | Ek login, kai dukaan · Seller ⇄ Buyer · number se dukaan dhoondho aur judo |
| **2** | Dukaan ka apna page · Filter · har dukaan ka apna cart · ek confirm, alag alag order aur notification |
| **3** | Kharida hua maal apne stock me — "Add karke aage", bechne ka rate, aur poora purchase/GST/FIFO hisaab |
