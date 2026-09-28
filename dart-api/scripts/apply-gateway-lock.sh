#!/usr/bin/env bash
# 원본 서버 잠금 + Altman 등급 재계산 (2026-09-28)
# 사용: bash scripts/apply-gateway-lock.sh <RapidAPI X-RapidAPI-Proxy-Secret 값>
#   RapidAPI 값: RapidAPI Studio → KRDART → Hub Listing → Gateway → X-RapidAPI-Proxy-Secret [Copy]
#   api.market 값: ~/.cloudflare-tokens.md 의 APIMARKET_GATEWAY_SECRET 에서 자동으로 읽음
set -euo pipefail
cd "$(dirname "$0")/.."

RAPID="${1:?RapidAPI X-RapidAPI-Proxy-Secret 값을 인자로 넣어주세요}"
APIM=$(grep -o 'X-KRDART-Gateway-Key): [0-9a-f]*' "$HOME/.cloudflare-tokens.md" | awk '{print $2}')
[ -n "$APIM" ] || { echo "tokens 파일에서 APIMARKET_GATEWAY_SECRET 를 못 찾음"; exit 1; }

echo "== 1/4 secrets"
printf '%s' "$RAPID" | npx wrangler secret put RAPIDAPI_PROXY_SECRET
printf '%s' "$APIM"  | npx wrangler secret put APIMARKET_GATEWAY_SECRET

echo "== 2/4 deploy"
npx wrangler deploy

echo "== 3/4 Altman(5.85/4.35) + composite 재계산"
npx wrangler d1 execute dart-db --remote --file scripts/fix-altman-grades.sql

echo "== 4/4 verify"
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
echo "direct /companies/search   (expect 401): $(code 'https://dart.ryanpp.com/companies/search?q=samsung')"
echo "demo   /distress/00126380   (expect 200): $(code 'https://dart.ryanpp.com/distress/00126380')"
echo "other  /distress/00126308   (expect 401): $(code 'https://dart.ryanpp.com/distress/00126308')"
echo "rapid  gateway header       (expect 200): $(code -H "X-RapidAPI-Proxy-Secret: $RAPID" 'https://dart.ryanpp.com/companies/search?q=samsung')"
echo "apimkt gateway header       (expect 200): $(code -H "X-KRDART-Gateway-Key: $APIM" 'https://dart.ryanpp.com/companies/search?q=samsung')"
