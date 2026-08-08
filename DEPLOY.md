# Render pe live karna — poora tarika

Ab client aur server **ek hi URL** pe chalte hain. Matlab Render pe sirf **ek service** banani hai,
do nahi. Jo link banega wahi teacher ko dikha dijiye:

```
https://rakhrakhav.onrender.com          → app khul jayega
https://rakhrakhav.onrender.com/api/...  → API usi URL pe
```

Poora kaam **25-30 minute** ka hai. Teen padaav: database → code GitHub pe → Render.

---

## Padaav 1 — MongoDB Atlas (free)

Render ke paas database nahi hota, wo alag se lena padta hai. Atlas ka free plan kaafi hai.

1. [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) pe free account banayein
2. **Create → M0 (FREE)** cluster · region **Mumbai** ya **Singapore**
3. **Database Access** → Add New Database User
   - username: `rakhrakhav`
   - password: **Autogenerate** dabakar copy kar lein (kahin likh lein, dobara nahi dikhega)
4. **Network Access** → Add IP Address → **Allow Access from Anywhere** (`0.0.0.0/0`)
   > Render ka IP badalta rehta hai, isliye ye zaroori hai. User + password se hi suraksha hai.
5. **Database → Connect → Drivers** → connection string copy karein:

```
mongodb+srv://rakhrakhav:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

**Do cheezein isme badalni hain:**

- `<password>` ki jagah asli password
- `.net/` ke turant baad database ka naam `rakhrakhav` daalein

Theek karne ke baad aisa dikhna chahiye:

```
mongodb+srv://rakhrakhav:AbCd1234@cluster0.xxxxx.mongodb.net/rakhrakhav?retryWrites=true&w=majority
                                                             ^^^^^^^^^^ ye naam zaroori hai
```

> Database ka naam na dein to Mongo `test` naam ka database bana deta hai — chalega to sahi,
> par baad me dhoondhne me dikkat hoti hai.

---

## Padaav 2 — Code GitHub pe

Render GitHub se hi deploy karta hai.

1. [github.com/new](https://github.com/new) pe naya repo banayein — naam `rakhrakhav`,
   **Private** rakh sakte hain. README/gitignore **mat** jodein (hamare paas pehle se hai).

2. Terminal me:

```bash
cd ~/Desktop/rakhrakhav

git init
git add .
git commit -m "Rakh Rakhav — wholesaler platform"
git branch -M main
git remote add origin https://github.com/AAPKA-USERNAME/rakhrakhav.git
git push -u origin main
```

> `.gitignore` pehle se laga hai — `node_modules`, `.env` aur `client/dist` GitHub pe **nahi**
> jayenge. Aapka MONGO_URI aur JWT_SECRET surakshit hain.

Push ke baad ek baar GitHub pe kholkar dekh lein ki `.env` **kahin nahi dikh rahi**.

---

## Padaav 3 — Render

1. [render.com](https://render.com) pe GitHub se sign up karein (free)
2. **New +** → **Blueprint**
3. Apna `rakhrakhav` repo chunein → Render `render.yaml` khud padh lega
4. **Apply** dabayein

Render ab poochhega ki ye value bharein:

| Kya | Kya daalein |
|---|---|
| `MONGO_URI` | Padaav 1 wali poori connection string |
| `CLOUDINARY_CLOUD_NAME` | Neeche dekhein (abhi khali bhi chalega) |
| `CLOUDINARY_API_KEY` | 〃 |
| `CLOUDINARY_API_SECRET` | 〃 |

`JWT_SECRET` Render **khud bana dega** — aapko kuch nahi karna.

Pehla deploy **5-10 minute** leta hai (dono ka npm install + client ka build). Log me
`[server] production mode` dikhe to samajh lijiye ho gaya.

Aapka link upar dikhega: `https://rakhrakhav-xxxx.onrender.com`

---

## Photos ke liye Cloudinary (5 minute — production me zaroori)

Render ki disk **har deploy pe saaf ho jati hai**. Bina Cloudinary ke item aur logo ki photos
kuch din baad gayab ho jayengi.

1. [cloudinary.com](https://cloudinary.com) pe free account
2. Dashboard pe **Cloud name**, **API Key**, **API Secret** milenge
3. Render → aapki service → **Environment** → teeno bhar dein → **Save** (khud redeploy hoga)

Teacher ko dikhane bhar ke liye khali chhod sakte hain — photos tab tak chalengi.

---

## Free plan ki ek baat pehle se jaan lein

Render ka free plan **15 minute koi na aaye to service so jati hai**. Uske baad pehli baar
kholne pe **40-60 second** lagte hain, phir normal.

**Teacher ko dikhane se 2 minute pehle ek baar link khol lijiye** — jag jayegi, phir turant chalegi.

---

## Sab theek hai ya nahi — 2 minute me check

| Kholein | Kya aana chahiye |
|---|---|
| `https://aapka-link.onrender.com/api/health` | `{"success":true,"message":"API zinda hai"...}` |
| `https://aapka-link.onrender.com` | Login page |
| Signup karke Settings → Invite link | Link me **aapka Render wala URL** ho, `localhost` nahi |

Teesra sabse zaroori hai — wahi batata hai ki app ne apna URL sahi pehchana.

---

## Kuch atak jaye to

**Build fail — "Cannot find module"**
`package.json` root me commit hui hai? `git status` chalakar dekhein.

**App khulta hai par sab jagah error**
Mongo nahi juda. Render → Logs me `MongoServerError` dikhega. Do cheezein dekhein:
Atlas me Network Access `0.0.0.0/0` hai kya, aur `MONGO_URI` me password sahi hai kya
(password me `@` ya `#` ho to URL-encode karna padta hai).

**Invite link me `localhost:5173` aa raha hai**
Render ke Environment me `CLIENT_URL` galti se set hai. Use **delete** kar dein — app khud
sahi URL pata kar lega.

**Page refresh karne pe 404**
Aisa nahi hona chahiye (SPA fallback laga hua hai). Aaye to matlab client ka build nahi bana —
Render ke build log me `vite build` dhoondhein.

**Blueprint apply karte waqt region wali error**
`render.yaml` me `region: singapore` likha hai. Aapke account pe wo region na ho to us line
ko hata dein (ya `oregon` kar dein) aur dobara push karein.

**Deploy "live" nahi ho raha, log me `MongoDB connection failed`**
Log me neeche 3 wajah likhi aati hain — wahi padh lijiye. Jab tak Mongo nahi judta,
server chalu hi nahi hota, isliye Render use fail maan leta hai.

---

## Aage code badla to

```bash
git add .
git commit -m "kya badla"
git push
```

Render khud deploy kar dega. Kuch aur karne ki zarurat nahi.

---

## Local pe wahi cheez chala kar dekhni ho

```bash
cd ~/Desktop/rakhrakhav
npm run preview      # build karke ek hi URL pe chala dega
```

Phir `http://localhost:5000` — bilkul waise hi jaise Render pe chalega.
(Ye aapki local `server/.env` hi use karta hai, isliye data local Mongo me hi jayega.)

Roz ke kaam ke liye purana tarika hi behtar hai (client alag, turant refresh hota hai):

```bash
./start.sh
```
