# Batch A — paisa jhooth bol raha tha

Aapki list ke **6 bug** (8, 10, 12, 13, 14, 18). In sab ki **jad ek hi thi**.

---

## Jad kya thi

Ek line me: **jama paisa naye bill pe apne aap nahi lagta tha.**

Bill banate waqt ek tick tha — *"jama paisa is bill me se kaat lein?"*. Wo tick
form me neeche padta tha aur aksar chhoot jata tha. Order se bana bill, ya baad
me aaya paisa — un raston me to wo tick aata hi nahi tha.

Isliye ye halat ban jati thi:

```
graahak ne ₹6,000 ka maal wapas kiya   ->  khata −6,000  (uska paisa hamare paas)
agle din ₹5,000 ka naya bill bana      ->  khata −1,000
                                           bill  ₹5,000 UDHAAR
```

Aur phir teen alag shikayat, jo asal me ek hi cheez thi:

| Aapne kaha | Kya ho raha tha |
|---|---|
| **8** — payment ho gaya phir bhi udhaar | bill khula tha, paisa khate me pada tha |
| **10** — dono ka hisaab alag alag | Home khata dikhata tha, bill page bill dikhata tha |
| **12** — pending hat hi nahi raha | ₹5,000 cash lene jao to app rok deta tha: *"inka koi udhaar baaki nahi hai"* |

---

## Kya theek kiya

### 1. Jama paisa ab APNE AAP lagta hai

Naya bill bane, purani kharid aaye, koi payment ho ya mite — har baar app khud
dekh leta hai ki kisi ka paisa bekaar to nahi pada, aur use khule bill pe laga
deta hai. Retailer ke bill pe bhi, supplier ki kharid pe bhi.

Tick ab bhi hai, par **ulta**: `keepAdvance` — *"nahi, jama hi rehne do"*. Wo ek
soch-samajh kar liya gaya faisla hai, dhyan chook jane wali cheez nahi.

Iska matlab ab hamesha yahi sach rahega:

```
bill khula hai   =>  khate me utna paisa lena hai
paisa jama hai   =>  koi bill khula nahi
```
**Dono ek saath ho hi nahi sakte.** Isliye do page pe do number ab mumkin hi nahi.

### 2. "Kitna baaki hai" ka ek hi darwaza

Naya `balance.service.js` — poore app me ye sawal sirf yahin se poochha jata hai.
Home, Payments, Khata, Mera Khata, retailer ka Home — sab wahi ek jawab lete hain,
aur wahi ek dabba (`HisaabCard`) use dikhata hai.

Bada number upar, aur ek tap me poori tod-phod:
**kitna khule bill ka · kitna purana hisaab · kitna jama**

### 3. Purana bigda hua data khud theek ho jata hai

Koi migration nahi chalani. Jis party pe bhi koi paisa hilta hai — bill, payment,
wapasi, kuch bhi — uska hisaab usi waqt seedha ho jata hai. Chup-chaap.

### 4. Jama paisa **kiska** aur **kahan se** (13)

Ab har jagah likha hota hai: *"₹1,000 jama · CN-14 (maal wapas) ₹600 · PAY-31 ₹400"*.
Retailer ke Home pe **dukaan ka naam** bhi — buy mode ke baad ek retailer kai
dukaano se maal leta hai, to "jama hai" bina naam ke bekaar tha.

### 5. "Dena hai" wali list (14)

Payments page pe teesra tab. Naam, rakam, aur paisa aaya kahan se — sab ek jagah.
Aur teeno tab ke naam **ab anuvaad hote hain** — pehle wo seedhe likhe the,
isliye English chun kar bhi Hinglish me hi khade rehte the. Yahi aapne kaha tha.

### 6. Wapasi ka paisa wapas (18)

Credit note kholiye → **"Paisa wapas karein"**. Cash, UPI ya bank.

Teen rok lagti hain: jitna bill pe lag chuka wo wapas nahi hoga, ek hi wapasi ka
paisa dobara nahi jayega, aur jitna jama hai us se zyada kabhi nahi.

---

## Raaste me mile purane bug (ye bhi theek kiye)

| Kya | Kahan |
|---|---|
| Retailer Home aur Mera Khata ke "Aapko dena hai / Advance jama hai" anuvaad hote hi nahi the | dono page |
| Payment page ke tab ke naam anuvaad hote hi nahi the | Payments |
| Bill form ka "Udhaar jayega / Poora mil gaya" anuvaad hota hi nahi tha | InvoiceForm |
| Retailer paisa bhejta tha to Mera Khata turant badalta tha par **Home purana number 20 second tak dikhata rehta tha** | MyKhata |
| Wapasi ke page se kuch badle to Payments list purani reh jati thi | Returns |
| Khate me ULTA opening balance (app se pehle ka jama paisa) kabhi kisi bill pe lagta hi nahi tha | balance.service |

---

## Test

```
108 selfcheck pass    (pehle 83 the — 25 naye, sab isi hisaab ke)
i18n 100%
smoke me poora natak chalta hai:
  ₹6,000 wapas -> ₹5,000 ka naya bill -> apne aap chukta
  -> "dena hai" me ₹1,000 -> bill cancel -> poora ₹6,000 wapas jama
  -> Home aur Payments ka number ek hi
```

Sabse zaroori jaanch — **wo jod jis pe sab tika hai**:

```
jo paisa aaya par bill pe laga nahi  =  khule bill − khata + purana hisaab
```

Seedha `−khata` dekhna kaafi nahi tha (upar wale case me wo sirf ₹1,000 batata,
₹6,000 nahi) — yahi wo ek chook thi jo poora Batch A ban gayi.

---

## Chalane ka tarika

```bash
unzip -o rakhrakhav-batch-a.zip -d rakhrakhav
cd rakhrakhav
bash setup.sh
```

`server/.env` waisa hi rehta hai — koi nayi setting nahi chahiye.
`FAST2SMS_API_KEY` bhi waisa hi.

## Abhi bacha kya hai

**Batch B** — 23 (bill se retailer ki purchase apne aap) · 11 (dono taraf ka data
jud jaye) · 7 (bill pe kharidaar ki detail) · 16 ("is mahine kitna kharida") · 15 (bill pe time)

**Batch C** — 9 (item ka photo/MRP/code/warranty) · 21 (CA wali PDF) · 22 (staff ko
sirf apna kaam) · 24 (ek phone pe ek account)

Ek cheez jaan-boojh kar chhodi hai: **kharid ke saath diya hua paisa Payment list
me nahi dikhta** (uski sirf khata entry banti hai, Payment record nahi). Wo theek
karne me purchase delete wala rasta bhi badalna padta — isliye wo Batch B me,
jahan uske aas-paas ka kaam waise bhi hona hai.
