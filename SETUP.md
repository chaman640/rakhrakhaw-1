# Setup Guide — Part 1 chalane ka tarika

Ek baar ka setup hai. Baad ke parts me sirf `npm run dev` chalana hoga.

---

## Step 0 — Zip nikalo

Zip extract karo. Andar `rakhrakhav` folder milega:

```
rakhrakhav/
├── client/     <- React app (frontend)
├── server/     <- Express API (backend)
├── README.md
└── SETUP.md    <- ye file
```

Ise apne `rakhrkhav` folder me rakh do.

---

## Step 1 — Node.js check karo

Terminal (Windows: PowerShell ya CMD) kholo:

```bash
node -v
```

**18 se upar** hona chahiye — `v20.x` ya `v22.x` best hai.
Agar "command not found" aaye ya version purana ho, to https://nodejs.org se **LTS** version install karo, phir terminal band karke naya kholo.

---

## Step 2 — Database (MongoDB)

Do rasta hai. **Atlas recommended** — kuch install nahi karna padta.

### Option A — MongoDB Atlas (free, cloud)

1. https://www.mongodb.com/cloud/atlas pe free account banao
2. **Free (M0) cluster** banao — region me India/Mumbai choose karna better hai
3. **Database Access** → naya database user banao, username + password note kar lo
4. **Network Access** → `0.0.0.0/0` add karo (development ke liye — kahin se bhi connect ho jayega)
5. Cluster pe **Connect → Drivers** → connection string copy karo. Aisi dikhegi:

```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

6. `<password>` ki jagah apna asli password daalo, aur `.net/` ke turant baad database ka naam:

```
mongodb+srv://anuj:MyPass123@cluster0.xxxxx.mongodb.net/rakhrakhav?retryWrites=true&w=majority
```

> **Dhyan:** password me `@ # $ % /` jaise characters hain to wo URL-encode karne padenge
> (`@` → `%40`, `#` → `%23`). Sabse aasan — password me sirf letters aur numbers rakho.

### Option B — Local MongoDB

1. **MongoDB Community Server** install karo — https://www.mongodb.com/try/download/community
2. Install ke baad service apne aap chalti hai
3. Connection string:

```
mongodb://127.0.0.1:27017/rakhrakhav
```

---

## Step 3 — Server chalao

```bash
cd rakhrakhav/server
npm install
```

Ab `.env` file banao:

```bash
# Mac / Linux
cp .env.example .env

# Windows (PowerShell ya CMD)
copy .env.example .env
```

`.env` file kholo aur do line bharo:

```env
MONGO_URI=<Step 2 wali connection string yahan paste karo>
JWT_SECRET=koi-bhi-lamba-random-text-jo-kisi-ko-pata-na-ho-123456
```

Baaki lines waise hi rehne do. Ab chalao:

```bash
npm run dev
```

**Sahi output aisa dikhega:**

```
[db] MongoDB connected: cluster0-shard-00-01.xxxxx.mongodb.net/rakhrakhav
[server] development mode, http://localhost:5000
```

**Check karo:** browser me http://localhost:5000/api/health kholo. Ye dikhna chahiye:

```json
{"success":true,"message":"API zinda hai","data":{"time":"..."}}
```

> Ye terminal band mat karna — server chalta rehna chahiye.

---

## Step 4 — Client chalao

**Naya terminal** kholo (purana chalta rehne do):

```bash
cd rakhrakhav/client
npm install

# Mac / Linux
cp .env.example .env
# Windows
copy .env.example .env

npm run dev
```

**Output:**

```
VITE v5.4.x  ready in 400 ms
➜  Local:   http://localhost:5173/
```

Browser me http://localhost:5173 kholo.

---

## Step 5 — App dekho

1. Login page khulega — phone/password fields **disabled** hain (asli login Part 2 me)
2. Neeche dashed box me **"Wholesaler"** button dabao → sidebar wala dashboard khulega
3. Sidebar ke saare menu click karke dekho — har page batayega wo kaunse part me banega
4. Wapas `/login` jao, **"Retailer"** dabao → retailer ka chhota menu dikhega
5. Browser window chhoti karo (ya F12 → mobile view) → hamburger menu aa jayega

**Ye "Preview" buttons Part 2 me delete ho jayenge** — abhi sirf layout dekhne ke liye hain.

---

## Sab sahi hai? Checklist

- [ ] `node -v` → 18+
- [ ] Server terminal me `MongoDB connected` likha aaya
- [ ] http://localhost:5000/api/health JSON de raha hai
- [ ] http://localhost:5173 pe login page khul raha hai
- [ ] Wholesaler preview → sidebar ke 11 menu dikh rahe hain
- [ ] Retailer preview → 6 menu dikh rahe hain
- [ ] Browser console (F12) me koi red error nahi

Sab tick? Part 2 ke liye tayyar ho.

---

## Common errors aur unka fix

| Error | Matlab | Fix |
|---|---|---|
| `Missing required env variable: MONGO_URI` | `.env` file bani hi nahi | Step 3 dobara — `.env.example` ko copy karke `.env` banao |
| `MongoServerError: bad auth` | Username ya password galat | Atlas → Database Access me password reset karo, URI me update karo |
| `ECONNREFUSED 127.0.0.1:27017` | Local MongoDB chal nahi raha | MongoDB service start karo, ya Atlas pe switch kar jao |
| `MongooseServerSelectionError` (Atlas) | IP whitelist nahi hai | Atlas → Network Access → `0.0.0.0/0` add karo |
| `EADDRINUSE: port 5000` | Port pehle se busy (Mac pe AirPlay leta hai) | `.env` me `PORT=5001` karo, phir client ke `.env` me `VITE_API_URL=http://localhost:5001/api` |
| `npm error ENOENT package.json` | Galat folder me ho | `cd` karke `server` ya `client` folder ke andar jao |
| Browser me CORS error | Client URL match nahi kar raha | Server `.env` me `CLIENT_URL=http://localhost:5173` sahi hai ya nahi dekho |
| Page blank, console me red error | Client install adhoora | `client` folder me `node_modules` delete karke `npm install` dobara |

---

## Code kahan se padhna shuru karo

Samajhne ke liye is order me:

| File | Kya hai |
|---|---|
| `server/src/config/constants.js` | Saare fixed values ek jagah — order status, payment modes, units |
| `server/src/models/Business.js` | GST on/off ka logic |
| `server/src/models/Item.js` | 3 price fields aur rate chain ka comment |
| `server/src/models/Invoice.js` | Tax invoice vs bill of supply, snapshots |
| `server/src/middleware/tenant.js` | Multi-tenancy — sabse important 10 lines |
| `client/src/routes/AppRoutes.jsx` | Poori app ka route map |
| `client/src/components/ui/` | Reusable components — inhe har page pe use karenge |

---

## Git (optional par recommended)

Har part ka alag commit rakho — kuch bigde to wapas aa sakte ho:

```bash
cd rakhrakhav
git init
git add .
git commit -m "Part 1: foundation, schema, UI shell"
```

`.gitignore` pehle se hai — `node_modules` aur `.env` commit nahi honge.

---

## Roz kaam shuru karte waqt

Ab se sirf ye:

```bash
# Terminal 1
cd rakhrakhav/server && npm run dev

# Terminal 2
cd rakhrakhav/client && npm run dev
```
