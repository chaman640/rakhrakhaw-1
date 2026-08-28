# Batch C — item ki pehchan, CA wala kagaz, staff ki hadd, ek phone ek login

Aapki list ke **4 item** (9, 21, 22, 24) — aur Batch A me chhoda hua ek kaam bhi.

---

## 9 · Item ki poori pehchan — wahin, maal aate waqt

Photo, MRP, apna code, category, company aur warranty ab **stock intake me hi**
bhare ja sakte hain.

Wajah seedhi hai: **yahi wo ek pal hai jab ye sab saamne hota hai.** Dabba haath
me hai, uspe MRP chhapa hai, company ka naam likha hai, warranty ka card andar
pada hai. Baad me Items page pe jaakar ye bharna kisi ne kabhi nahi kiya — aur us
se do cheezein hoti thin: MRP ke bina bechte waqt "kitne me dena hai" ka koi
sahara nahi rehta, aur warranty ka jhagda mahine baad hota hai jab kuch likha hi
nahi hota.

Khaane **chhupe rakhe hain** — ek tap me khulte hain. Maal aane par dukaandaar
jaldi me hota hai; das khaane ek saath dikhna use poora kaam hi rok dene par
majboor kar deta hai.

**Ek rok khaas hai:** purane item pe sirf **khali khaane** bharte hain. Uska
pehle se bhara hua MRP ya warranty upar se likh dena seedha nuksan hai — wo
soch-samajh kar bhara gaya tha, aur ye supplier ki parchi se aaya andaza hai.

## 21 · CA wala khata (PDF)

Khata ab CA ki apni shakal me nikalta hai — **Statement of Account**, Dr/Cr ke
saath. Party page pe bhi, retailer ke "Mera Khata" pe bhi.

"Print" pehle bhi tha, par wo **poore page** ka print tha: filter ke dabbe,
button, menu — sab kagaz pe chale jate the. CA aisa kagaz wapas kar deta hai.

Ab kagaz me wahi teen cheezein hain jo CA maangta hai:

- **Opening + Debit − Credit = Closing**, kagaz pe hi jud jata hai
- **Vch Type aur Vch No alag khaane** — CA isi number se dono taraf milaata hai
- **Dr / Cr**, "−4,500" nahi — hisaab ki duniya me minus ka matlab hi ye do akshar hain

Baaki rakam **shabdon me** bhi likhi hoti hai. Aur agar entry limit se kat gayi
hon to **kagaz pe hi likha jata hai** ki kitni chhupi hain — adhoora kagaz galat
kagaz se khatarnak hai, kyunki wo galat nahi lagta.

Koi nayi PDF library nahi daali. Browser ka apna **Print → Save as PDF** — har
phone aur computer pe pehle se maujood, aur bill ka kagaz bhi isi tarah banta hai.

## 22 · Staff ko sirf apna kaam

`reports:view` **ek hi chaabi** thi jo saari report khol deti thi. Yaani counter
wale ladke ko, jise sirf paisa lena-dena karna hai, dukaan ka **poora munafa aur
har item ki lagat** dikh jati thi. Wahi ek number koi bhi dukaandaar apne staff
ko nahi dikhana chahta — aur wo apne aap khula pada tha.

Ab munafa aur stock, dono **`reports:profit`** naam ki alag chaabi maangte hain.
Stock bhi isliye ki usme har item ki lagat hoti hai — ek darwaza band karke doosra
khula chhod dena band karne ka natak hai.

Malik chahe to kisi ko bhi de sakta hai — bas ab wo ek **socha hua faisla** hai,
"reports dekhne do" ka side-effect nahi. CSV download bhi wahi rok maanta hai.

## 24 · Ek number, ek jagah

Ek hi login teen-chaar phone pe chalta rehta tha. Password badalna bhi kaam nahi
aata tha — purane phone ka token phir bhi chalta rehta, kyunki wo ek baar ban kar
apni mohlat tak zinda rehta hai.

Ab har naya login purane phone ko **usi pal bahar** kar deta hai.

**Aur wajah bhi batayi jati hai** — ye us fix se bhi zyada zaroori nikla. Bina
wajah bataye aadmi khud ko achanak login page pe khada paata hai, sochta hai app
kharab hai, dobara login karta hai — aur **doosra phone bahar ho jata hai.** Do
log baari baari ek doosre ko bahar karte rehte, aur kisi ko samajh na aata ki ho
kya raha hai. Ab login page pe saaf likha aata hai.

**Purane token bina wajah nahi tootte.** Is fix se pehle bane token me ye ginti
hai hi nahi; unhe rokte to update lagte hi har chalu login ek saath toot jata.
Wo apni mohlat khatam hone par khud jayenge.

---

## Aur wo kaam jo Batch A me chhoda tha

**Kharid ke saath diya hua paisa ab Payment list me dikhta hai.** Pehle uski sirf
khata entry banti thi, Payment ka record nahi — isliye supplier ko diya hua paisa
Payment page pe kabhi dikhta hi nahi tha, aur "aaj kitna paisa gaya" ka jawab
aadha rehta tha.

Purchase mitne par wo payment bhi hat jati hai. Khata **dobara nahi chheda jata**
— warna ek hi credit do baar ulta ho jata.

---

## Test

```
142 selfcheck pass    (Batch B ke baad 119 the — 23 naye)
i18n 100%
smoke me poora rasta chalta hai:
  dobara login -> purana phone apne aap bahar
  kharid ke saath ₹400 -> Payment list me dikha -> kharid miti -> payment bhi hati
```

**Raaste me ek asli bug pakda:** "ek number ek jagah" lagate hi smoke ka apna
purana token beech me mar jata tha — kyunki wo test password badalne ke baad
dobara login karta hai. Yahi asli app me bhi hota: login ke baad **naya token
rakhna zaroori hai**. App wo pehle se karta hai; test use nahi kar raha tha, wo
theek kar diya.

---

## Chalane ka tarika

```bash
unzip -o rakhrakhav-batch-c.zip -d rakhrakhav
cd rakhrakhav
bash setup.sh
```

**Ek baat dhyan me rakhiye:** update lagne ke baad jab aap pehli baar login
karenge, baaki sab phone jahan aapka wahi number chalu tha, wo agli baar khulte
hi login maangenge. Ye wahi cheez hai jo aapne maangi thi — bas pehli baar dekh
kar chaunkiye mat.

---

## Aapki poori list ab khatam

| Batch | Item |
|---|---|
| **A** | 8 · 10 · 12 · 13 · 14 · 18 — paise ka sach |
| **B** | 23 · 11 · 7 · 16 · 15 — dono taraf ka data juda |
| **C** | 9 · 21 · 22 · 24 — pehchan, kagaz, hadd, login |

**17 aur 19** (function-by-function cross-check, aur zyada istemal me sahi rehna)
teeno batch ke saath saath chalte rahe — har batch me poora selfcheck, i18n, aur
zip ko fresh extract karke install + build.
