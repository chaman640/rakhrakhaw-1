# Batch B — dono taraf ka data jud gaya

Aapki list ke **5 item** (23, 11, 7, 16, 15).

---

## 11 · Kharidne wale aur bechne wale ka data ab juda hua hai

Ab tak dono ke beech koi **taar hi nahi tha**. Bechne wale ne bill banaya, aur
kharidne wale ke yahan ek purchase ban gayi — par dono ko pata hi nahi tha ki
wo ek hi lena-den hain. Kharidaar ki purchase pe sirf supplier ka bill number
likha hota tha, ek khali text ki tarah.

Ab taar **dono taraf** jata hai:

- **Bechne wale ko** bill pe dikhta hai: *"Kharidaar ne ye maal apne stock me
  daal liya hai"* — ya *"abhi baaki hai"*. Ye uska rozana ka sawal tha aur
  jawab app me tha hi, bas doosri dukaan ke andar, jahan wo dekh nahi sakta tha.
- **Kharidne wale ko** purchase pe dikhta hai: *"Sharma Traders ke bill
  INV/2026/41 se aaya"*.

**Jo jaan-boojh kar nahi diya:** doosri dukaan ka bill khud khulta nahi. Wo
uska kagaz hai — usme rate, discount aur uske apne hisaab hain. Naam aur number
kaafi hai; aage ki baat phone pe hoti hai, app me nahi.

## 23 · Bill banate banate naya item

Counter pe aadha kaam **offline retailer** ka hota hai — wo saamne khada hai,
maal utha chuka hai. Usi waqt pata chalta hai ki item ki entry app me hai hi nahi.

Ab tak: bill chhodo → Items page → item banao → wapas aao → bill **dobara**
shuru karo, kyunki adhoora bill kahin bachta hi nahi tha. Isliye dukaandaar us
item ko kisi milte-julte item pe bill kar deta tha, ya bill hi kagaz pe bana leta
tha — dono se stock aur hisaab galat.

Ab item box me hi **"Naya item banayein"** aa jata hai. Sirf naam zaroori hai;
banate hi usi row me chipak jata hai. Stock 0 se shuru hota hai — ginti baad me.

## 7 · Bill pe kharidaar ki detail

Link se juda hua retailer sirf **naam aur number** deta hai, pata kabhi nahi.
Bill ban jata tha, chhap bhi jata tha, aur adhoora hi chala jata tha — galti CA
ke paas mahine baad pakdi jati thi.

Ab bill ke saath hi likha hota hai ki kya chhoot raha hai, aur **"Detail bhar
dein"** ka rasta wahin khulta hai.

**Bill rokte nahi hain** — bahut si dukaano ka kaam bina pate ke hi chalta hai,
aur bill rok dena us se bada nuksan hai. Aur warning bill ke **snapshot** se
banti hai: pata ab bharenge to *purana* bill nahi badlega (bill ek jama hua
kagaz hai), par aage ke sab bill poore banenge.

## 16 · "Is mahine kitna kharida" Home pe

Dashboard poori tarah **bechne** ki taraf jhuka hua tha — sale, munafa, udhaar,
stock. Kharid ka number kahin tha hi nahi, jabki *"is mahine maal me kitna paisa
lagaya"* utna hi rozana ka sawal hai.

Ye **sale ke saamne** ka number hai, munafe me se ghatne wala nahi. Aaj ₹1 lakh
ka maal kharida aur kuch nahi becha — nuksaan nahi hua, paisa maal me badal gaya.
Lagat tabhi ginti hai jab wo maal bikta hai.

Salesman ko ye nahi dikhta — *"is mahine ₹4 lakh ka maal aaya"* se dukaan ka
poora paimana pata chal jata hai, aur wo kharid karta hi nahi.

## 15 · Bill pe time

Ek hi din ke chaar bill me se "wo wala" pehchanna nahi ho pata tha — teeno pe
bas *"22 Aug 2026"*. Jhagda hone pe yahi sabse pehla sawal hota hai.

Ab bill aur credit note, dono pe tareekh ke saath **time** bhi. Time **bill ki
tareekh** ka hai, entry ka nahi — kal ki tareekh ka bill aaj banaya ho to kagaz
pe wahi chhapna chahiye jo bill ki tareekh hai.

---

## Test

```
119 selfcheck pass    (Batch A ke baad 108 the — 11 naye)
i18n 100%
smoke me Batch B ka poora rasta chalta hai
```

Ek jaanch khaas taur pe rakhi hai: **doosri dukaan ka bill khud nahi jata** —
sirf naam aur number. Wo rok galti se toot na jaye, isliye uska apna test hai.

---

## Chalane ka tarika

```bash
unzip -o rakhrakhav-batch-b.zip -d rakhrakhav
cd rakhrakhav
bash setup.sh
```

Purana data waisa hi chalta rahega. Naye do khaane (`sourceInvoiceId`,
`sourceBusinessId`) purani purchase pe khali rehte hain — aur wahi theek hai,
unka doosra sira hai hi nahi.

## Ab bacha Batch C

`9` item ka photo/MRP/code/category/warranty · `21` CA wali PDF ledger ·
`22` staff ko sirf apna kaam · `24` ek phone pe ek account

Aur wo ek cheez jo Batch A me chhodi thi — **kharid ke saath diya hua paisa
Payment list me nahi dikhta** — ab uske aas-paas ka kaam ho chuka hai, to wo
Batch C me saath le lenge.
