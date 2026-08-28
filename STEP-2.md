# Part 17 — Do darwaze · **Step 2 / 3**

> **Ek line me:** dukaan ka apna page (Instagram jaisa), filter ek button ke
> andar, cart me har dukaan ka apna dabba, aur ek confirm pe har dukaan ko uska
> apna order + apni alag khabar.

Step 1 ne lock toda tha. Step 2 use rozana chalane layak banata hai.

---

## 1. Kya-kya bana (Step 2)

| # | Cheez | Kahan |
|---|-------|-------|
| 1 | **Dukaan ka apna page** — logo, naam, kitne item, kitni category, Save | `client/src/pages/buy/ShopPage.jsx` |
| 2 | **Filter ek button ke andar** — naam, category, stock, kram | usi file me `FilterSheet` |
| 3 | **Cart me har dukaan ka apna dabba** — uska naam, logo, maal aur uska jod | `client/src/pages/retailer/Cart.jsx` |
| 4 | **Kul jod** sabse aakhir me, har dukaan ka hissa dikhate hue | usi file me |
| 5 | **Paise ka irada aur note — har dukaan ka apna** | usi file me |
| 6 | **Ek confirm, har dukaan ka apna order** | `server/src/services/buy.service.js` |
| 7 | **Alag alag notification** — har wholesaler ko apni khabar | apne aap (`placeOrder`) |
| 8 | **Ek fail ho to baaki na ruke** | `checkoutMany` |
| 9 | **Badge ab poore cart ka** — sab dukaanon ki ginti | `client/src/context/CartContext.jsx` |
| 10 | **Dukaan badalne ki patti** — My Orders / Bills / Khata ke upar | `client/src/components/buy/ShopStrip.jsx` |
| 11 | **Khabar pe tap → sahi dukaan me** | `ShopContext.enterShopForLink` |

---

## 2. Naye endpoints

| Method | Path | Kaam |
|---|---|---|
| GET | `/api/buy/cart` | Sab dukaanon ka cart — har ek ka apna jod, aur kul jod |
| GET | `/api/buy/cart/count` | Badge ke liye — kitne item, kitni dukaan |
| POST | `/api/buy/checkout` | `{ orders: [{ shopId, paymentMode, note }] }` → har dukaan ka apna order |

`/api/catalog/shop` ab poora card deta hai (item ginti, category ginti, save ka
haal, baaki rakam) — shop page ka header isi se banta hai.

---

## 3. VS Code me chalayein

```bash
cd rakhrakhav
bash setup.sh          # wahi purana tarika — install, .env, MongoDB test, smoke, aur app chalu
```

Sirf test chalane hon:

```bash
npm run check          # bina database ke — 49 jaanch, 10 second
npm run smoke          # asli database pe poora flow (aapka MONGO_URI)
```

---

## 4. Haath se kya check karein

**A. Dukaan ka page**

1. **Dukaan** page pe kisi dukaan pe tap karein
2. Upar uska logo (gol), naam, number, aur do ginti — **kitne item, kitni category**
3. **Save** ka button (bookmark) — dabate hi wo dukaan search wali list me pehle aa jayegi
4. **Filter** dabayein → naam se khoj, category, stock, kram — sab ek hi jagah
5. Filter lagate hi button pe ginti dikhegi: **Filter (2)**

**B. Cart — har dukaan ka apna dabba**

1. Ek dukaan se do item cart me daalein
2. **Dukaan badlein** → doosri dukaan se bhi ek item daalein
3. **Cart** kholein — do alag dabbe:
   - upar dukaan ka naam + logo, uske saamne **us dukaan ka jod**
   - andar sirf usi dukaan ka maal, quantity wahin ghatti-badhti hai
   - neeche **Paisa kaise denge** (Udhaar / Cash / UPI) — har dukaan ka apna
   - **Note likhein** — bhi har dukaan ka apna
4. Sabse neeche (desktop pe daayein) **Kul jod** — har dukaan ka hissa, phir kul

**C. Ek confirm, do order**

1. **Order bhejein** dabayein
2. Screen batayegi: kis dukaan ko kaunsa order number gaya
3. Dono wholesaler apne apne account me dekhein — **dono ke paas apna alag order**
4. Dono ko **apni alag notification** mili hogi
5. Har order pe wahi payment mode aur wahi note jo us dukaan ke dabbe me chuna tha

**D. Purana kuch toota to nahi**

- Purana retailer (ek hi dukaan wala) — uska cart, order, bill, khata sab pehle jaisa
- Ek hi dukaan judi ho to cart me **ek hi dabba** dikhega, patti dikhegi hi nahi
- Wholesaler Seller mode me — dashboard, bill, stock, GST sab waise ke waise

---

## 5. Do faisle jinki wajah likh dena zaroori hai

**1. Ek bada order nahi banaya — har dukaan ka apna.**
Ek order me teen dukaanon ka maal daal dena aasan dikhta hai, par usse stock,
rate, GST, khata aur notification — sab ek saath toot jate. Har dukaan ka apna
order banane se bechne wale ko **bilkul wahi** dikhta hai jo pehle dikhta tha;
use pata bhi nahi chalta ki kharidaar ne ek saath teen jagah bheja tha. Isi se
"alag alag notification" wali baat apne aap poori ho gayi — kuch alag se karna
hi nahi pada.

**2. Ek dukaan fail ho to baaki nahi rukte.**
Teen dukaanon ka maal chuna, teesri ka ek item beech me khatam ho gaya — poora
checkout fail kar dena sabse bura hota: aadmi ko lagta kuch gaya hi nahi, wo
dobara dabata, aur pehli do dukaanon me **do-do order** chale jate. Ab jiska
order ban gaya uska cart khali, jiska nahi bana uska maal cart me jaisa ka
waisa — aur screen saaf saaf batati hai ki kiska gaya, kiska nahi aur kyun.

---

## 6. Step 3 me kya aayega

- Payment ke baad **"ab is maal ko apne stock me daal lijiye"** wala msg
- Ek ek item — **"Add karke aage"**, har item pe apna **bechne ka rate**
- Wahi purana `createPurchase()` rasta — stock, FIFO lot, supplier khata, GST
- Return, purchase aur GST ka poora hisaab dobara jaanch kar
