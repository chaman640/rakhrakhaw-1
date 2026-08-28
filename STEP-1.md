# Part 17 — Do darwaze · **Step 1 / 3**

> **Ek line me:** ek retailer ab ek hi wholesaler se bandha nahi hai, aur ek
> wholesaler apne Profile se "Buyer" chun kar doosri dukaan se maal mangwa
> sakta hai — bina naya account banaye.

Ye teen step ka pehla step hai. Poora chalta-phirta hai, aap ise abhi chala kar
dekh sakte hain.

---

## 1. Kya-kya ban gaya (Step 1)

| # | Cheez | Kahan |
|---|-------|-------|
| 1 | **Ek login, kai dukaan** — naya `Membership` rishta | `server/src/models/Membership.js` |
| 2 | **Har request pe "kaunsi dukaan"** — `X-Shop-Id` header | `server/src/middleware/tenant.js` |
| 3 | **Wholesaler bhi khareed sakta hai** — `requireBuyer` | `server/src/middleware/auth.js` |
| 4 | **Godown incharge ko kharidne ka haq** | `permissions.js` (pehle se `purchases:create` tha) |
| 5 | **Number se dukaan dhoondho / judo / save karo** | `server/src/services/shop.service.js`, `/api/shops` |
| 6 | **Profile pe Seller ⇄ Buyer toggle** | `client/src/components/layout/ModeSwitch.jsx` |
| 7 | **"Dukaan" naam ka naya page** (search + saved list) | `client/src/pages/buy/ShopSearch.jsx` |
| 8 | **Buy mode ka apna menu** — Catalog ki jagah Dukaan | `client/src/components/layout/navConfig.js` |
| 9 | **Purane retailer apne aap naye system me** | `server/src/config/backfill.js` |

Saath me ek purana bug bhi theek hua: `PartyFormModal` me `hint` do baar likha
tha, isliye phone wala ishara supplier ke liye aur edit karte waqt gayab rehta
tha.

---

## 2. VS Code me kaise chalayein

```bash
# 1. Zip khol kar folder me jayein
cd rakhrakhav

# 2. Sab install (client + server dono)
npm run install:all

# 3. Server ka .env banayein (pehli baar hi)
cp server/.env.example server/.env
#    server/.env me MONGO_URI aur JWT_SECRET bhar dein

# 4. Do terminal me:
npm run dev:server      # terminal 1  → http://localhost:5000
npm run dev:client      # terminal 2  → http://localhost:5173
```

**Ek hi URL pe (jaise Render pe chalta hai) dekhna ho:**

```bash
npm run preview         # build + start, sab http://localhost:5000 pe
```

### Test chalane ke liye

```bash
npm run check           # bina database ke — 38 jaanch, 10 second
npm run smoke           # asli database pe poora flow (MONGO_URI chahiye)
```

`npm run check` kuch nahi maangta — na database, na internet.
`npm run smoke` aapke `MONGO_URI` pe chalta hai aur apna banaya hua test data
khud delete kar deta hai (sab kuch `90000000xx` numbers pe hota hai, aapke asli
data ko haath nahi lagta).

---

## 3. Haath se kya-kya check karein

**A. Wholesaler ka Buy mode**

1. Wholesaler se login karein → **Profile** kholein
2. Sabse upar naya dabba: **Seller / Buyer** → **Buyer** dabayein
3. Screen badal jayegi — neeche wali patti me ab *Home · Dukaan · Cart · My Orders*
4. **Dukaan** page pe doosre wholesaler ka **10 digit number** daalein → **Dhundhein**
5. Uski dukaan dikhegi (naam, logo, kitne item, kitni category) → **Jud jayein**
6. Wo dukaan approve karte hi uska poora maal Catalog me dikhne lagega
7. Upar patti me uski dukaan ka naam aur **Buy** ka nishaan dikhega
8. Profile → **Seller** dabate hi sab kuch pehle jaisa

**B. Purana kuch toota to nahi (ye zaroor dekhein)**

- Purana retailer login kare → uski dukaan pehle jaisi hi khulti hai
- Uske order, bill, khata, return — sab waise ke waise
- Wholesaler Seller mode me — dashboard, bill, stock, GST sab pehle jaisa
- Salesman login kare → use Buyer wala button dikhna hi **nahi** chahiye

**C. Retailer bhi ab do dukaan se**

- Retailer login kare → **Dukaan** page → doosre wholesaler ka number daale → jud jaye
- Ab uske paas do dukaanein hain; jis pe tap kare usi ka maal aur khata khulta hai

---

## 4. Design ke do bade faisle (kyun aise banaya)

**1. Kharidne wala us dukaan ke andar ek `Party` banta hai.**
Har dukaan ke apne rate, apna khata, apna GST aur apna stock pehle se
`(businessId, partyId)` ke jode pe chalte hain. Kharidaar ko us dukaan ke andar
Party bana kar jodne se ledger, bill, return, FIFO aur GST ka **ek bhi niyam
badalna nahi pada**. Isi wajah se ye update itna chhota reh gaya.

**2. Dukaan ka naam header me jata hai, har API call me nahi.**
Poore app me sau se zyada jagah `api.get(...)` likha hai. Har jagah ek naya
parameter jodna sau badlaav hota, aur jo ek jagah chhoot jati wo chup-chaap
**galat dukaan ka data** dikhati — sabse khatarnak wali galti, kyunki dikhne me
sab theek lagta hai. Ek jagah header laga dene se wo khatra hai hi nahi.

Header **sirf Buy mode me** jata hai. Seller mode me wo band rehta hai, warna
apna dashboard doosri dukaan ka jawab dikhane lagta.

---

## 5. Aage kya (Step 2 aur 3)

**Step 2 — Instagram wali window aur alag-alag dukaan ka cart**
- Search ke baad dukaan ka page — uska maal, category ki ginti, Save ka button
- Category/naam wali khoj ek **Filter** button ke andar (screen khali rahe)
- **Cart me har dukaan ka apna dabba** — upar dukaan ka naam aur logo, neeche
  uska maal aur uska jod; sabse aakhir me **kul jod**
- Ek baar confirm karne pe har dukaan ko apna alag order aur apna alag notification

**Step 3 — Khareeda hua maal apni inventory me**
- Payment ke baad "ab is maal ko apne stock me daal lijiye" wala msg
- Ek ek item — **"Add karke aage"**, har item pe apna **bechne ka rate**
- Purchase, GST, return aur FIFO ka poora hisaab bina kisi bug ke
