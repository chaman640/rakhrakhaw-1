# Step 1 — neev: domain, policy ke kagaz, aur paise ka switch

Poora kaam **4 step** me hoga. Ye pehla hai.

| Step | Kya |
|---|---|
| **1 — abhi** | `rakhrakhav.in` · policy ke 6 page · `BILLING_MODE` switch · plan aur seat ki ginti · bechne ka darwaza |
| **2** | Razorpay — checkout, webhook, renew, rasid. `.env` me key daali, chalu. |
| **3** | OTP APITxT se · phone pe notification (jaise YouTube ki aati hai) · har cheez ka alert |
| **4** | 1 lakh user — index, query ka budget, cache, rate limit, database ka bill kaabu me |

---

## 1 · Domain — rakhrakhav.in

Meta tags, canonical, WhatsApp pe share hone wala card, policy ke kagaz, support ka
email — sab `rakhrakhav.in` pe. Live pe `.env` me itna:

```
CLIENT_URL=https://rakhrakhav.in
PUBLIC_URL=https://rakhrakhav.in
```

## 2 · Policy ke 6 page — **bina login ke**

`/privacy` · `/terms` · `/refund` · `/delivery` · `/contact` · `/pricing`

**Ye pehre se bahar hain, aur yahi in page ki sabse zaroori baat hai.** Razorpay
merchant account manzoor karne se pehle in page ko **khud kholta hai**. Login
maangne wala page unke liye maujood hi nahi hai — aur wahi application ruk jane
ki sabse aam wajah hoti hai, jiski wajah bhi aksar nahi batayi jati.

Har page pe sampark aur website apne aap neeche aa jate hain (`PolicyShell` se),
isliye kisi page pe chhoot nahi sakta. Login/signup ke neeche bhi inke link hain
— gateway ye dekhta hai ki kagaz site se **pahunche ja sakte** hain, sirf maujood
hona kaafi nahi.

Refund policy me har haalat ka **saaf jawab** hai — "case by case dekha jayega"
jaisi baat likhne se application ruk jati hai. 7 din poori wapasi, uske baad
chalu mahina nahi, dohri katauti par poora paisa.

> **Ek baat khul kar:** ye kagaz maine seedhi bhasha me likhe hain aur inme wahi
> likha hai jo app me sach me hota hai. Par ye **kanooni kagaz** hain — inhe ek
> baar apne CA ya wakil se dikhwa lijiye, khaas kar company ka poora naam, pata
> aur GSTIN wala hissa (wo `.env` se aata hai, abhi khali hai).

## 3 · Paise ka switch — `BILLING_MODE`

Bilkul `NODE_ENV` jaisa. Ek line, aur bas:

```
BILLING_MODE=free    # aaj jaisa hi — sab kuch, sabke liye khula
BILLING_MODE=paid    # bechne wala hissa plan maangega
```

Na koi migration, na database ka kaam, na code me haath. **Abhi `free` hai**,
isliye aaj kuch nahi badla — par jis din aap `paid` karenge, us din kuch "shuru"
nahi karna padega.

Galat shabd likhne par server **saaf error** deta hai, chup-chaap `free` nahi
maan leta. Wo sabse khatarnak jawab hota: aap `BILLING_MODE=chalu` likh kar
nishchint ho jate aur mahino tak sabko sab muft milta rehta.

### Kaun sa hissa paise maangta hai

```
BECHNE WALA (apna stock, bill, graahak)  ->  PLAN
KHAREEDNE WALA (maal dekhna, order)      ->  HAMESHA FREE
```

Ye soch-samajh kar hai, shortcut nahi. Retailer se paisa maangna poore dhande ko
maar deta hai: wholesaler app isliye leta hai ki uske retailer usme aayein aur
uska maal dekhein. Retailer ko paisa dena pada to wo aayega hi nahi — aur
wholesaler ke liye app ka matlab khatam. **Retailer ka free hona wholesaler ki hi
zarurat hai, uspe ehsaan nahi.**

Aur jis din wahi retailer khud bechna chahe — us din wo bechne wala ban gaya, tab
plan lagega. Line saaf hai: *"dekhna free hai, bechna nahi"*.

## 4 · Plan aur account ki ginti

| Plan | Account | Daam |
|---|---|---|
| Chhoti dukaan | 3 (aap + 2 staff) | ₹50 / mahina |
| Badhti dukaan | 10 | ₹100 / mahina |
| Badi dukaan | 20 | ₹500 / mahina |
| Aseem | jitne chahein | ₹2000 / mahina |

**Ginti LOGIN karne walon ki hai — aap khud bhi usme gine jate hain.** Retailer
is ginti me kabhi nahi aate, chahe hazaar hon; wo graahak hain, dukaan ke apne
log nahi. Band kiye hue staff bhi nahi ginte.

Seat poori hone par error ke saath **agla plan bhi** jata hai — "₹100 me 10
account" — taaki wo pal rukawat ki jagah faisla ban jaye.

## 5 · Mohlat khatam hone par kya hota hai

- **7 din ki mohlat** (grace) — sab chalta rehta hai, bas yaad dilaya jata hai.
  Payment fail hona aam hai; us ek pal me dukaan band kar dena sabse bura jawab
  hai, jab bill beech me ruka ho aur graahak saamne khada ho.
- Uske baad bechna rukta hai. **Kharidna phir bhi chalta hai.**
- Screen pe do baatein sabse upar likhi jati hain: *"kharidna ab bhi free hai"*
  aur *"aapka poora data surakshit hai"*. Doosri isliye ki "plan khatam" padhte
  hi pehla dar yahi hota hai ki saara hisaab gaya.

Haalat **tareekh se nikalti hai**, kisi field se nahi — koi cron nahi. Cron ek
din na chale to ya sabki dukaan band ho jati hai, ya kisi ki bhi nahi.

---

## Test

```
179 selfcheck pass    (Batch C ke baad 142 the — 37 naye)
app ke shabd: i18n 100%
kanooni kagaz: 120 line abhi Hinglish me — inka anuvaad AADMI se karwana hai
```

Do jaanch khaas taur pe rakhi hain:

1. **Kharidne wala hissa galti se ruk to nahi gaya** — ye ek line se ho sakta
   hai aur poore dhande ko maar deta hai, isliye har buy-side route ka apna test.
2. **Billing ka rasta khud plan nahi maangta** — jiska plan khatam hua hai use
   andar aakar plan lena hai. Usi aadmi ko rok dena wo bug hai jisme system khud
   ko band kar leta hai, aur wo tab pakda jata hai jab pehla graahak paisa nahi
   de paata.

Aur ek cheez maine jaan-boojh kar ki: **kanooni kagaz ki 120 line anuvaad ki
ginti se bahar rakhi hai.** Machine se kiya hua refund policy ka anuvaad sirf
adhoora feature nahi — wo seedha kanooni zimmedari hai. Wo line ab alag se
chhapti hai, chhupti nahi.

---

## Chalane ka tarika

```bash
unzip -o rakhrakhav-step-b1.zip -d rakhrakhav
cd rakhrakhav
bash setup.sh
```

`server/.env` me kuch bhi bharna zaroori **nahi** — sab default `free` pe chalta
hai, bilkul aaj jaisa.

Paid dekhna ho to `server/.env` me `BILLING_MODE=paid` kar ke server dobara
chalayein. (Abhi paisa lene ka rasta nahi bana hai — wo Step 2 hai — isliye us
halat me plan lena mumkin nahi hoga, sirf rok dikhegi.)

---

## Step 2 me kya aayega

Razorpay: checkout, webhook se pakka karna ki paisa sach me aaya, plan chalu
karna, renew, rasid. `.env` me `RAZORPAY_KEY_ID` aur `RAZORPAY_KEY_SECRET` daala,
aur system chalu — jaisa aapne kaha.
