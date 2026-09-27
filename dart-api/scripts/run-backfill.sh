#!/bin/bash
# 상장사 3년치 재무 백필. Worker endpoint 반복 호출.
# 사용: DART_ADMIN_SECRET=... bash scripts/run-backfill.sh   (값은 ~/.cloudflare-tokens.md)
set -e
ADMIN="${DART_ADMIN_SECRET:?DART_ADMIN_SECRET 환경변수가 필요합니다}"
BASE="https://dart.ryanpp.com/admin/backfill-financials"
COUNT=200
MAX=4100  # 상장사 3994 + 여유

for year in 2024 2023 2022; do
  echo "════════════════════════════════════"
  echo " YEAR $year"
  echo "════════════════════════════════════"
  start=0
  totOk=0; totErr=0; totRows=0
  while [ $start -lt $MAX ]; do
    res=$(curl -sS -X POST "$BASE?year=$year&start=$start&count=$COUNT" -H "Authorization: Bearer $ADMIN")
    ok=$(echo "$res" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const j=JSON.parse(s);console.log(j.ok||0)})")
    err=$(echo "$res" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const j=JSON.parse(s);console.log(j.err||0)})")
    rows=$(echo "$res" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const j=JSON.parse(s);console.log(j.rowsIns||0)})")
    nextV=$(echo "$res" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const j=JSON.parse(s);console.log(j.next===null?'DONE':j.next)})")
    totOk=$((totOk+ok)); totErr=$((totErr+err)); totRows=$((totRows+rows))
    printf "  %s [%4d-%4d] ok=%2d err=%2d rows=%3d   running: ok=%d err=%d rows=%d\n" "$year" "$start" "$((start+COUNT))" "$ok" "$err" "$rows" "$totOk" "$totErr" "$totRows"
    [ "$nextV" = "DONE" ] && break
    start=$nextV
  done
  echo "  → $year TOTAL: ok=$totOk err=$totErr rows=$totRows"
done
echo "[ALL DONE]"
