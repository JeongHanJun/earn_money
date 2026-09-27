# notify — 카카오톡 통합 알림 브릿지

여러 프로젝트(DART / 크몽 / lotto / 앱인토스 / room13)의 이벤트를
한 카카오톡 채팅(hanjunjung 본인)으로 밀어넣는 Cloudflare Worker.

## 배포 절차 (첫 1회)

```bash
cd notify
npm install
npx wrangler login

# 1) D1 DB 생성 → 출력된 database_id를 wrangler.jsonc에 붙여넣기
npx wrangler d1 create notify-db

# 2) 마이그레이션
npm run db:remote

# 3) 시크릿 등록
npx wrangler secret put KAKAO_CLIENT_ID       # 카카오 REST API 키
npx wrangler secret put KAKAO_CLIENT_SECRET   # (선택) 앱에 발급된 secret
npx wrangler secret put KAKAO_REDIRECT_URI    # http://localhost:3737/callback
npx wrangler secret put NOTIFY_SECRET         # 호출자만 아는 임의 랜덤 문자열
npx wrangler secret put ADMIN_SECRET          # 관리자만 아는 임의 랜덤 문자열

# 4) 배포
npm run deploy
```

## 첫 토큰 발급 (사용자 수동, 5분)

```bash
KAKAO_CLIENT_ID=<REST_API_키> KAKAO_CLIENT_SECRET=<선택> \
  npm run auth:init
# → 브라우저에서 인가 URL 열고 로그인·동의
# → 콘솔에 curl 명령이 출력됨. 그걸 그대로 실행 (ADMIN_SECRET 치환)
```

## 사용법

```bash
# 텍스트만
curl -X POST 'https://notify.ryanpp.com/kakao?token=NOTIFY_SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"body":"KRDART 새 구독자 감지"}'

# 제목 + 링크
curl -X POST 'https://notify.ryanpp.com/kakao?token=NOTIFY_SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"title":"DART","body":"daily-crawl 실패: status=013","url":"https://dart.ryanpp.com","button":"대시보드"}'

# 다른 서비스에서 (Node.js)
await fetch(`https://notify.ryanpp.com/kakao?token=${NOTIFY_SECRET}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "크몽", body: "신규 주문: Basic 150k", url: "https://kmong.com/mypage" }),
});
```

## 관리자 endpoint

```bash
# 토큰 상태 (TTL + 최근 20건 로그)
curl 'https://notify.ryanpp.com/admin/status?secret=ADMIN_SECRET'

# 강제 refresh (디버깅)
curl -X POST 'https://notify.ryanpp.com/admin/refresh?secret=ADMIN_SECRET'
```

## 토큰 수명 요약

| 토큰 | TTL | 동작 |
|---|---|---|
| access_token | 6h | 만료 임박(60s 마진) 시 자동 refresh |
| refresh_token | 60d | 만료 30d 미만 응답에 새 토큰 포함 → 자동 rotate |
| refresh_token 만료 | — | `KOE322` → `auth:init` 재실행 필요 |

## 에러 코드 참조

- `-402` : `talk_message` 스코프 미동의 → 카카오 개발자 콘솔에서 필수 동의로 재설정
- `-532`/`-533`/`-536` : 일 호출 한도 초과 (개인 앱 1,000회/일)
- `KOE322` : refresh_token 만료 → 로컬에서 `auth:init` 재실행

## 이벤트 카탈로그 (호출 위치)

| 서비스 | 이벤트 | 훅 위치 |
|---|---|---|
| DART | daily-crawl 종료 | `dart-api/worker/index.ts` scheduled 핸들러 끝 |
| DART | 새 구독자 감지 | 별도 폴러 (RapidAPI Analytics daily) |
| DART | api.market 매출 | 별도 폴러 (Seller Console API) |
| 크몽 | 신규 주문 이메일 | Gmail 필터 + Google Apps Script |
| lotto | 주간 크롤 실패 | `lotto/worker/index.ts` scheduled 핸들러 |
| 앱인토스 | 심사 결과 이메일 | Gmail 필터 + Apps Script |
