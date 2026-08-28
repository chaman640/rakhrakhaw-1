# Rakh Rakhav — Wholesaler + Retailer Platform

Wholesaler apna stock, order, invoice aur khata manage kare; uske retailers apne phone se
seedha order karein. Vyapar + Thokmarket ka hybrid.

**Stack:** React (Vite) + Express + MongoDB + Node — JavaScript, ESM.

---

## Ab tak kya bana

### OTP — signup aur password reset · [poori detail: OTP.md](OTP.md)
- [x] **Signup pe OTP** — wholesaler aur retailer dono; pehle form, phir OTP
- [x] **Password bhool gaye** — Login pe naya link: number → OTP → naya password
- [x] SMS **Fast2SMS** se; key khali ho to dev me OTP log aur screen pe (live pe kabhi nahi)
- [x] Code **hash me**, verify hote hi **mit** jata hai, aur token me number bhi likha hai
- [x] Rok: 60 second, ghante me 5 SMS, 5 galat koshish, 10 minute ki mohlat
- [x] `npm run check` — **83 jaanch**


### Poora system check · [poori detail: AUDIT.md](AUDIT.md)
- [x] **Bill ke neeche wala discount** ab kharidne wale ki purchase me bhi jata hai (pehle chup-chaap gir jata tha)
- [x] Invoice ka tax teen khaanon se jod kar liya jata hai (`taxTotal` naam ka khaana hai hi nahi)
- [x] **Save hatane se dukaan se bahar nahi phenkta** — judna aur save karna ab do alag baatein
- [x] Cart ki chetavni ab dabbe me, toast me nahi (har 20 second dobara nahi aati)
- [x] `npm run check` — **83 jaanch**, bina database ke


### Part 17 — Do darwaze (Step 3/3) · [poori detail: STEP-3.md](STEP-3.md)
- [x] **Bill bante hi kaam apne aap ban jata hai** — kharidne wale ke yahan, poora bhara hua
- [x] **"Maal aaya" wali khabar** apni alag chhalni ke saath, aur menu me badge
- [x] **Ek ek item — "Add karke aage"** · app khud batati hai "ye aapka kaunsa item hai"
- [x] **Bechne ka rate** — lagat saamne, +10/20/30% ek tap me, munafa live, lagat se kam pe warning
- [x] **Stock yahan se NAHI badhta** — aakhri kadam pe wahi purana `createPurchase()`
- [x] Isliye stock, **khep (FIFO), supplier ka khata, GST ka input credit** — sab pehle jaise
- [x] Bina GST wale ke liye bill ka tax **lagat me jud jata hai** (jod bill se poora milta hai)
- [x] **Bechne wala apne aap supplier** ban jata hai, khate ke saath
- [x] Bill cancel ho to kaam bhi ruk jata hai; ho chuka ho to sirf khabar (apne aap ulta nahi)
- [x] Ek bill ka **ek hi kaam**, aur dobara finish nahi hota

### Part 17 — Do darwaze (Step 2/3) · [poori detail: STEP-2.md](STEP-2.md)
- [x] **Dukaan ka apna page** — logo, naam, kitne item, kitni category, aur Save ka button (follow jaisa)
- [x] **Filter ek button ke andar** — naam, category, stock, kram; button pe hi ginti dikhti hai
- [x] **Cart me har dukaan ka apna dabba** — uska naam, logo, maal aur uska apna jod; aakhir me kul jod
- [x] **Paise ka irada aur note — har dukaan ka apna** (ek se udhaar, doosre ko nakad)
- [x] **Ek confirm, har dukaan ka apna order** — apne number ke saath, us dukaan ke apne business me
- [x] **Alag alag notification** — har wholesaler ko uski apni khabar (apne aap, `placeOrder` se)
- [x] **Ek dukaan fail ho to baaki na ruke** — jiska gaya uska cart khali, baaki ka maal jaisa ka waisa
- [x] Badge ab poore cart ka — sab dukaanon ki ginti
- [x] **Dukaan badalne ki patti** — My Orders / Mere Bills / My Khata ke upar
- [x] Khabar pe tap → pehle sahi dukaan me, phir wo page

### Part 17 — Do darwaze (Step 1/3) · [poori detail: STEP-1.md](STEP-1.md)
- [x] **Ek login, kai dukaan** — naya `Membership` rishta; "ek retailer ek hi wholesaler" wala lock toota
- [x] Kharidaar us dukaan ke andar ek **Party** banta hai — isliye khata, GST, return aur FIFO ka ek bhi niyam nahi badla
- [x] **`X-Shop-Id` header** se har request pe tay hota hai ki kis dukaan ke andar hain (`withBuyerTenant`)
- [x] Header **sirf Buy mode me** jata hai — Seller mode bilkul pehle jaisa
- [x] **Wholesaler bhi khareed sakta hai** — buy-side routes pe `requireRole(RETAILER)` ki jagah `requireBuyer`
- [x] **Godown incharge ko kharidne ka haq** (uske role me `purchases:create` pehle se tha)
- [x] **Number se dukaan dhoondho, judo, save karo** — `/api/shops` (poora 10 ank; aadha number nahi chalta)
- [x] Profile pe **Seller ⇄ Buyer** toggle; buy mode ka apna menu (Catalog ki jagah "Dukaan")
- [x] Purane retailer apne aap naye system me — startup ka backfill
- [x] `npm run selfcheck` — 68 jaanch, **bina database ke**


### Part 1 — Foundation
- [x] Folder structure (client + server alag)
- [x] **Saara database schema — 14 models ek saath**
- [x] Env config + validation
- [x] Auth / tenant / validation / error middleware
- [x] Base UI layout — sidebar, header, responsive shell
- [x] 13 reusable components

### Part 11 — Return, Staff aur Backup
- [x] **Item me naye field** — brand, model/serial number, barcode, MRP, rack (godown me jagah)
- [x] **Warranty** — kitne mahine + shart, dropdown se (6 mahine / 1 saal / 2 saal...)
- [x] Warranty **retailer ko bhi dikhti hai** — catalog card pe badge, bill pe har line ke neeche
- [x] Warranty ka **snapshot bill pe** — baad me item ki warranty badle to purana bill nahi badalta
- [x] **Kam se kam order** — retailer isse kam nahi mangwa sakta (cart me hi ruk jata hai)
- [x] Brand, model ya barcode se search; brand ka filter
- [x] **Sale return = Credit Note** — stock wapas badhta hai, retailer ka udhaar ghatta hai
- [x] **Purchase return = Debit Note** — stock ghatta hai, supplier ko dena ghatta hai
- [x] Bill/purchase se **ek click me return** — qty pehle se bhari, "pehle kitna wapas ho chuka" bhi
- [x] Bill se zyada wapas nahi ho sakta; stock se zyada wapas bhej nahi sakte
- [x] Chhapne layak credit/debit note — GST, amount in words, karan, signature
- [x] Delete = poora reversal (stock + khata dono)
- [x] **Staff login** — Manager / Salesman / Munshi, har ek ka apna phone + password
- [x] **9 permission** — role chunte hi theek set ho jate hain, chahein to badal lein
- [x] Staff ko sirf uske kaam ka menu, page aur **dashboard ka data** dikhta hai
- [x] Owner hi staff bana/hata/block kar sakta hai; koi doosra malik nahi ban sakta
- [x] Har koi apna password khud badal sakta hai (purana password poochh kar)
- [x] **Poora data backup** — ek JSON file, password uske andar kabhi nahi jata
- [x] 6 alag CSV (parties, bills, khata, payments, purchases, returns) — Excel/CA ke liye

### Part 10 — Dashboard, Reports & Notifications
- [x] **Dashboard** — dukaan kholte hi aaj ki sale, paisa aaya, udhaar, stock — ek nazar me
- [x] "Aaj ye dekh lijiye" — naye order, pending payment, approve karne wale retailer, kam stock
- [x] **14 din ka sale chart** — koi chart library nahi, "Number me dekhein" se poori table
- [x] Kal se kitna upar-neeche (%), sabse zyada bike item, top retailers, recent activity
- [x] **6 reports** — Sale, Purchase, Stock, Udhaar (aging), GST, Payment
- [x] Sale/Purchase — din, item, retailer/supplier ke hisaab se; item wise pe **munafe ka andaza**
- [x] Stock — keemat, kam bacha, khatam, **60 din se pada hua** maal
- [x] Udhaar — **0-30 / 31-60 / 61-90 / 90+ din** ke bucket, sabse purana kitne din ka
- [x] GST — B2B/B2C batwara, HSN wise, output − input = **sarkar ko kitna dena hai**
- [x] Payment — din wise Cash / UPI / Bank / Cheque
- [x] **Har report ki CSV** — Excel me kholne layak, aakhri line me KUL
- [x] Date range + "Aaj / Is mahine / 30 din" ke shortcut, print bhi
- [x] **Low stock ka apne aap alert** — threshold PAAR karne pe, har bill pe nahi
- [x] **"Yaad dilayein"** — retailer ko udhaar ka alert, apna message bhi bhej sakte hain
- [x] **Notifications page** — type filter, Aaj/Kal grouping, sab padh liya, purani hatayein
- [x] Retailer ka apna **Home** — udhaar, chalu order, baaki bill, pichhle order

### Part 9 — Khata & Payments
- [x] **Khata page** — kisse kitna lena hai, kisko kitna dena hai, ek jagah
- [x] Summary cards — receivable, payable, net, credit limit paar karne wale
- [x] "Sabse zyada udhaar" — top 5, ek click me unka khata
- [x] Retailer / supplier / dono, "baaki hai / clear / sab", naam-phone se search
- [x] **Party ka poora khata** — running balance ke saath, date range filter, print
- [x] Har entry Hinglish me: Bill / Maal aaya / Paisa aaya / Paisa diya / Purana hisaab
- [x] Bill aur purchase ke number pe click → seedha wo document khulta hai
- [x] **Paisa entry** — Cash / UPI / Bank / Cheque, IN (retailer se) ya OUT (supplier ko)
- [x] **FIFO allocation** — paisa apne aap sabse purane bill pe lagta hai, bacha to advance
- [x] "Poora" / "Aadha" ke shortcut button — hisaab lagane ki zarurat nahi
- [x] **Retailer ka apna khata** — kitna dena hai, kaunse bill baaki hain, maine kya bheja
- [x] **UPI se paisa bhejna** — QR code + "UPI app kholein" (GPay/PhonePe/Paytm deep link)
- [x] Retailer "bhej diya" dabaye → **pending**, khate me kuch nahi jata
- [x] Wholesaler ke Payments page pe **confirm queue** — "Mil gaya" / "Nahi mila"
- [x] Confirm hote hi khata update + retailer ko notification; reject pe wajah bhi jati hai
- [x] Settings me apni UPI ID (`naam@bank` validate hoti hai)
- [x] **Delete = poora reversal** — allocation khulti hai, khata ulta, bill dobara udhaar

### Part 8 — Invoice & GST Billing
- [x] **Order se ek click bill** — items, rate, retailer sab apne aap bhar jate hain
- [x] Bina order ke bhi seedha bill banao
- [x] **GST ka poora hisaab** — same state pe CGST+SGST, dusre state pe IGST, apne aap tay
- [x] GST off ho to **Bill of Supply**, koi tax column nahi
- [x] Bill-level extra discount — saare items pe barabar bat kar GST sahi rakhta hai
- [x] Round off, **amount in words** (Indian: lakh/crore), **HSN wise summary**
- [x] Invoice number — business ka apna series, FY-wise reset
- [x] **Yahin stock ghatta hai** — pehle check, phir har item ka SALE movement
- [x] **Yahin khata banta hai** — udhaar chadhta hai, turant paisa mila to payment bhi
- [x] Business aur party ka **snapshot** — 6 mahine baad address badla to purana bill na badle
- [x] Asli bill ka layout — logo, dono address, GSTIN, tax table, T&C, signature
- [x] **Print → A4 PDF** — sidebar/buttons gayab, sirf bill chhapta hai
- [x] WhatsApp pe bill ka summary bhejein
- [x] **Cancel = poora reversal** — stock wapas, khata ulta, number record me rehta hai
- [x] Retailer apne bills dekhe aur print kare

### Part 7 — Order Management (wholesaler)
- [x] **Order dashboard** — stats (naye / chalu / aaj ke / de diye), status chips with counts
- [x] Search (order number ya retailer), retailer filter, date range
- [x] **Order detail me har item ka ABHI ka stock** — laal me dikhta hai kis cheez ki kami hai
- [x] Status flow — Naya → Pack ho raha → Tayyar → De diya, sirf allowed transition
- [x] **Quantity badalna** — "Bearing sirf 2 hai" — 0 karo to line hat jati hai, total dobara banta hai
- [x] Cancel with reason (delivered ke baad nahi)
- [x] Retailer `PLACED` ke baad khud cancel nahi kar sakta
- [x] **Notifications** — naya order aane par wholesaler ko, har status change par retailer ko
- [x] Header me bell — unread badge, dropdown, "sab padh liya", click karke seedha order
- [x] Sidebar me naye orders ka badge
- [x] Retailer detail me "Orders" tab

### Part 6 — Retailer Catalog & Cart
- [x] **Locked catalog** — retailer ko sirf apne wholesaler ka, sirf `visibleToRetailers` items
- [x] Rate hamesha `rate.service` se — khaas rate ho to "Aapka rate" badge ke saath turant dikhta hai
- [x] Purchase price, margin, dusre retailer ka rate — kuch bhi leak nahi hota
- [x] Search, category filter, "jo available hai", 4 sort, pagination
- [x] Mobile-first grid — 2 column phone pe, 4 desktop pe. Khatam item pe "Abhi khatam"
- [x] **Server-side cart** — phone pe daalo, laptop pe khulega
- [x] Cart har baar dobara price hota hai — wholesaler rate badle to cart me turant naya rate
- [x] Stock kam ho to warning, khatam ho to cart me hi nahi jata
- [x] Order place — number, item snapshot, `availableAtOrder`, cart apne aap khali
- [x] **Order pe stock nahi ghatta** — wo invoice pe ghatega (Part 8)
- [x] My Orders — summary, status filter, status flow ka progress bar, "kya kya hua" timeline
- [x] Retailer apna `PLACED` order khud cancel kar sakta hai
- [x] Sidebar me cart ka count badge

### Part 5 — Purchase Entry
- [x] **Purchase form** — supplier + bill number + tareekh, kitni bhi item rows
- [x] Searchable item picker (`Combobox`) — stock aur rate saath me dikhta hai
- [x] Item chunte hi uska purchase price apne aap bhar jata hai
- [x] Live totals — kul maal, discount, GST (agar on ho), round off, kul dena
- [x] "Abhi kitna diya" → baaki turant dikhta hai
- [x] **Stock apne aap badhta hai** — har item ka apna StockMovement, purchase se juda hua
- [x] **Supplier ka khata apne aap banta hai** — maal ki entry + diye hue paise ki entry
- [x] Item ka purchase price naye rate se update (toggle se band bhi kar sakte ho)
- [x] Purchase list — stats, search, supplier filter, payment status chips, date range
- [x] Purchase detail — items, hisaab, **stock pe asar**, print
- [x] **Delete = poora reversal** — stock wapas ghatega, khata bhi ulta. Maal bik chuka ho to delete block.
- [x] Supplier detail me "Purchases" tab
- [x] `ledger.service.js` — khate ka ek hi darwaza (Part 9 bhi yahi use karega)

### Part 4 — Party Management
- [x] **Retailers page** — list, stats, search, status chips, approve/block (Settings se nikal kar apna page)
- [x] **Suppliers page** — wahi UI, alag data (Part 5 ki purchase entry ke liye tayyar)
- [x] Party detail page — header, stats, tabs (Detail / Rate / Khata / Orders)
- [x] Manual add — jo retailer khud link se nahi juda, use haath se add karo (usi phone se register karega to entry apne aap jud jayegi)
- [x] Purana hisaab (opening balance) → seedha khata me pehli entry
- [x] Credit limit, GSTIN (checksum validate), address + auto state code, note
- [x] **Party-wise item rate** — har item ke saamne inline rate, effective rate + source badge, live fayda
- [x] **Bulk rate tool** — "wholesale se 10% kam", "purchase pe 20% jyada", category-wise, rounding (0.5 / 1 / 5 / 10)
- [x] `rate.service.js` — rate resolution chain ek jagah (Part 6 aur 8 yahi use karenge)
- [x] Delete guard — order / bill / payment / kharid / **return** wali party delete nahi, sirf block (aur message me batata hai ki kya kya mila)

### Part 3 — Items / Inventory
- [x] Item CRUD — 3 price (purchase / sale / wholesale), unit, SKU, photo, description
- [x] **Live margin** — form me hi dikhta hai kitna fayda hai
- [x] Categories — banao, naam badlo, hatao (items delete nahi hote, "bina category" ho jate hain)
- [x] **Stock movement audit trail** — har badlav ka record, `balanceAfter` ke saath
- [x] Stock adjust — Aaya / Gaya / Ginti karke set, reason ke saath, history ke saath
- [x] Stock se zyada nikalna atomically block (do order ek saath aayein tab bhi minus nahi)
- [x] Search (naam/SKU/HSN), category filter, low-stock aur khatam ke chips, 6 sort, pagination
- [x] Stats — kul items, stock ki keemat, low stock, khatam
- [x] Bulk — dikhao / chhupao / category badlo / delete
- [x] **CSV import** — sample file, preview with per-row errors, nayi categories auto, phir commit
- [x] CSV export
- [x] GST fields (HSN, rate) sirf tab jab `gstEnabled` on ho
- [x] Mobile pe cards, desktop pe table

### Part 2 — Auth aur Business Profile
- [x] Wholesaler signup (phone + password) — User + Business ek saath
- [x] Login dono roles ke liye, JWT session, role-based route guard
- [x] **Retailer invite link** — ek hi link, WhatsApp share, kabhi bhi naya banao
- [x] Retailer signup invite link se → `pending` → wholesaler approve kare tab catalog khule
- [x] Approve / block, blocked retailer ka login hi band
- [x] Business profile — naam, address, state (GST code auto), phone, email
- [x] **GST optional** — toggle, official GSTIN checksum, state match check
- [x] Logo upload (Cloudinary ya local disk — jo configured ho)
- [x] Password change, profile edit, logout
- [x] Smoke test — `npm run smoke`

---

## Live karna (Render) — ek hi URL pe

Client aur server **ek hi service** me chalte hain, do alag nahi:

```
https://aapka-app.onrender.com          -> React app
https://aapka-app.onrender.com/api/...  -> API (usi URL pe)
```

Kaise: `npm run build` client ko `client/dist` me bana deta hai, aur Express usi ko serve karta
hai — `/api` API pe jata hai, `/uploads` images pe, aur **baaki har route index.html pe**
(React Router isi se chalta hai, refresh karne pe 404 nahi aata).

Client `VITE_API_URL` set na ho to **relative `/api`** use karta hai — isliye jis URL pe app khula
hai, API usi pe jayegi. Koi CORS nahi, koi URL kahin likhne ki zarurat nahi.

**`CLIENT_URL` set karne ki zarurat nahi.** App pehli request se hi khud pata laga leta hai ki wo
kis URL pe chal raha hai (`X-Forwarded-Proto` + `Host`, `trust proxy` ke saath) — invite link aur
upload ki image ka link usi se banta hai. Ek baar pata chalne ke baad koi request use badal nahi
sakti.

**Poora step-by-step: [`DEPLOY.md`](./DEPLOY.md)** — Atlas, GitHub, Render, Cloudinary sab.

```bash
npm run build     # dono install + client ka build
npm start         # ek hi URL pe sab
npm run preview   # dono ek saath (local pe wahi jo Render pe hoga)
```


---

## Chalane ka tarika

**Zaroori:** Node 18+, MongoDB (local ya Atlas)

Sabse aasan — root me:

```bash
./setup.sh
```

Ya haath se:

```bash
# 1. Server
cd server
npm install
cp .env.example .env        # MONGO_URI aur JWT_SECRET bhar dena
npm run dev                 # http://localhost:5000

# 2. Client (naya terminal)
cd client
npm install
cp .env.example .env
npm run dev                 # http://localhost:5173
```

Dono ek saath: `./start.sh`

### Sab sahi chal raha hai?

```bash
cd server && npm run smoke
```

Ye aapke apne database pe poora flow chala kar dikhata hai — signup, login, GST validation,
invite link, retailer join, approve, block, password change — aur apna banaya test data
khud delete kar deta hai.

---

## Pehli baar kya karein

1. `http://localhost:5173/signup` — wholesaler account banayein
2. Settings → **Dukaan** tab → address aur State bhar dein (GST state code isse auto set hota hai)
3. GST hai to toggle on karke GSTIN daalein, nahi hai to chhod dein
4. Settings → **Retailers** tab → invite link copy karke WhatsApp pe bhejein
5. Retailer link kholta hai → register karta hai → aapke paas approve karne aata hai

---

## Folder structure

```
rakhrakhav/
├── server/
│   └── src/
│       ├── config/        env, db connection, constants (saare enums)
│       ├── models/        14 mongoose models
│       ├── middleware/    auth, tenant, validate, errorHandler
│       ├── routes/        API mount point
│       ├── controllers/   (Part 2 se bharega)
│       ├── services/      (business logic — Part 5 se)
│       └── utils/         ApiError, money, financialYear, asyncHandler
└── client/
    └── src/
        ├── components/ui/      reusable components
        ├── components/layout/  sidebar, header, app shell
        ├── context/            AuthContext
        ├── routes/             AppRoutes + RequireAuth guard
        ├── pages/              feature pages (abhi placeholder)
        └── lib/                api client, formatters, cn
```

---

## Do rules jo poore project me follow honge

### 1. Multi-tenancy — `businessId`

Har collection me `businessId` hai. **Har query me ye filter lagana zaroori hai**, warna
ek wholesaler ka data dusre ko dikh jayega.

```js
// Sahi
const items = await Item.find({ businessId: req.businessId, isActive: true });

// GALAT — kabhi mat likhna
const items = await Item.find({ isActive: true });
```

`withTenant` middleware `req.businessId` set karta hai.
Retailer ke liye ye uske wholesaler ka businessId hota hai (1:1 lock).

### 2. Rate resolution chain

Item ka rate lagane ka order — Part 6 aur Part 8 dono me yahi:

```
1. PartyItemRate   (is retailer ke liye special rate)
2. item.wholesalePrice   (sabhi retailers ke liye)
3. item.salePrice        (default)
```

---

## GST optional

Har wholesaler GST registered nahi hota. `Business.gstEnabled` poori app ka behaviour badalta hai:

| | `gstEnabled: false` | `gstEnabled: true` |
|---|---|---|
| Invoice ka naam | **Bill of Supply** | **Tax Invoice** |
| GSTIN | invoice pe nahi | invoice pe chapega (validate hota hai) |
| HSN / GST rate fields | item form me chhupe | dikhte hain |
| Tax breakup | koi nahi | same state = CGST+SGST, dusra state = IGST |
| GST report | menu me nahi | menu me |
| Total | rate × qty − discount | taxable + tax |

Item pe `hsn` aur `gstRate` **hamesha store hote hain**, bas chhupe rehte hain — taaki
wholesaler baad me GST le to data pehle se ready ho.

`Invoice.gstEnabled` invoice banne ke waqt ka **snapshot** hai. Wholesaler baad me GST le le,
to purane bill "Bill of Supply" hi rahenge — yahi legally sahi hai.

---

## Database models

| Model | Kaam | Part |
|---|---|---|
| `User` | Login — wholesaler ya retailer | 2 |
| `Business` | Wholesaler ki firm (tenant root), GST toggle | 2 |
| `Party` | Retailer + supplier dono, invite code, balance | 4 |
| `Category` | Item categories | 3 |
| `Item` | Stock, 3 prices, GST fields, photo | 3 |
| `PartyItemRate` | Party-wise special rate | 4 |
| `StockMovement` | Har stock change ka audit trail | 5 |
| `Purchase` | Supplier se aaya maal | 5 |
| `Order` | Retailer ka order + status history | 6, 7 |
| `Invoice` | Tax invoice / bill of supply + snapshots | 8 |
| `LedgerEntry` | Khata — debit/credit/running balance | 9 |
| `Payment` | Cash + UPI, pending→confirmed flow | 9 |
| `Notification` | In-app alerts | 10 |
| `Counter` | Document numbering, FY-wise reset | 8 |

---

## Design decisions (tay ho chuke)

| | |
|---|---|
| Stack | React (Vite) + Express, alag folders |
| Language | JavaScript (ESM), TypeScript nahi |
| Retailer model | Strict 1:1 — ek retailer, ek wholesaler |
| Auth | Phone + password, JWT (koi SMS/OTP nahi) |
| Styling | Tailwind CSS v4 + apne components |
| Stock kab ghate | Order pe sirf check, **invoice banne pe** ghatega |
| GST | Optional — `Business.gstEnabled` |
| Invoice number | Har business ka apna series, FY-wise reset — `INV/26-27/0001` |
| Images | Cloudinary (Part 3) |
| UPI | V1: QR + manual confirm. Gateway V2 |
| Notifications | V1: in-app. Push/WhatsApp V2 |
| Money | Hamesha `round2()`, 2 decimal |

---

## API endpoints (Part 2 tak)

| Method | Path | Kaun |
|---|---|---|
| POST | `/api/auth/wholesaler/signup` | public |
| POST | `/api/auth/login` | public |
| GET | `/api/auth/invite/:code` | public — link valid hai ya nahi |
| POST | `/api/auth/retailer/signup` | public — invite code ke saath |
| GET | `/api/auth/me` | logged in |
| PUT | `/api/auth/profile` | logged in |
| POST | `/api/auth/change-password` | logged in |
| POST | `/api/auth/logout` | logged in |
| GET | `/api/business/states` | public — 38 states + GST code |
| GET | `/api/business/me` | wholesaler |
| PUT | `/api/business/me` | wholesaler |
| POST | `/api/business/logo` | wholesaler (multipart) |
| DELETE | `/api/business/logo` | wholesaler |
| POST | `/api/business/invite/regenerate` | wholesaler |
| GET | `/api/business/retailers` | wholesaler |
| POST | `/api/business/retailers/:id/approve` | wholesaler |
| POST | `/api/business/retailers/:id/block` | wholesaler |
| GET/POST | `/api/categories` | wholesaler |
| PUT/DELETE | `/api/categories/:id` | wholesaler |
| GET | `/api/items` | wholesaler — q, categoryId, stock, sort, page |
| POST | `/api/items` | wholesaler |
| GET | `/api/items/stats` | wholesaler |
| GET | `/api/items/low-stock` | wholesaler |
| GET/PUT/DELETE | `/api/items/:id` | wholesaler |
| GET | `/api/items/:id/movements` | wholesaler |
| POST | `/api/items/:id/stock` | wholesaler — add / remove / set |
| POST/DELETE | `/api/items/:id/photo` | wholesaler |
| POST | `/api/items/bulk` | wholesaler |
| GET | `/api/items/export` \| `/api/items/import/sample` | wholesaler |
| POST | `/api/items/import` | wholesaler — commit: false = preview |
| GET | `/api/parties` | wholesaler — type, status, q, page |
| POST | `/api/parties` | wholesaler |
| GET | `/api/parties/stats` | wholesaler — ?type= |
| GET/PUT/DELETE | `/api/parties/:id` | wholesaler |
| POST | `/api/parties/:id/status` | wholesaler — active / blocked / pending |
| GET | `/api/parties/:id/rates` | wholesaler — q, categoryId, onlyCustom |
| PUT | `/api/parties/:id/rates/:itemId` | wholesaler — `rate: null` = hata do |
| POST | `/api/parties/:id/rates/bulk` | wholesaler — % tool |
| GET | `/api/purchases` | wholesaler — q, supplierId, paymentStatus, from, to |
| POST | `/api/purchases` | wholesaler — stock + khata dono update |
| GET | `/api/purchases/stats` | wholesaler |
| GET | `/api/purchases/next-number` | wholesaler — form me dikhane ke liye |
| GET | `/api/purchases/:id` | wholesaler — + stock movements |
| DELETE | `/api/purchases/:id` | wholesaler — poora reversal |
| GET | `/api/catalog` | **retailer** — q, categoryId, stock, sort |
| GET | `/api/catalog/shop` \| `/categories` \| `/item/:id` | retailer |
| GET | `/api/cart` \| `/api/cart/count` | retailer |
| POST | `/api/cart/items` | retailer — pehle se hai to qty judti hai |
| PUT | `/api/cart/items/:itemId` | retailer — qty 0 = nikal do |
| DELETE | `/api/cart/items/:itemId` \| `/api/cart` | retailer |
| GET | `/api/my-orders` \| `/summary` \| `/:id` | retailer — sirf apne |
| POST | `/api/my-orders` | retailer — cart se order |
| POST | `/api/my-orders/:id/cancel` | retailer — sirf PLACED |
| GET | `/api/orders` | wholesaler — q, status (+`open`), partyId, from, to |
| GET | `/api/orders/stats` | wholesaler — har status ka count |
| GET | `/api/orders/:id` | wholesaler — + har line ka live stock |
| POST | `/api/orders/:id/status` | wholesaler — PACKED / READY / DELIVERED |
| POST | `/api/orders/:id/cancel` | wholesaler — reason ke saath |
| PUT | `/api/orders/:id/items` | wholesaler — qty badlo, 0 = line hatao |
| GET | `/api/notifications` \| `/unread-count` | dono roles |
| POST | `/api/notifications/:id/read` \| `/read-all` | dono roles |
| GET | `/api/invoices` | wholesaler — q, partyId, paymentStatus, status, from, to |
| POST | `/api/invoices` | wholesaler — stock ghatta hai + khata banta hai |
| GET | `/api/invoices/stats` \| `/next-number` | wholesaler |
| GET | `/api/invoices/from-order/:orderId` | wholesaler — form prefill |
| GET | `/api/invoices/:id` | wholesaler — + HSN summary + amount in words |
| POST | `/api/invoices/:id/cancel` | wholesaler — poora reversal |
| GET | `/api/my-bills` \| `/my-bills/:id` | retailer — sirf apne |

### Part 9 ke endpoints

| Method | Path | Kaun | Kya karta hai |
|---|---|---|---|
| GET | `/api/khata` | wholesaler | party-wise balance list (type/filter/search) |
| GET | `/api/khata/summary` | wholesaler | lena, dena, net, top debtors |
| GET | `/api/khata/:partyId` | wholesaler | ek party ka poora khata (`?from`, `?to`) |
| GET | `/api/payments` | wholesaler | list — status/direction/mode/party/date filter |
| GET | `/api/payments/stats` | wholesaler | aaj, is mahine, pending |
| POST | `/api/payments` | wholesaler | cash/UPI/bank entry (IN ya OUT) |
| GET | `/api/payments/:id` | wholesaler | ek payment |
| POST | `/api/payments/:id/confirm` | wholesaler | pending → confirmed |
| POST | `/api/payments/:id/reject` | wholesaler | pending → failed (wajah ke saath) |
| DELETE | `/api/payments/:id` | wholesaler | poora reversal |
| GET | `/api/my/khata` | retailer | apna khata + baaki bill + wholesaler ki UPI |
| GET | `/api/my/payments` | retailer | maine kya bheja |
| POST | `/api/my/payments` | retailer | "UPI se bhej diya" — pending banta hai |
| GET | `/api/my/payments/:id` | retailer | ek payment |

### Part 10 ke endpoints

| Method | Path | Kaun | Kya karta hai |
|---|---|---|---|
| GET | `/api/dashboard` | dono | role ke hisaab se dashboard ka poora data |
| GET | `/api/reports/:name` | wholesaler | sale / purchase / stock / outstanding / gst / payment |
| GET | `/api/reports/:name/csv` | wholesaler | wahi report, CSV file ban kar |
| POST | `/api/khata/:partyId/remind` | wholesaler | retailer ko udhaar ki yaad dilana |
| GET | `/api/notifications` | dono | list (type filter, page) + unread count |
| GET | `/api/notifications/counts` | dono | type wise ginti |
| POST | `/api/notifications/read-all` | dono | sab padh liya |
| DELETE | `/api/notifications/clear-read` | dono | padhi hui purani hatao |
| DELETE | `/api/notifications/:id` | dono | ek hatao |

### Part 11 ke endpoints

| Method | Path | Kaun | Kya karta hai |
|---|---|---|---|
| GET | `/api/items/brands` | items | jo brand use ho rahe hain unki list |
| GET | `/api/returns` | returns | list (type/party/date filter) |
| GET | `/api/returns/stats` | returns | kitna wapas aaya, kitna bheja |
| GET | `/api/returns/prefill/:type/:docId` | returns | bill/purchase se form bhar do |
| POST | `/api/returns` | returns | credit ya debit note banao |
| GET | `/api/returns/:id` | returns | ek note |
| DELETE | `/api/returns/:id` | returns | poora reversal |
| GET | `/api/my/returns` | retailer | apne credit note |
| GET | `/api/staff` | **owner** | dukaan ke saare login + role/permission list |
| POST | `/api/staff` | **owner** | naya login |
| PUT | `/api/staff/:id` | **owner** | role, permission, password, block |
| DELETE | `/api/staff/:id` | **owner** | login hatao |
| POST | `/api/staff/change-password` | koi bhi | apna password badlo |
| GET | `/api/backup/summary` | **owner** | kitna data hai |
| GET | `/api/backup/download` | **owner** | poora JSON backup |
| GET | `/api/backup/csv/:kind` | **owner** | parties/invoices/khata/payments/purchases/returns |

---

### Part 17 ke endpoints (kharidne ka side)

Sab pe `protect` + `requireBuyer` — yaani retailer, ya wo wholesaler jiske paas
`purchases:create` hai (malik, sah-malik, manager, munshi, **godown incharge**).

| Method | Path | Kaam |
|---|---|---|
| GET | `/api/shops/saved` | Save ki hui dukaanein (search history jaisi). `?all=1` se save hatayi hui bhi |
| GET | `/api/shops/lookup?phone=` | Poora 10 ank ka number → dukaan. Aadha number 400 |
| POST | `/api/shops/connect` | `{ phone }` ya `{ businessId }` → us dukaan me apni Party + Membership |
| GET | `/api/shops/:id` | Ek dukaan ka poora page (naam, logo, kitne item, kitni category) |
| POST | `/api/shops/:id/save` | Save (follow jaisa) |
| DELETE | `/api/shops/:id/save` | Save hataana — **rishta phir bhi bana rehta hai** (khata wahin) |
| POST | `/api/shops/:id/touch` | "abhi isi dukaan me hoon" — search history ka kram |

**Kai dukaanein ek saath** (step 2) — inpe `X-Shop-Id` nahi lagta, ye khud saari
Membership uthate hain:

| Method | Path | Kaam |
|---|---|---|
| GET | `/api/buy/cart` | Sab dukaanon ka cart — har ek ka apna jod, aur kul jod |
| GET | `/api/buy/cart/count` | Badge ke liye — kitne item, kitni dukaan |
| POST | `/api/buy/checkout` | `{ orders: [{ shopId, paymentMode, note }] }` → har dukaan ka apna order |

**Kharida hua maal apne stock me** (step 3) — ye APNI dukaan ka kaam hai, isliye
purana `withTenant`; ijazat wahi jo kharid ki hai (`purchases`):

| Method | Path | Kaam |
|---|---|---|
| GET | `/api/stock-intake` | Jo kaam baaki hain (`?status=PENDING/DONE/CANCELLED/all`) |
| GET | `/api/stock-intake/count` | Menu ke badge ke liye |
| GET | `/api/stock-intake/:id` | Ek bill ka poora kaam |
| GET | `/api/stock-intake/:id/lines/:index/matches` | "Ye mera kaunsa item hai" ke andaze |
| POST | `/api/stock-intake/:id/lines/:index` | **Add karke aage** (ya `{ skip: true }`) |
| DELETE | `/api/stock-intake/:id/lines/:index` | Peeche — faisla badalna |
| POST | `/api/stock-intake/:id/finish` | **Stock me daal dein** → purchase ban jati hai |

**Baaki buy-side ke saare route** (`/catalog`, `/cart`, `/my-orders`, `/my-bills`,
`/my`) ab `X-Shop-Id` header dekhte hain:

- header **hai** → us dukaan me, par tabhi jab uski Membership ho (warna 403)
- header **nahi hai** → retailer apni purani dukaan me (bilkul pehle jaisa);
  wholesaler ki ek hi dukaan judi ho to wahi, ek se zyada ho to 400 ("dukaan chunein")

## Invite flow (Part 2 ka dil)

```
Wholesaler                          Retailer
────────────────────────────────────────────────────────────
Settings → Retailers
  invite link copy                  link kholta hai
  WhatsApp pe bhejta hai     ──►    /join/XD3UKNH5
                                    dukaan ka naam dikhta hai
                                    naam, phone, password bharta hai
                                            │
                             ◄──────  status: PENDING
  Retailers tab me dikhta hai        "Approval ka intezaar" screen
  Approve dabata hai         ──►     status: ACTIVE
                                     catalog khul gaya
```

- Ek hi link sabke liye. `Naya link banayein` dabate hi purana turant band.
- `Apne aap approve kar do` on kar do to pending step skip ho jayega.
- Block karne par retailer ka **login hi band** ho jata hai.
- Ek phone number sirf ek hi dukaan se jud sakta hai (strict 1:1).

---

## Stock ka niyam (Part 3 se aage hamesha)

Stock kabhi seedha `Item.stockQty` pe mat likhna. Hamesha `stock.service.js` ka
`applyStockChange()` ya `setStock()`. Kyunki:

1. Har badlav ka **StockMovement** record banta hai — "stock kahan gaya" ka jawab milta hai
2. Ghatate waqt **atomic check** hota hai — do order ek saath aayein tab bhi stock minus nahi jayega

```js
// Sahi
await applyStockChange({
  businessId, itemId, type: 'PURCHASE', qty: +10, refType: 'Purchase', refId, userId,
});

// GALAT — kabhi mat likhna
await Item.updateOne({ _id: itemId }, { $inc: { stockQty: 10 } });
```

Part 5 (purchase) aur Part 8 (invoice) dono yahi function call karenge.

**Movement kabhi delete mat karna.** Purchase delete hone par bhi dono record bane
rehte hain — "maal aaya" wala bhi aur "maal wapas gaya" wala bhi. Pehle
`deletePurchase` reversal banane ke turant baad `StockMovement.deleteMany()` chala
deta tha, jo apna hi banaya hua reversal bhi uda deta tha. Nateeja: item ka stock
10 kam ho jata tha aur history bilkul khali — "stock kahan gaya" ka jawab hi nahi
bachta tha, jo ki is service ka poora maqsad hai.

Isi wajah se **"kya ye item kisi purane bill me hai"** ka jawab bhi ab movement se
nahi, seedha document se poochha jata hai (`Invoice` / `Purchase` / `ReturnNote` me
`items.itemId`). Movement ek audit trail hai — "kya use hua" ka proxy nahi.

---

## Rate ka niyam (Part 4 se aage hamesha)

Kisi retailer ke liye item ka rate nikalna ho to `rate.service.js` use karo — kabhi
`item.salePrice` seedha mat uthao. Warna cart me ek rate aur bill me dusra rate aa jayega.

```js
import { resolveRate, resolveRates } from './services/rate.service.js';

// ek item
const { rate, source } = await resolveRate(businessId, partyId, itemId);

// bahut saare items ek saath (cart/invoice me yahi use karna)
const priced = await resolveRates(businessId, partyId, items);
```

Chain:

```
1. PartyItemRate       (is retailer ka khaas rate)   → source: 'custom'
2. item.wholesalePrice (sabhi retailers ke liye)     → source: 'wholesale'
3. item.salePrice      (default)                     → source: 'sale'
```

---

## Khate ka niyam (Part 5 se aage hamesha)

`Party.balance` pe kabhi seedha mat likhna — hamesha `ledger.service.js`.

```js
import { postEntry, reverseEntriesFor } from './services/ledger.service.js';

// hisaab badha (bill bana / maal aaya)
await postEntry({ businessId, partyId, type: 'PURCHASE', debit: 3450, refType: 'Purchase', refId });

// hisaab ghata (paisa diya / paisa aaya)
await postEntry({ businessId, partyId, type: 'PAYMENT_OUT', credit: 1000, refType: 'Purchase', refId });

// kuch delete hua to uski saari entries ulti
await reverseEntriesFor({ businessId, refType: 'Purchase', refId });
```

`balance` ka matlab (dono taraf +ve = hisaab baaki hai):

| | +ve balance |
|---|---|
| retailer | usne hamara paisa dena hai (udhaar) |
| supplier | humne uska paisa dena hai |

`balanceAfter = purana balance + debit − credit`. `Party.balance` atomically badhta hai,
isliye do entry ek saath aayein tab bhi running balance galat nahi hota.

---

## Khate ka running balance (asli DB pe pakda gaya bug)

Har ledger entry me `balanceAfter` **store** hota hai (fast read ke liye). Dikkat tab hoti hai jab
beech ki koi entry **hat** jaye — bill cancel, payment delete, return delete. Aage wali entries ka
`balanceAfter` purana hi reh jata tha, aur khata `Party.balance` se alag ho jata tha.

Ab `reverseEntriesFor()` entry hatane ke baad **`recalcBalances()`** chalata hai — us party ka poora
khata shuru se dobara jud jata hai, aur `Party.balance` bhi wahi se set hota hai. Isliye dono kabhi
alag ho hi nahi sakte; galti ho bhi jaye to agli reversal pe khud theek ho jayegi.

Wahi cheez **purani date** wali entry pe bhi lagti hai — `postEntry()` dekhta hai ki iske aage koi
entry hai kya; hai to poora khata dobara jodta hai.

Smoke test me iske do pehredaar hain: *"khata ka closing aur Party.balance barabar hain"* aur
*"har entry ka running balance sahi jud raha hai"*.

### Khata padhte waqt: limit hamesha NAYI entries pakde

`getPartyLedger()` entries **ulta** (naya pehle) nikalta hai aur phir palat deta hai.
Sidha nikalne se `limit` **purani** entries pakadti thi — jis party ke 200 se zyada
lena-dena ho gaye, uske khate me **aaj ka bill dikhta hi nahi tha** aur neeche
"Baaki" me mahino purana number chipak jata tha.

`opening` bhi ab pehli **dikhne wali** entry se ulta jod kar nikalta hai
(`balanceAfter − debit + credit`), na ki hamesha 0 se. Isse ye hamesha sach rehta hai:

```
opening + kul badha − kul ghata = Baaki
```

chahe entries limit se kati hon, chahe date range laga ho, chahe dono. Jab kuch
kata ho to jawab me `truncated: true` bhi jata hai aur UI upar ek line dikha deta hai.

---

## Paise ka niyam (Part 9 se aage hamesha)

Khata sirf `services/ledger.service.js` se badalta hai (ye Part 5 se hai), aur paisa sirf
`services/payment.service.js` se aata-jata hai. Koi controller seedha `Party.balance` nahi chhuta.

**Ek hi convention poore project me:**

| | Matlab | Kab |
|---|---|---|
| `debit` | hisaab **badha** | Bill bana, maal aaya, purana hisaab |
| `credit` | hisaab **ghata** | Paisa aaya (IN) **ya** paisa diya (OUT) |

`PAYMENT_OUT` bhi `credit` hi hai — supplier ko paisa dene se uska hisaab ghatta hai, badhta nahi.

**Paisa kis bill pe lagega — FIFO:**

Retailer se aaya paisa sabse purane unpaid bill se shuru hota hai, jitna lagta hai lagta hai,
phir agle bill pe. Bach gaya to wo **advance** hai — khate me credit rehta hai (balance minus me
chala jata hai), agla bill banega to apne aap adjust ho jayega.

**Retailer ke UPI claim ka do-step flow:**

```
retailer "bhej diya" dabaye  ->  status: pending   ->  khate me KUCH NAHI
wholesaler "Mil gaya" dabaye ->  status: confirmed ->  allocation + ledger + notification
wholesaler "Nahi mila"       ->  status: failed    ->  khata jaisa tha waisa hi
```

Ye jaan-boojh kar hai — retailer ke keh dene se hisaab nahi badalna chahiye. Paisa asli me aaya ya
nahi, ye sirf wholesaler apna account dekh kar bata sakta hai.

**Kis bill pe kitna laga — ye ab likha jata hai:**

`Payment.allocations` = `[{ invoiceId, amount }]`. Pehle sirf `againstInvoiceIds` tha yaani
"kaunse bill" — "kitna" nahi. Delete karte waqt code ko andaza lagana padta tha, aur do payment
ek hi bill pe lagi hon to hisaab galat ho jata tha. `againstInvoiceIds` abhi bhi likha jata hai
(purani entries aur query uspe hain), par asli hisaab `allocations` se hota hai.

---

## Do kaam ek saath (concurrency)

Dukaan me do log alag alag phone se kaam karte hain, aur net slow ho to ek hi banda
button do baar daba deta hai. Teen niyam isi liye hain:

### 1. Number kabhi JS me mat gino — MongoDB se ginwao

```js
// GALAT — do request ek saath aayen to ek ka paisa gayab
inv.paidAmount = inv.paidAmount + apply;
await inv.save();

// SAHI — DB khud, us waqt ki asli value se ginta hai
await Invoice.findOneAndUpdate(
  { _id, businessId, dueAmount: { $gte: apply } },   // <- utna baaki hai tabhi
  [{ $set: { paidAmount: { $round: [{ $add: ['$paidAmount', apply] }, 2] } } }, ...],
  { new: true }
);
```

Padho-gino-likho ke beech doosri request ghus jati hai: dono ne `paidAmount 0` padha,
dono ne `5000` likh diya — 10000 ka bill 5000 paid dikhata, jabki khate me dono credit
gine gaye. `payment.service.js` ka `applyPaidAtomic()` ab isi ka ek darwaza hai.

### 2. Status badalna ho to PEHLE jhanda gaado, phir kaam karo

```js
// GALAT — dono request check paas kar jaati hain
const p = await Payment.findOne({ _id });
if (p.status === 'confirmed') throw ...;

// SAHI — filter me hi purani status
const p = await Payment.findOneAndUpdate(
  { _id, businessId, status: PENDING },
  { $set: { status: CONFIRMED } }, { new: true }
);
if (!p) { /* kisi aur ne pehle kar liya */ }
```

MongoDB ek document pe ek waqt me ek hi update chalata hai, isliye do me se sirf **ek**
ko document milta hai. `confirmPayment`, `rejectPayment` (`findOneAndUpdate`) aur
`deletePayment` (`findOneAndDelete`) — teeno isi tarah "claim" karte hain. Kaam beech me
fail ho jaye to status wapas `pending` kar diya jata hai.

### 3. Kai kadam wala kaam: pehle poora check, phir gadbad pe poora ulta

`createInvoice` paanch kaam karta hai — bill, stock, khata, payment, order. Beech me fail
ho jaye (aksar: doosre bill ne wahi stock utha liya) to pehle **aadha bill** reh jata tha:
list me bill dikhta, do item ka stock kat chuka hota, khate me kuch aata hi nahi.

Ab do parat hain:

1. **Pehle poora stock check** — saari line JOD kar (ek hi item do line me ho tab bhi)
2. **Phir bhi fail ho to `undoHalfInvoice()`** — ulte order me payment → khata → stock → bill

**MongoDB transaction kyun nahi:** uske liye `session` ko `stock.service`, `ledger.service`
aur `Counter` — teeno ke andar tak le jana padta, aur wo teeno poore project ke "ek hi
darwaza" wale service hain. Upar wala check 99% case pehle hi rok deta hai; rollback bache
hue case ka jaal hai.

Rollback me stock ke movement **delete nahi** hote (wahi niyam jo purchase delete pe hai) —
history saaf dikhati hai ki maal gaya tha aur wapas aa gaya.

**Test:** `smoke.js` ka **"Do kaam ek saath"** section sach me do request ek saath bhejta
hai (`Promise.all`) — aapke apne DB pe.

---

### Reversal ka poora naksha

**Ye sabse zaroori table hai.** Har document delete/cancel hone par kya kya ulta karna hai —
ye ek jagah likha hua na hone ki wajah se chaar alag alag jagah paisa gayab ho raha tha.
Naya code likhte waqt is table se milaana:

| Kya hua | Stock | Khata | Doosre document |
|---|---|---|---|
| **Purchase delete** | ghatta hai (`PURCHASE_RETURN`) | `refType: 'Purchase'` ulta | maal bik chuka ho to delete hi nahi hota |
| **Bill cancel** | badhta hai (`SALE_RETURN`) | `refType: 'Invoice'` ulta | **credit note bana ho to cancel hi nahi hota**; bill ke saath aayi payment hatti hai; baad wali payments sirf **chhut** jati hain |
| **Payment delete** | — | `refType: 'Payment'` ulta | `allocations` ke hisaab se har bill ka `paidAmount` ghatta hai |
| **Payment reject** | — | kuch nahi (pending tha, laga hi nahi tha) | kuch nahi |
| **Return delete** | ulta (`stockSign` ke against) | `refType: 'ReturnNote'` ulta | — |

**Do niyam jo yahan se nikalte hain:**

1. **Paisa kabhi delete nahi hota jab tak user khud na kahe.** Bill cancel karne par uspe lagi
   doosri payments *delete nahi hoti* — unse sirf us bill ka hissa hatta hai aur wo paisa doosre
   khule bill pe lag jata hai (FIFO), bacha to advance ban jata hai. Pehle yahan
   `Payment.deleteMany({ againstInvoiceIds })` tha — wo mahine baad aayi payment ko bhi uda deta tha.
   Sirf **bill ke saath** aayi payment (`sourceInvoiceId`) bill ke saath hi hatti hai.

2. **Har payment ki khata entry `refType: 'Payment'` hoti hai** — bill ke saath aayi payment ki bhi.
   Pehle wo `refType: 'Invoice'` thi aur `deletePayment` `'Payment'` dhoondhta tha, isliye
   payment delete karne pe bill to theek ho jata tha par khate me credit pada reh jata tha
   (bill 10000 maangta, khata 7000 dikhata).

**Aakhri kasauti:** kisi bhi kaam ke baad `khata ka balance` = `us party ke saare active bill
ka baaki`. `npm run smoke` me yahi check aakhir me chalta hai.

### UPI kaise kaam karta hai

Koi payment gateway nahi lagaya — na fees, na KYC, na settlement ka intezaar. Paisa seedha
wholesaler ke bank me jata hai.

```
upi://pay?pa=<upi-id>&pn=<naam>&am=<amount>&cu=INR&tn=<note>
```

Phone pe ye link GPay/PhonePe/Paytm khol deta hai, amount pehle se bhara hua. Computer pe wahi
link QR ban jata hai (`qrcode` package, sirf modal khulne par load hoti hai). Confirm karna manual
hai — V2 me bank statement se auto-match kar sakte hain.


---

## Report ka niyam (Part 10)

Har report `services/report.service.js` me hai aur **ek hi shakal** me jawab deti hai:

```js
{ columns, rows, totals, meta }
```

`columns` isliye alag se aata hai taaki **table aur CSV dono ek hi cheez se banein**. Naya column
jodna ho to sirf `columns` me ek line — CSV apne aap update ho jayegi, controller me kuch nahi
badalna padta.

| Flag | Matlab |
|---|---|
| `money: true` | ₹ ke saath dikhega |
| `text: true` | left align, aur total me nahi ginega |
| `noTotal: true` | number hai par jodne layak nahi (rate, %, average) |

**Aging buckets** party ke balance se nahi, **bill ki date** se bante hain — isi se pata chalta hai
ki paisa kitna purana phansa hai.

**Munafa "andaza" hai** — invoice pe cost snapshot nahi hota, item ka aaj ka `purchasePrice` use
hota hai. Isliye report me साफ likha hai "Munafa (andaza)".

**Jo report jodti hai, wo document pe SAVE hona chahiye.** GST report ka input credit
`$sum: '$taxableTotal'` karta hai — lekin `Purchase` model me `taxableTotal` field thi hi
nahi, isliye kharid ka taxable hamesha **0** dikhta tha (tax theek dikhta tha, sirf taxable 0).
Naya total jodne se pehle dekh lo ki wo field model me hai aur create karte waqt save ho rahi hai.
Purane document ke liye `config/backfill.js` hai — startup pe ek baar chalta hai, kabhi
startup rokta nahi (bilkul `syncIndexes()` ki tarah).

### Low stock alert kab aata hai

Sirf jab stock threshold **paar** kare — pehle upar tha, ab neeche. Isi se har bill pe wahi alert
dobara nahi aata:

```
20 -> 18  (limit 10)  ->  koi alert nahi
18 ->  4  (limit 10)  ->  "Bearing 6203 kam bacha hai"
 4 ->  3              ->  koi alert nahi (pehle se hi neeche tha)
 3 ->  0              ->  "Bearing 6203 khatam ho gaya"
```

Ye check `stock.service.js` ke andar hi hai — matlab purchase, bill, adjustment, kahin se bhi
stock ghate, alert apne aap chal jayega. Alert bhejne me kuch gadbad ho jaye to bill nahi rukta
(poora block `try/catch` me hai) — hisaab alert se zyada zaroori hai.


---

## Return ka niyam (Part 11)

Maal wapas aane ke do bilkul ulte case hain, aur dono ka apna document banta hai:

| | Kya hua | Document | Stock | Khata |
|---|---|---|---|---|
| `SALE_RETURN` | Retailer ne humein wapas kiya | **Credit Note** (`CRN/26-27/0001`) | **badhta** hai | uska udhaar **ghatta** hai |
| `PURCHASE_RETURN` | Humne supplier ko wapas bheja | **Debit Note** (`DBN/26-27/0001`) | **ghatta** hai | usko dena **ghatta** hai |

Dono me ledger entry **credit** hi hai — kyunki dono soorat me hisaab ghatta hai. Wahi purana
convention (`debit` = hisaab badha, `credit` = hisaab ghata) yahan bhi chalta hai.

**Bill se zyada wapas nahi ho sakta.** Har baar hisaab lagta hai ki us bill me se ab tak kitna
wapas ho chuka hai — becha 10, wapas 12 kabhi nahi hoga. Purchase return me stock ka check bhi
hai: jo maal paas hai hi nahi, wo wapas kaise bhejenge.

**Bill khud nahi badalta.** Credit note ek alag document hai — original bill waisa ka waisa rehta
hai (wo sach me hui sale thi). Ye legally bhi sahi hai aur samajhne me bhi seedha.

---

## Staff ka niyam (Part 11)

Ek dukaan, kai log. Signup karne wala **owner** hai; baaki uske staff.

| Role | Kya milta hai |
|---|---|
| **Malik** (owner) | Sab kuch — hamesha, chahe permissions khali ho |
| **Manager** | Settings chhod kar lagbhag sab |
| **Salesman** | Items, orders, bill — khata nahi |
| **Munshi** (accountant) | Khata, payment, report, bill — stock/purchase nahi |

Staff ko 8 permission di ja sakti hain: `items`, `parties`, `purchases`, `orders`, `invoices`,
`returns`, `khata`, `reports`. Role chunne par default set ho jati hain, owner chahe to badal
sakta hai.

`settings` (9vi) **kisi staff ko di nahi ja sakti** — dukaan ki detail, invite link, staff aur
backup, chaaron server pe `requireOwner` se bandh hain. Pehle iska checkbox dikhta tha, malik
tick kar deta tha, aur hota kuch nahi tha. Ab checkbox hai hi nahi (`GRANTABLE` list, `StaffTab.jsx`).

**Teen jagah rok lagti hai — teeno zaroori hain:**

1. **Menu** — sidebar me wahi item dikhta hai jiski ijazat hai
2. **Route** — URL type karke bhi khula nahi milega (`RequirePermission`)
3. **API** — `requirePermission()` har route pe, aur **dashboard ka data bhi chhant kar** jata hai

Teesra sabse zaroori hai. Sirf menu chhupa dena kaafi nahi — salesman ko dashboard pe "udhaar
baaki ₹2,266" dikh jana bhi leak hai. Isliye jiski ijazat nahi, uska hissa response me aata hi
nahi.

### Naya route jodte waqt ye do sawal

**1. "Ye kaam kis permission ka hai?"** — sirf `requireRole(WHOLESALER)` kaafi NAHI hai, wo to
har staff paas kar leta hai. `/business/retailers` (list, approve, block) pe yahi galti thi:
wo `/parties` wala hi kaam karte hain, par unpe koi `requirePermission` laga hi nahi tha —
matlab salesman doosre darwaze se kisi bhi retailer ka **login band** kar sakta tha
(block karne pe uska `User.isActive` false ho jata hai) aur sabka balance/credit limit bhi dekh leta tha.

**2. "Ek hi cheez ke do darwaze to nahi hain?"** — agar hain to dono pe ek jaisa niyam laga hai
ya nahi. Dashboard ka mahine wala jod, 14 din ka graph aur top items pehle `invoices` pe tike the,
jabki wahi numbers `/api/reports` `reports` ke peeche the. Ab dono jagah `reports` chahiye.

### Dukaan ki detail: ek hi darwaza

`Business` doc kabhi seedha response me mat bhejna — hamesha
**`utils/businessView.js` ka `businessForUser(business, user)`** se.

| Kaun | Kya milta hai |
|---|---|
| **Malik** | Poora doc + `inviteLink` |
| **Staff** | Sirf wo jo bill pe chhapta hai — naam, phone, address, GSTIN, logo, prefix, T&C |
| **Retailer** | Sirf dukaan ki pehchaan — naam, phone, address, logo, `gstEnabled` |

Staff se ye chhupte hain: `inviteCode`/`inviteLink`, `upiId`/`upiName`, `email`,
`inviteEnabled`, `autoApproveRetailers`, `ownerUserId`.

Sabse zaroori **invite code** hai — jiske paas link hai wo retailer ban kar ghus sakta hai, aur
naya link sirf malik bana sakta hai; isliye leak hone par malik ko pata bhi nahi chalega.

Pehle chhanti sirf retailer ke liye hoti thi, wo bhi `buildSession()` ke andar hi likhi thi —
aur `/business/me` apna alag jawab deta tha (poora doc). Do jagah do niyam = ek jagah bhool.
Ab dono wahi ek function bulate hain, aur user na diya jaye to by default staff-level hissa hi
milta hai (fail-safe).

Owner ko koi hata/block nahi kar sakta — khud bhi nahi. Doosra owner banaya bhi nahi ja sakta.

---

## Backup ka niyam (Part 11)

Settings → Backup me do cheezein:

1. **Poora JSON backup** — saara data ek file me. Password (`passwordHash`) kabhi is file me
   nahi jata. File browser me download hoti hai, kahin upload nahi hoti.
2. **6 CSV** — parties, bills, khata, payments, purchases, returns. Excel me kholne layak.

Sirf **owner** backup le sakta hai — staff nahi.

> Ye database ke backup ki jagah nahi leta. Dono alag cheezein hain — MongoDB Atlas pe automatic
> backup on rakhiye, aur mahine me ek baar ye file bhi utaar liya kariye.


---

## Retailer ko kya dikhta hai (Part 6 se)

| Cheez | Retailer ko | Wajah |
|---|---|---|
| Item ka naam, photo, unit, category | ✅ | order karne ke liye chahiye |
| Rate (uska apna) | ✅ | `rate.service` se resolve hoke |
| Stock | ✅ | kitna order karna hai wo tay kar sake |
| Purchase price / margin | ❌ | aapka fayda uska kaam nahi |
| Dusre retailer ka rate | ❌ | har retailer sirf apna rate dekhta hai |
| `visibleToRetailers: false` wale items | ❌ | catalog me dikhte hi nahi, seedha URL se bhi nahi |
| Business ka GSTIN, invoice prefix waghairah | ❌ | `/catalog/shop` sirf naam, phone, address, logo deta hai |

Cart me sirf `itemId` + `qty` store hoti hai — rate kabhi store nahi hota. Isliye
wholesaler rate badle to cart aur order dono me naya rate hi jayega.

---

## Order ka status flow (Part 7)

```
PLACED ──► PACKED ──► READY ──► DELIVERED
   │          │          │
   └──────────┴──────────┴──► CANCELLED
```

- `ORDER_STATUS_FLOW` (constants.js) hi tay karta hai kya allowed hai — PLACED se seedha DELIVERED nahi ho sakta
- Retailer sirf `PLACED` me khud cancel kar sakta hai; uske baad "wholesaler ne kaam shuru kar diya hai"
- Wholesaler `DELIVERED` ke alawa kabhi bhi cancel kar sakta hai
- `DELIVERED` / `CANCELLED` ke baad quantity nahi badal sakti
- Har badlav par retailer ko notification jata hai

**Stock abhi bhi nahi ghatta** — wo Part 8 me bill banne pe ghatega. Order detail me har item
ka *abhi ka* stock dikhta hai taaki wholesaler dekh kar tay kar sake kitna bhej sakta hai.

---

## GST ka hisaab (Part 8)

Sab kuch `services/gst.service.js` me — do faisle:

| Faisla | Kis se |
|---|---|
| Bill ka naam | `business.gstEnabled` → Tax Invoice ya Bill of Supply |
| Kaunsa tax | dono ka state code → same = CGST+SGST (aadha aadha), alag = IGST (poora) |

- Line total = (qty × rate) − discount, uspe GST
- **Bill-level extra discount** har line pe uske hisse ke barabar batta hai — warna GST galat ban jayega
- CGST/SGST me paisa kabhi nahi girta: `sgst = tax − cgst`
- `Invoice.gstEnabled` **snapshot** hai — baad me GST le liya to purane bill "Bill of Supply" hi rahenge
- `businessSnapshot` / `partySnapshot` bhi save hote hain — address ya GSTIN badalne se purana bill nahi badalta

**Bill banate hi teen cheezein ek saath:**

1. Stock ghatta hai (`SALE` movement, `refType: 'Invoice'`) — pehle check, kam ho to bill banta hi nahi
2. Khate me udhaar chadhta hai (`postEntry` → `INVOICE` debit)
3. Turant paisa mila to `Payment` record + `PAYMENT_IN` credit

Cancel karne par teeno ulte ho jate hain, par **bill delete nahi hota** — number record me rehta hai
(legal), sirf `isCancelled` lag jata hai.

### PDF

Alag PDF library nahi lagayi. Bill ka HTML hi print CSS ke saath A4 pe seedha chhapta hai —
`@media print` me sidebar, header aur buttons chhup jate hain aur sirf `.invoice-sheet` bachta hai.
Browser ke print window me "Save as PDF" chunne se saaf PDF milta hai, aur text select bhi ho jata hai
(image wale PDF me nahi hota).

---

## UI ka niyam — mobile pehle (Part 12)

Dukaandaar ka asli device **phone** hai. Laptop kabhi-kabhi khulta hai. Isliye
har screen pehle 390px pe theek honi chahiye, uske baad badi screen pe.

### Neeche wali patti (bottom nav)

Phone aur tablet pe char sabse zyada chalne wale kaam angoothe ke neeche fix
hain, aur paanchve khane me **Menu** (wahi purana teen-line wala button, jo
pehle upar-baayein kone me tha — jahan ek haath maal me lage hue angootha
pahunchta hi nahi):

| | Wholesaler | Retailer |
|---|---|---|
| 1 | Dashboard | Home |
| 2 | Orders | Catalog |
| 3 | Payments | Cart |
| 4 | Items | My Orders |
| 5 | **Menu** | **Menu** |

- Ye patti `lg` se chhoti screen pe hi hai (`lg:hidden`) — desktop pe poori
  sidebar dikhti hai, do jagah ek hi menu dena bekaar hai.
- Har khaana kam se kam **56px** uncha hai (`min-h-14`).
- `pb-[env(safe-area-inset-bottom)]` — iPhone ke home wale dande ke peeche
  na chali jaye.
- Content ke neeche `pb-20` jagah chhodi hai, warna page ka aakhri button
  patti ke peeche chhup jata hai.
- Menu ki daraz `z-[60]` pe hai aur patti `z-40` pe — daraz patti ke UPAR
  aati hai, warna uske aakhri do item dab jate the.

Kaun se char khane honge, wo `client/src/components/layout/navConfig.js` ke
`bottomNavFor()` me hai. Staff ko jo permission nahi mili, wo item apne aap
nikal jata hai aur uski jagah agla item aa jata hai.

### Back button

Upar wali patti me baayein taraf ab **back** hai (pehle wahan teen line thi).

```js
// Header.jsx
function canGoBack() {
  const idx = window.history.state?.idx;
  return typeof idx === 'number' ? idx > 0 : window.history.length > 1;
}
```

`location.key === 'default'` se mat dekhna — login ke baad ya
`<Navigate replace>` chalne ke baad key badal jati hai jabki history khali
hoti hai, aur back dabane pe user seedha app se **bahar** (khali page pe)
chala jata tha.

History khali ho to `backTo` pe jate hain, jo AppLayout tay karta hai:

```
/invoices/123  ->  /invoices    (apni list pe)
/invoices      ->  /dashboard   (ghar pe)
```

Doosri line zaroori hai — pehle yahan hamesha section ka apna rasta jata tha,
yaani `/settings` pe back dabane se `/settings` hi khulta tha aur kuch hota
hua dikhta hi nahi tha.

Jo page neeche wali patti me hai, uspe back nahi dikhta (wahan se peeche
jaane ki jagah hai hi nahi) — uski jagah dukaan ka logo dikhta hai.

### Table phone pe: card ban jati hai

**Ye sabse bada niyam hai.** `<table>` 600px se chhoti nahi hoti aur phone
390px ka hota hai. Matlab aakhri column — jisme aksar Total ya button hota
hai — screen se bahar reh jata tha. Dukaandaar ko pata hi nahi chalta ki
wahan kuch hai.

Asli bug jo isi wajah se mila: **phone pe `/retailers` par `Approve` button
tha hi nahi.** Naya retailer register karta tha aur phone pe baitha
wholesaler use approve hi nahi kar pata tha.

Ab `components/ui/Table.jsx` khud dono roop banata hai:

```
md se badi screen  ->  poori table
md se chhoti       ->  har row ka apna card
```

Column ki jagah `mobile` se tay hoti hai (na do to apne aap tay hoti hai):

| `mobile` | kahan aata hai |
|---|---|
| `title` | sabse upar mota naam (pehla column) |
| `badge` | naam ke saamne daayein (`status`/`paymentStatus` apne aap) |
| `actions` | daayein kone me button (`actions` key ya khali header apne aap) |
| `select` | sabse baayein checkbox |
| `meta` | neeche "naam: ginti" jodi (baaki sab) |
| `block` | neeche poori chaudai me (jaise bharne wala dabba) |
| `hidden` | phone pe mat dikhao |

Jin page pe apna banaya hua phone wala roop hai, wo `<Table>` ko
`hidden md:block` me lapet kar rakhte hain.

### DOM me pehle DESKTOP, phir MOBILE

```jsx
<div className="hidden md:block"> ...table... </div>   {/* pehle */}
<div className="md:hidden">       ...cards... </div>   {/* baad me */}
```

Ye order **badalna mat**. Ek hi cheez do baar DOM me hoti hai (ek chhupi
hui), aur test `.first()` (desktop) ya `.last()` (mobile) se pakadte hain.
Order palat do to `.first()` chhupe hue element pe chala jata hai aur
`isVisible()` false de deta hai — 3 purane test isi wajah se toote the.

Naya assertion likhte waqt bhi yaad rakhein: jo cheez dono roop me hai, uspe
`.first()`/`.last()` lagana padega warna Playwright strict mode error dega.

### Jo table card nahi ban sakti

Bill/credit note ka print wala roop **kaagaz jaisa** dikhna chahiye, isliye
wo table hi rehti hai. Phone pe wo apne dabbe ke andar side me khiskati hai:

```jsx
<div className="sheet-scroll overflow-x-auto">
  <table className="min-w-[600px] ..."> {/* GST on ho to */}
</div>
```

`index.css` ke `@media print` me `.sheet-scroll` ka `overflow` aur andar ki
table ka `min-width` hata diya jata hai — warna kaagaz pe bill kat jata.
Neeche ek chhoti line bhi likhi hai ki table ko side me khiskana hai, warna
user samajhta hai ki bas itna hi hai.

### Chhoti cheezein jo phone pe bahut farak karti hain

- **Tap ka ghera 44px**: dikhne me switch 44×24 ka hi hai, par button poora
  44×44 hai. 24px unchi patti pe har teesri baar ungli chook jati hai.
- **Stat card do-do karke**: `grid-cols-2 ... lg:grid-cols-4`. Pehle chaar
  tile poori screen kha jate the aur asli list dekhne ke liye neeche
  khiskana padta tha. Aadhi chaudai me icon upar chala jata hai aur naam ko
  do line milti hain.
- **Button wali line `flex-wrap`**: `flex shrink-0` mat likhna — PurchaseDetail
  pe teen button ek line me nahi aate the aur `Delete` screen se bahar nikal
  jata tha.
- **Form ke item card**: bill/purchase me maal 720px ki table me bharte the.
  Ek item bharne me teen baar screen side me ghumani padti thi. Ab phone pe
  har item ka apna card hai (`components/ui/LineItemCard.jsx`), aur har
  dabbe ke upar uski apni likhaayi hai.

### Ise kaise jaancha jata hai

```bash
cd client && npm run check   # bina import kiye naam pakadta hai
```

Vite build ye galti nahi pakadta — wo runtime pe `ReferenceError` banti hai
aur page safed ho jata hai. `client/scripts/check-imports.mjs` isi liye hai.

Layout ke liye teen viewport pe (360 / 390 / 820) har page ka side-scroll
aur patti ke peeche chhupa content jaancha jata hai.

## Sub-account — kaun kya kar sakta hai (Part 12)

Dukaan me sirf malik nahi hota. Salesman, munshi, godown wala, CA — sabko
alag alag cheez chahiye. Pehle ijazat sirf itni thi: "Orders ka access hai ya
nahi". Uska matlab tha ki jise order DEKHNE diya, wo order MITA bhi sakta tha.
CA ko sirf hisaab dikhana mumkin hi nahi tha.

Ab teen cheezein alag alag hain, aur teeno chahiye:

| | Kya batati hai | Kahan likhi hai |
|---|---|---|
| **Ijazat** | kaunsa kaam kar sakta hai | `config/permissions.js` |
| **Hadd** | kis KE data pe kar sakta hai | `utils/scope.js` |
| **Paisa** | kitne tak | `utils/limits.js` |

### Ijazat = `module:kaam`

```
invoices:create   →  "bill bana sakta hai"
khata:view        →  "hisaab sirf dekh sakta hai"
```

Das module × chaar-paanch kaam = **38 alag ijazat**. Poore app me ijazat
hamesha isi shakal me likhi jati hai — route pe bhi, client pe bhi.

| Module | Kaam |
|---|---|
| items, purchases, orders, invoices, returns | view · create · edit · delete |
| parties | view · create · edit · delete · **approve** |
| khata | view · create · edit · delete · **approve** |
| reports | view · **export** |
| staff | view · create · edit · delete |
| settings | view · edit |

### Aath role

| Role | Kya kar sakta hai |
|---|---|
| **Malik** | Sab kuch. Ise koi chhed nahi sakta |
| **Sah-malik** | Malik jitna hi. Ek se zyada ho sakte hain |
| **Manager** | Poori dukaan — staff aur settings chhod kar |
| **Salesman** | Order aur bill banata hai. Mitata kuch nahi. Sirf apne retailer |
| **Munshi** | Paisa aur hisaab. Stock se lena-dena nahi |
| **CA / Auditor** | **Sirf dekhna.** Ek bhi cheez badal nahi sakta |
| **Godown incharge** | Maal andar-bahar. Paisa dikhta hi nahi |
| **Cash counter** | Sirf paisa lena-dena |
| **Apni marzi se** | Malik khud har tick lagata hai |

Role sirf SHURUAAT hai — malik har aadmi ke liye alag se ghata-badha sakta
hai. Asli sach hamesha uski `permissions` list hai, role nahi.

**Do niyam jo poore system ki jaan hain:**

1. **Malik ko koi chhed nahi sakta** — na hata sakta, na role badal sakta,
   khud bhi nahi. Warna ek galti se dukaan ka koi malik hi na bachta.
2. **Sah-malik sirf malik bana sakta hai.** Agar sah-malik doosre sah-malik
   bana/hata pata, to ek sah-malik baaki sabko nikaal kar poori dukaan pe
   kabza kar leta.

### Hadd — "sirf apna kaam"

Salesman pe `scope: 'own'` lagta hai. Use wahi retailer dikhte hain jo uske
naam hain (`Party.assignedToUserId`) ya jo usne khud jode (`Party.createdBy`).

**Order, bill, khata aur payment ka apna maalik nahi hota** — wo us RETAILER
ke saath chalte hain jiska wo hai. Isliye pehle "mere retailer" nikalte hain,
phir unhi ka baaki sab. Ek jagah niyam badlo, sab jagah lag jata hai.

**Sirf list chhupana kaafi nahi hai.** Id URL me daali ja sakti hai, isliye
har `getX(id)` aur har badalne wale kaam pe bhi check lagta hai — aur wo
"ijazat nahi" nahi, **"nahi mila"** bolta hai. Warna galat jawab se hi pata
chal jata ki us id pe kuch hai.

Ginti bhi wahi dikhti hai jitni list — warna upar "42 retailer" likha aata
aur neeche 6 dikhte.

### Paise ki hadd

```js
limits: {
  maxDiscountPercent: 10,      // null = koi hadd nahi
  maxInvoiceAmount: 50000,     // null = koi hadd nahi
  canSellOnCredit: false,      // poora paisa usi waqt lena hoga
}
```

`null` aur `0` ALAG hain. `null` = "jitna marzi", `0` = "bilkul nahi". Khali
dabba hamesha `null` banta hai — ye galti aasani se ho jati hai.

Jaanch bill save hone se **pehle** hoti hai — number lene aur stock ghatane
se pehle. Baad me karte to bill number kharch ho jata aur stock chhu liya
jata, phir sab ulta karna padta.

### Kisne kya kiya (register)

`AuditLog` + `services/audit.service.js` — **ek hi darwaza**. Kabhi seedha
`AuditLog.create()` mat likhna; wahi wajah jo stock aur ledger ki hai.

Sambhalte hain: kisne (naam aur role SAATH me, sirf id nahi — staff hat jaye
to bhi register padha ja sake), kya kiya, kis cheez pe, aur **kya se kya**
(sirf badle hue field: `salePrice 12 → 25`).

**Register kabhi asli kaam nahi rokta.** Likhna fail ho jaye to sirf log
hota hai. Ulta hota to ek din database bharne par poori dukaan ruk jati.

### Staff ko link se jodna

Malik ek link banata hai jisme role aur ijazat **pehle se tay** hoti hai.
Link WhatsApp pe bhej deta hai; aane wala khud apna password banata hai —
malik ko wo kabhi pata nahi chalta.

Token ka **hash** rakhte hain, token nahi (API key ki tarah). Link ek baar
chalti hai, waqt ke baad khatam, aur malik jab chahe rad kar sakta hai.

Link **pehle claim hoti hai** (`usedAt` atomically), phir account banta hai.
Ulta karte to do log ek hi link ek saath khol kar do account bana lete.
Account na bane to link wapas khul jati hai — warna aadmi ke paas na account
hota na chalne wali link.

### Purani ijazat kabhi nahi chhinti

Startup pe backfill purani `['invoices']` ko `invoices:view/create/edit/delete`
me badal deta hai. **Aur `userCan()` bhi purane roop ko samajhta hai** —
backfill kisi wajah se na chale to bhi kaam nahi rukta.

> Niyam: format badalne se kisi ka haq **CHHIN nahi sakta**. Chupchaap kam kar
> dena sabse bura hota — agli subah munshi bill nahi bana pata aur wajah
> kahin likhi nahi hoti.

### Naya route jodte waqt

```js
router.get('/',    requirePermission('invoices:view'),   ctrl.list);
router.post('/',   requirePermission('invoices:create'), ctrl.create);
router.put('/:id', requirePermission('invoices:edit'),   ctrl.update);
router.delete('/:id', requirePermission('invoices:delete'), ctrl.remove);
```

Aur list wali service me `viewer` (yaani `req.user`) zaroor bhejna — warna
hadd lagti hi nahi aur "sirf apna kaam" sirf dikhawa reh jata hai.

**Dhyan:** "dekhne" aur "karne" wale page alag hote hain. `/khata` hisaab
DEKHNE ka hai (`khata:view`), `/payments` paisa ENTRY karne ka
(`khata:create`). Ek hi module ki ijazat dono pe laga dene se salesman ko
payment ka page bhi khul jata tha — ye galti test me pakdi gayi thi.

## Aage ke parts

**11 part + mobile-first UI + sub-account system ban chuka hai (upar "UI ka niyam" aur "Sub-account" dekhein).**

### Production pe jaane se pehle — ye baaki hai

| 🔴 Zaroori | Kyun |
|---|---|
| **Forgot password** | Abhi hai hi nahi. Retailer password bhool gaya to hamesha ke liye bahar |
| **Login pe rate limiting** | Koi bhi hazaar password try kar sakta hai |
| **`helmet`** | Security headers nahi lage |

| 🟠 Deploy karte waqt | Kyun |
|---|---|
| Cloudinary | Bina uske images `uploads/` me jaati hain aur deploy pe gayab ho jaati hain |
| MongoDB backup | Atlas pe automatic backup on kar dijiye |
| Error tracking | Abhi sirf server console me dikhta hai |

| 🟡 Aage ke feature | |
|---|---|
| WhatsApp pe bill/reminder | Notification se zyada log dekhte hain |
| Bank statement se UPI auto-match | Confirm manual karna na pade |
| E-way bill | Bade order pe zaroori hota hai |
| Offline mode | Dukaan me net chala jata hai |
