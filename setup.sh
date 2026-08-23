#!/usr/bin/env bash
# Rakh Rakhav — auto setup (Part 11)
# Project dhoondhti hai, folder theek karti hai, .env sambhalti hai (aapki purani
# .env kabhi nahi mitati), npm install karti hai, MongoDB test karti hai, aur app chalu kar deti hai.

set -uo pipefail

GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; YEL=$'\033[0;33m'; BLU=$'\033[0;34m'; NC=$'\033[0m'
ok()   { echo "${GREEN}✔${NC} $1"; }
warn() { echo "${YEL}!${NC} $1"; }
err()  { echo "${RED}✖${NC} $1"; }
step() { echo; echo "${BLU}▸ $1${NC}"; }

TARGET="$HOME/Desktop/rakhrakhav"
BACKUP="$(mktemp -d)"

echo "═══════════════════════════════════════════"
echo "  Rakh Rakhav — Setup"
echo "═══════════════════════════════════════════"

# ---------------------------------------------------------------- 1. Node check
step "Node.js check"
if ! command -v node >/dev/null 2>&1; then
  err "Node.js install nahi hai. https://nodejs.org se LTS install karo."
  exit 1
fi
NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt 18 ]; then
  err "Node $(node -v) purana hai. 18+ chahiye."
  exit 1
fi
ok "Node $(node -v)"

# ------------------------------------------------- 2. Purani .env bachao
if [ -f "$TARGET/server/.env" ]; then
  cp "$TARGET/server/.env" "$BACKUP/server.env"
  ok "Aapki purani server/.env safe rakh li"
fi
if [ -f "$TARGET/client/.env" ]; then
  cp "$TARGET/client/.env" "$BACKUP/client.env"
fi

# ------------------------------------------------------- 3. Project dhoondho
step "Project folder dhoondh raha hoon"
PROJ=""
for base in "$HOME/Downloads" "$TARGET" "$HOME/Desktop" "$HOME"; do
  [ -d "$base" ] || continue
  while IFS= read -r d; do
    p=$(dirname "$d")
    if [ -f "$p/server/package.json" ] && [ -f "$p/client/package.json" ]; then
      # Naya version pehle (Downloads me abhi extract hua hoga)
      PROJ="$p"; break
    fi
  done < <(find "$base" -maxdepth 4 -type d -name server -not -path "*/node_modules/*" 2>/dev/null)
  [ -n "$PROJ" ] && break
done

if [ -z "$PROJ" ]; then
  err "client/ aur server/ wala folder nahi mila."
  echo "  Zip extract hui hai? Desktop ya Downloads me hai?"
  exit 1
fi
ok "Mila: $PROJ"

# ------------------------------------------- 4. Folder ko theek jagah laao
IS_SAFE_TO_MOVE=1
for protected in "$HOME" "$HOME/Desktop" "$HOME/Downloads" "$HOME/Documents"; do
  [ "$PROJ" = "$protected" ] && IS_SAFE_TO_MOVE=0
done

if [ "$PROJ" != "$TARGET" ] && [ "$IS_SAFE_TO_MOVE" = "1" ]; then
  step "Folder ko theek jagah la raha hoon"
  mkdir -p "$TARGET"
  shopt -s dotglob nullglob
  for f in "$PROJ"/*; do
    base=$(basename "$f")
    [ "$base" = ".env" ] && [ -e "$TARGET/.env" ] && continue
    [ -e "$TARGET/$base" ] && rm -rf "$TARGET/$base"
    mv "$f" "$TARGET/"
  done
  shopt -u dotglob nullglob
  rmdir -p "$PROJ" 2>/dev/null || true
  ok "Project ab yahan hai: $TARGET"
  PROJ="$TARGET"
elif [ "$PROJ" != "$TARGET" ]; then
  warn "Project yahin chhod raha hoon (move safe nahi): $PROJ"
fi

cd "$PROJ" || exit 1

# ------------------------------------------------------------------ 5. .env
step ".env files set kar raha hoon"

if [ -f "$BACKUP/server.env" ] && [ ! -f server/.env ]; then
  cp "$BACKUP/server.env" server/.env
  ok "Purani server/.env wapas laga di (aapka MONGO_URI safe hai)"
fi

if [ ! -f server/.env ]; then
  FOUND_ENV=""
  for cand in "$PROJ/.env" "$HOME/Desktop/.env" "$PROJ/client/.env"; do
    if [ -f "$cand" ] && grep -q "MONGO_URI" "$cand" 2>/dev/null; then FOUND_ENV="$cand"; break; fi
  done
  if [ -n "$FOUND_ENV" ]; then
    cp "$FOUND_ENV" server/.env
    ok "Aapki .env server/ me copy kar di ($FOUND_ENV se)"
  else
    cp server/.env.example server/.env
    warn "server/.env banayi lekin khali hai — MONGO_URI aur JWT_SECRET bharne padenge"
  fi
else
  ok "server/.env maujood hai"
fi

if [ -f "$BACKUP/client.env" ] && [ ! -f client/.env ]; then
  cp "$BACKUP/client.env" client/.env
elif [ ! -f client/.env ]; then
  cp client/.env.example client/.env
fi

# Purane version me client/.env me VITE_API_URL=http://localhost:5000/api hota tha.
# Ab client aur server ek hi URL pe chalte hain, isliye ye line ulta nuksan karti hai —
# build me localhost chhap jata hai aur live site pe koi API call chalti hi nahi.
if grep -q "^VITE_API_URL=" client/.env 2>/dev/null; then
  sed -i.bak 's|^VITE_API_URL=|# hata diya (ab relative /api use hota hai) — VITE_API_URL=|' client/.env
  rm -f client/.env.bak
  ok "client/.env se purana VITE_API_URL hata diya (ab ek hi URL wala tarika hai)"
fi
ok "client/.env ready"

# Naye keys jo .env.example me hain par purani .env me nahi — chup-chaap jod do
while IFS= read -r line; do
  key="${line%%=*}"
  case "$line" in \#*|"") continue ;; esac
  if ! grep -q "^${key}=" server/.env 2>/dev/null; then
    echo "$line" >> server/.env
    warn "server/.env me naya key joda: $key"
  fi
done < <(grep -E '^[A-Z_]+=' server/.env.example)

MISSING=""
grep -q "^MONGO_URI=.\+" server/.env 2>/dev/null || MISSING="$MISSING MONGO_URI"
grep -q "^JWT_SECRET=.\+" server/.env 2>/dev/null || MISSING="$MISSING JWT_SECRET"
if [ -n "$MISSING" ]; then
  warn "server/.env me ye khali hain:$MISSING"
  echo "    Bharne ke liye:  nano $PROJ/server/.env"
fi

# Database ka naam check — dusre project ka DB use to nahi ho raha
DBNAME=$(grep "^MONGO_URI=" server/.env 2>/dev/null | sed -E 's#.*/([^/?]+)(\?.*)?$#\1#')
if [ -n "$DBNAME" ] && [ "$DBNAME" != "rakhrakhav" ]; then
  warn "Aapka MONGO_URI database \"$DBNAME\" pe point kar raha hai, \"rakhrakhav\" pe nahi."
  echo "    Alag database chahiye to:"
  echo "    sed -i -E 's#(mongodb(\\+srv)?://[^/]+)/[^?]*#\\1/rakhrakhav#' $PROJ/server/.env"
fi

# ------------------------------------------------------------- 6. npm install
step "Server dependencies install"
( cd server && npm install --no-audit --no-fund --loglevel=error ) \
  && ok "Server packages ready" || { err "Server npm install fail"; exit 1; }

step "Client dependencies install"
( cd client && npm install --no-audit --no-fund --loglevel=error ) \
  && ok "Client packages ready" || { err "Client npm install fail"; exit 1; }

# --------------------------------------------- 6b. Self check (bina database ke)
#
# Ye MongoDB se PEHLE chalta hai, jaan-boojh kar. Iske liye database chahiye hi
# nahi, isliye ye HAR baar chalta hai — chahe MONGO_URI khali ho, chahe Atlas
# band ho. Kisi ne kuch tod diya hai to wo yahin pakda jayega, aur pakda tab
# jayega jab wajah saamne hai — na ki teen din baad dukaan me.
step "Self check (database ke bina)"
if ( cd server && npm run selfcheck --silent ); then
  ok "Saare self check pass"
else
  warn "Kuch self check fail hue — upar dekho"
fi

# --------------------------------------------------------- 7. MongoDB test
step "MongoDB connection test"
MONGO_OK=0
if grep -q "^MONGO_URI=.\+" server/.env 2>/dev/null; then
  TEST_OUT=$(cd server && node --input-type=module -e "
import dotenv from 'dotenv'; dotenv.config();
import mongoose from 'mongoose';
try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 12000 });
  console.log('CONNECTED:' + mongoose.connection.name);
  await mongoose.disconnect();
} catch (e) { console.log('FAILED:' + e.message); }
process.exit(0);
" 2>/dev/null)

  if [[ "$TEST_OUT" == CONNECTED:* ]]; then
    ok "MongoDB juda — database: ${TEST_OUT#CONNECTED:}"
    MONGO_OK=1
  else
    err "MongoDB connect nahi hua"
    echo "    ${TEST_OUT#FAILED:}"
    echo
    echo "    Aksar ye hota hai:"
    echo "    • Atlas → Network Access me 0.0.0.0/0 add nahi kiya"
    echo "    • Password me @ # \$ % jaisa character hai (URL-encode karna padta hai)"
    echo "    • URI me database ka naam nahi — .net/ ke baad rakhrakhav likhna hai"
  fi
else
  warn "MONGO_URI khali hai, test skip"
fi

# --------------------------------------------------------- 8. Smoke test
if [ "$MONGO_OK" = "1" ]; then
  step "Smoke test — poora signup/login/GST/invite/approve flow"
  if ( cd server && npm run smoke --silent ); then
    ok "Saare API tests pass"
  else
    warn "Kuch tests fail hue — upar dekho"
  fi
fi

# --------------------------------------------------------- 9. start script
step "Start script"
cat > start.sh <<'STARTEOF'
#!/usr/bin/env bash
# Dono servers ek saath. Band karne ke liye Ctrl+C.
cd "$(dirname "$0")" || exit 1
echo "Server  → http://localhost:5000"
echo "App     → http://localhost:5173"
echo "Band karne ke liye Ctrl+C"
echo
trap 'kill 0' EXIT INT TERM
( cd server && npm run dev ) &
( cd client && npm run dev ) &
wait
STARTEOF
chmod +x start.sh
ok "start.sh ready"

rm -rf "$BACKUP"

# ------------------------------------------------------------------ done
echo
echo "═══════════════════════════════════════════"
if [ "$MONGO_OK" = "1" ]; then
  echo "${GREEN}  Sab tayyar hai — app start ho raha hai${NC}"
  echo "═══════════════════════════════════════════"
  echo
  echo "Agli baar sirf ye:  cd $PROJ && ./start.sh"
  echo "Browser:            http://localhost:5173"
  echo
  echo "${BLU}Internet pe live karna hai (teacher ko dikhane ke liye)?${NC}"
  echo "  Poora tarika likha hai:  $PROJ/DEPLOY.md"
  echo "  Pehle yahin dekh lena:   cd $PROJ && npm run preview   → http://localhost:5000"
  echo "  (preview me client+server ek hi URL pe chalte hain, bilkul Render jaisa)"
  echo
  sleep 2
  exec ./start.sh
else
  echo "${YEL}  Setup ho gaya — bas MongoDB baaki${NC}"
  echo "═══════════════════════════════════════════"
  echo
  echo "1) MONGO_URI theek karo:   nano $PROJ/server/.env"
  echo "2) Phir chalao:            cd $PROJ && ./start.sh"
  echo
fi
