# Poora system check — kya jaancha, kya mila, kya theek kiya

Ye Part 17 (teeno step) ke baad ka poora cross-check hai — server se client tak.

**Nateeja: 4 asli bug mile, chaaron theek kar diye.** Teen unme se aise the jo
screen pe dikhte hi nahi — sirf hisaab me pata chalte, wo bhi mahino baad.

---

## Bug 1 — Bill ke NEECHE wala discount raste me gir jata tha  🔴 paisa

**Kahan:** `server/src/services/intake.service.js`

**Kya hota tha:** Bill pe do tarah ke discount ho sakte hain — line ka apna,
aur poore bill ke neeche wala (`extraDiscount`). Doosra wala har line ke
`taxableValue` me se ghat jata hai, par line ke `discount` khaane me **kabhi
likha nahi jata**. Intake seedha `l.discount` uthata tha — yaani neeche wala
discount gayab.

**Nuksan:** Bada wholesaler ₹9,000 ka bill deta, aur kharidne wale ke yahan
**₹10,000 ki purchase** ban jati. Supplier ke khate me bhi ₹1,000 zyada chadh
jata. Screen pe sab theek dikhta — farak sirf khata milate waqt pakda jata.

**Theek kaise:** Discount ab `qty × rate − taxableValue` se nikalta hai — wo
hamesha POORA discount hota hai, dono milakar. Ab purchase ka jod bill se poora
milta hai.

**Dobara na ho isliye:** line banane wala hissa ab alag function hai
(`lineFromInvoiceItem`) aur `npm run check` me uske 6 test hain — jisme neeche
wale discount wala mamla bhi hai.

---

## Bug 2 — Invoice pe `taxTotal` naam ka khaana hai hi nahi  🟠

**Kahan:** `server/src/services/intake.service.js`

**Kya hota tha:** `invoice.taxTotal` padha ja raha tha. Invoice pe wo field hai
hi nahi — wahan **teen** alag hain (`cgstTotal`, `sgstTotal`, `igstTotal`),
kyunki bill pe teenon alag chhapte hain. Jawab hamesha `undefined` → chup-chaap
0.

**Nuksan:** Bina GST wale dukaandaar ko "GST aapki lagat me jud gaya hai" wali
zaroori baat kabhi dikhti hi nahi thi — bina kisi error ke.

**Theek kaise:** Teenon jod kar.

---

## Bug 3 — Save hatate hi dukaan se BAHAR phenk deta tha  🟠

**Kahan:** `client/src/context/ShopContext.jsx` + `pages/buy/ShopSearch.jsx`

**Kya hota tha:** App sirf **save ki hui** dukaanein laati thi. Dukaan ke page pe
bookmark hatate hi wo list se gayab, phir ek jaanch use "ab judi hi nahi" maan
kar chunaav chhod deti — aur aadmi us dukaan se bahar, cache saaf.

**Theek kaise:** Ab **saari judi hui** dukaanein aati hain. Save ka matlab sirf
itna hai ki wo **search wali list** me dikhe ya nahi. Judna aur save karna do
alag baatein hain, aur ab code me bhi alag hain. Neeche ek line bhi likhi rehti
hai: "{n} aur dukaan judi hai jo save nahi hai — uska khata aur bill waise ke
waise hain."

---

## Bug 4 — Cart pe har 20 second me wahi toast  🟠

**Kahan:** `client/src/pages/retailer/Cart.jsx`

**Kya hota tha:** "Rate badal gaya / stock kam hai" wali chetavni toast me
dikhti thi, aur ye page har 20 second me apne aap taaza hota hai — to har bees
second me wahi teen toast dobara upar aa jate the.

**Theek kaise:** Chetavni ab upar ek dabbe me likhi rehti hai — hamesha dikhti
hai, par apni jagah baithi rehti hai. Toast us cheez ke liye hai jo **abhi hui**
ho; ye us cheez ke liye hai jo **abhi sach** hai.

---

## Ek aur sudhaar (bug nahi, par dhokha tha)

Intake me "Bechne ka rate" `salePrice` pe lagta hai. Par jis item pe alag se
**wholesale rate** laga ho, uske retailer ko wahi dikhta hai — yaani jo number
abhi likha ja raha hai wo unhe dikhta hi nahi. Us rate ko chup-chaap badal dena
isse bhi bura hota. Ab na badalte hain, na chhupate hain — screen saaf bata deti
hai ki wholesale rate kitna laga hai aur kahan se badlega.

---

## Kya kya jaancha (aur saaf nikla)

**Server**

- Har naya query **businessId se bandha** hai ya nahi — Item, Cart, Party,
  Order, Invoice, Purchase, StockIntake. Ek bhi jagah doosri dukaan ka data
  nikal sakne wali query nahi mili.
- ObjectId ki tulna kahin `===` se nahi ho rahi (wo hamesha chup-chaap `false`
  deti hai).
- Har route ka pehra: `requireBuyer`, `withBuyerTenant`, `requirePermission`.
  Salesman/CA/cashier khareed nahi sakte; godown incharge sakta hai.
- `/count` jaise raste `/:id` se **pehle** likhe hain (warna `/:id` unhe kha
  jata).
- Do tap ek saath: intake `finish` status pehle pakadta hai, gadbad pe wapas
  PENDING; `connect` aur intake dono pe unique index; Party banane pe 11000 ka
  ilaaj.
- Import ka koi chakkar (cycle) nahi — poora module graph load hota hai.
- Server bina database ke bhi boot hota hai, aur `/shops`, `/buy`, `/stock-intake`
  teeno bina token ke 401 dete hain.

**Client**

- **Hook ka kram** — har page pe saare hook kisi bhi `return` se pehle. Ye sabse
  bada khatra tha (ek galat kram = safed page); ek bhi jagah galat nahi mila.
- **Anant loop** — har `useEffect` ki dependency jaanchi. Jo function deps me
  hain wo sab `useCallback` me hain; jo array deps me hain wo cache se aate hain
  (identity nahi badalti). Koi loop nahi.
- UI component ke prop uski asli signature se milate gaye (Button, Card, Input,
  Select, Modal, Chips, QtyStepper, Badge, Textarea, EmptyState, Pagination).
- Cart me har request apni dukaan ka header khud bhejti hai, aur global header
  uspe **nahi chadhta** — teeno dukaan ki quantity alag alag rehti hai.
- Har istemal hua naam import bhi hua hai (`check-imports`), aur screen ka har
  shabd anuvaad se guzarta hai (`check-i18n` — 100%).

---

## Test

```bash
npm run check      # bina database ke — 68 jaanch (pehle 61 thi)
npm run smoke      # asli database pe poora flow
```

`npm run smoke` me ab bill ke neeche wala discount bhi daala jata hai, taaki
Bug 1 asli database pe bhi dobara pakda ja sake ("purchase ka jod bill se milta
hai").

**Sab pass:** 68/68 self check · i18n 100% · build clean · zip nikal kar dobara
install + build karke bhi verify kiya.
