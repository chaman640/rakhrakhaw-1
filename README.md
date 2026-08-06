# Rakh Rakhav — Wholesaler + Retailer Platform

Wholesaler apna stock, order, invoice aur khata manage kare; uske retailers apne phone se
seedha order karein. Vyapar + Thokmarket ka hybrid.

**Stack:** React (Vite) + Express + MongoDB + Node — JavaScript, ESM.

---

## Ab tak kya bana

### Part 1 — Foundation
- [x] Folder structure (client + server alag)
- [x] **Saara database schema — 14 models ek saath**
- [x] Env config + validation
- [x] Auth / tenant / validation / error middleware
- [x] Base UI layout — sidebar, header, responsive shell
- [x] 13 reusable components

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
- [x] Delete guard — order/bill/payment wali party delete nahi, sirf block

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

---

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

**Delete karne pe kya hota hai:**

1. Allocation ulti — jis bill pe laga tha uska `paidAmount` ghatta hai, `dueAmount` wapas badhta hai
2. Ledger entry hat jati hai aur `Party.balance` ulta ho jata hai
3. Pending payment delete karne pe kuch reverse karne ki zarurat hi nahi (kuch laga hi nahi tha)

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

## Aage ke parts

| Part | Kya banega |
|---|---|
| 10 | Notifications page, sale/stock reports, dashboard summary — **aakhri part** |
