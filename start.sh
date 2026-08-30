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
