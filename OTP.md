# OTP — signup aur "password bhool gaye"

Do jagah lagta hai. SMS **Fast2SMS** se jata hai.

---

## 1. Chalane se pehle — ek line

`server/.env` me apni key bhar dein (**ek hi line me**, beech me enter nahi):

```
FAST2SMS_API_KEY=aapki-key-yahan
```

Khali chhod dein to bhi sab chalta hai — tab OTP asli SMS ki jagah **server ke
log me** chhapta hai *aur* screen pe ek peele dabbe me dikh jata hai. Isse
signup/forgot-password bina paisa kharch kiye test ho jate hain.

Live (production) pe ye rasta **band** hai: wahan key na ho to saaf error aata
hai, kyunki wahan log me code chhapna sabse bada surakhsa ka ched hoga.

> Aapne key chat me bheji thi — wo ab wahan likhi hai. Fast2SMS dashboard se
> **nayi key bana lein** aur purani hata dein; jo key kahin likhi ja chuki ho
> use badal dena hi theek hota hai.

---

## 2. Kya bana

**Signup (wholesaler aur retailer, dono)** — ab do kadam:
pehle poora form, phir OTP. Verify hote hi account ban jata hai.
Ulta (pehle OTP) jaan-boojh kar nahi rakha: aadmi SMS ka intezaar karta, phir
form bharta, aur beech me OTP ki mohlat khatam ho jati.

**Password bhool gaye** — Login page pe naya link (`/forgot`): number → OTP →
naya password. Pehle iska koi rasta hi nahi tha; password bhoolne ka matlab tha
apne hi app se bahar, aur poora hisaab andar phansa hua.

---

## 3. Rok kya kya lagi hai

| Rok | Kitni | Kyun |
|---|---|---|
| Do SMS ke beech | 60 second | "Dobara bhejein" dabate rehne se paisa aur us number wale ka chain, dono jate hain |
| Ek ghante me | 5 SMS | wahi wajah, badi khidki pe |
| Galat OTP | 5 koshish | 6 ank 10 lakh me se ek hain — ek script minaton me aazma leti |
| OTP zinda rehta | 10 minute | uske baad khud mit jata hai (database ka TTL) |
| Verify ke baad kaam | 15 minute | utni der ka chhota token milta hai |

Aur teen cheezein jo chup-chaap galat ho sakti thin:

- **Code hash me rakha jata hai**, password ki tarah — backup ya log se bahar
  nikal kar bhi kisi kaam ka nahi.
- **Verify hote hi code mit jata hai** — ek code, ek kaam. Zinda chhodne se
  wahi 6 ank baar baar istemal ho sakte the.
- **Token me number bhi likha hota hai** — bina iske koi apna number verify
  karta aur account **kisi aur ke number** pe bana leta.

---

## 4. Test

```bash
npm run check      # 83 jaanch — usme 15 sirf OTP ke
npm run smoke      # asli DB pe: bina OTP signup nahi, galat OTP nahi,
                   # ek number ka OTP doosre pe nahi, password reset poora flow
```

Smoke test asli SMS **nahi** bhejta (paisa nahi lagta) — wo saboot wala token
khud bana leta hai, aur OTP ka apna kanoon alag se jaanchta hai.
