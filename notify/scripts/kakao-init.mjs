#!/usr/bin/env node
/**
 * Kakao OAuth 최초 인증 스크립트 (로컬 1회 실행).
 *
 * 사전 준비:
 *   1. https://developers.kakao.com/console/app 에서 앱 생성
 *   2. 앱 → 제품 설정 → 카카오 로그인 → 활성화 ON
 *   3. Redirect URI 등록: http://localhost:3737/callback
 *   4. 동의항목 → talk_message (카카오톡 메시지 전송) 필수 동의 ON
 *   5. 앱 키 → REST API 키 복사
 *
 * 사용법:
 *   KAKAO_CLIENT_ID=xxx KAKAO_CLIENT_SECRET=yyy node scripts/kakao-init.mjs
 *   (KAKAO_CLIENT_SECRET은 선택. 앱에 secret 발급받았을 때만.)
 *
 * 스크립트가 하는 일:
 *   1. 브라우저에서 인가 코드 발급 URL을 콘솔에 출력
 *   2. localhost:3737 에서 콜백 대기
 *   3. code 받으면 kauth.kakao.com/oauth/token 으로 교환
 *   4. access_token + refresh_token + 만료시간을 JSON으로 출력
 *   5. 그 JSON을 그대로 curl 로 notify.ryanpp.com/admin/init-tokens 에 POST 하면 끝
 */
import http from "node:http";
import { URL } from "node:url";

const CLIENT_ID = process.env.KAKAO_CLIENT_ID;
const CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.KAKAO_REDIRECT_URI ?? "http://localhost:3737/callback";
const PORT = Number(new URL(REDIRECT_URI).port || 3737);

if (!CLIENT_ID) {
  console.error("환경변수 KAKAO_CLIENT_ID 가 필요합니다.");
  process.exit(1);
}

const authUrl =
  `https://kauth.kakao.com/oauth/authorize?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=talk_message`;

console.log("\n브라우저에서 다음 URL을 열고 카카오 로그인 + 동의:\n");
console.log(authUrl);
console.log(`\n대기 중 → ${REDIRECT_URI}\n`);

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  if (u.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }
  const code = u.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("no code");
    return;
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code,
  });
  if (CLIENT_SECRET) body.set("client_secret", CLIENT_SECRET);

  const r = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
  });
  const data = await r.json();

  if (!r.ok || !data.access_token) {
    res.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify(data, null, 2));
    console.error("교환 실패:", data);
    process.exit(2);
  }

  const payload = {
    access_token: data.access_token,
    expires_in: data.expires_in,
    refresh_token: data.refresh_token,
    refresh_token_expires_in: data.refresh_token_expires_in,
  };

  res
    .writeHead(200, { "Content-Type": "text/plain; charset=utf-8" })
    .end("완료. 콘솔에 출력된 JSON을 notify Worker에 등록하세요.");

  console.log("\n=== 토큰 발급 완료 ===\n");
  console.log(JSON.stringify(payload, null, 2));

  const NOTIFY_HOST = process.env.NOTIFY_HOST ?? "https://notify.ryanpp.com";
  const ADMIN_SECRET = process.env.ADMIN_SECRET;
  if (ADMIN_SECRET) {
    console.log(`\n→ ${NOTIFY_HOST}/admin/init-tokens 로 자동 POST ...`);
    const r = await fetch(
      `${NOTIFY_HOST}/admin/init-tokens?secret=${encodeURIComponent(ADMIN_SECRET)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const txt = await r.text();
    console.log(`  status=${r.status}  ${txt.slice(0, 200)}`);
  } else {
    console.log("\n(ADMIN_SECRET 미설정 → 아래 curl 을 직접 실행)");
    const escaped = JSON.stringify(payload).replaceAll("'", "'\\''");
    console.log(`curl -X POST '${NOTIFY_HOST}/admin/init-tokens?secret=ADMIN_SECRET' \\`);
    console.log(`  -H 'Content-Type: application/json' -d '${escaped}'`);
  }
  server.close(() => process.exit(0));
});

server.listen(PORT);
