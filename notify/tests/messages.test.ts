// 실행: node --test tests/   (Node 24 는 .ts 를 그대로 실행)
import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyMail,
  composeText,
  decodeBytes,
  decodeMimeWords,
  formatDigest,
  normalizeIncoming,
  parseForm,
  truncate,
} from "../worker/messages.ts";

const b64 = (bytes: number[]) => Buffer.from(bytes).toString("base64");
const EUCKR_KMONG_ORDER = [0xc5, 0xa9, 0xb8, 0xf9, 0x20, 0xc1, 0xd6, 0xb9, 0xae]; // "크몽 주문" (EUC-KR)
const hasBroken = (s: string) => s.includes("�") || /[ÃÅÂ¤]/.test(s);

// ---------- 글자 깨짐 ----------
test("메일 제목: UTF-8 B/Q 인코딩", () => {
  assert.equal(decodeMimeWords("=?UTF-8?B?" + Buffer.from("서비스가 승인되었습니다").toString("base64") + "?="), "서비스가 승인되었습니다");
  assert.equal(decodeMimeWords("=?utf-8?Q?=ED=81=AC=EB=AA=BD_=EC=A3=BC=EB=AC=B8?="), "크몽 주문");
});

test("메일 제목: EUC-KR 계열 라벨(cp949 포함)이 모두 한글로 풀린다", () => {
  for (const label of ["EUC-KR", "ks_c_5601-1987", "cp949", "CP949", "ms949", "x-windows-949", "windows-949"]) {
    const got = decodeMimeWords(`=?${label}?B?${b64(EUCKR_KMONG_ORDER)}?=`);
    assert.equal(got, "크몽 주문", label);
  }
});

test("메일 제목: 글자 중간에서 끊긴 인코딩 단어를 이어서 해석한다", () => {
  const bytes = [...Buffer.from("새 주문이 들어왔습니다")];
  const cut = 5; // '주'(3바이트) 한가운데
  const s = `=?UTF-8?B?${b64(bytes.slice(0, cut))}?=\r\n =?UTF-8?B?${b64(bytes.slice(cut))}?=`;
  assert.equal(decodeMimeWords(s), "새 주문이 들어왔습니다");
});

test("메일 제목: 일반 글자와 섞여도 유지, 선언 문자셋이 틀려도 한글 복구", () => {
  assert.equal(decodeMimeWords("Re: =?UTF-8?B?" + Buffer.from("문의").toString("base64") + "?= [#12]"), "Re: 문의 [#12]");
  // UTF-8 이라고 선언했지만 실제로는 EUC-KR 바이트
  assert.equal(decodeMimeWords(`=?UTF-8?B?${b64(EUCKR_KMONG_ORDER)}?=`), "크몽 주문");
  assert.equal(decodeMimeWords("Plain ASCII subject"), "Plain ASCII subject");
});

test("본문 바이트: UTF-8·EUC-KR 자동 판별", () => {
  assert.equal(decodeBytes(Uint8Array.from(Buffer.from("한글 OK"))), "한글 OK");
  assert.equal(decodeBytes(Uint8Array.from(EUCKR_KMONG_ORDER)), "크몽 주문");
  assert.equal(decodeBytes(Uint8Array.from(EUCKR_KMONG_ORDER), "utf-8"), "크몽 주문"); // 잘못 선언
});

test("폼·쿼리스트링: UTF-8 과 EUC-KR 퍼센트 인코딩 모두 한글로", () => {
  assert.deepEqual(parseForm("?title=%ED%81%AC%EB%AA%BD&body=a+b"), { title: "크몽", body: "a b" });
  assert.deepEqual(parseForm("body=%C5%A9%B8%F9+%C1%D6%B9%AE"), { body: "크몽 주문" });
  assert.deepEqual(parseForm("body=100%25+%EC%99%84%EB%A3%8C&x"), { body: "100% 완료", x: "" });
});

test("자르기: 이모지를 반으로 자르지 않는다", () => {
  const s = "가".repeat(198) + "🎉🎉";
  const t = truncate(s, 200);
  assert.equal(Array.from(t).length, 200);
  assert.ok(!hasBroken(t) && !/[\uD800-\uDBFF]$/.test(t));
  assert.equal(truncate("짧은 글", 200), "짧은 글");
});

// ---------- 메일 분류 ----------
const kmong = (subject: string) => classifyMail("크몽 <noreply@kmong.com>", subject);

test("크몽: 승인·반려·주문·문의·사업자 인증을 구분한다", () => {
  assert.match(kmong("[크몽] 서비스가 승인되었습니다")!.headline, /승인됐어요/);
  assert.match(kmong("[크몽] 서비스가 비승인 처리되었습니다")!.headline, /반려/);
  assert.match(kmong("[크몽] 새로운 주문이 접수되었습니다")!.headline, /새 주문/);
  assert.match(kmong("[크몽] 의뢰인이 메시지를 보냈습니다")!.headline, /문의/);
  assert.match(kmong("[크몽] 사업자 정보 승인 안내")!.headline, /사업자 인증/);
  assert.match(kmong("[크몽] 알 수 없는 안내")!.headline, /메일이 왔어요/); // 분류 안 돼도 알림
});

test("알림 문구: 무슨 일인지 + 할 일 + 원래 제목, 200자 이내, 링크 유지", () => {
  const a = kmong("[크몽] 새로운 주문이 접수되었습니다")!;
  const text = composeText(a.payload);
  assert.ok(text.startsWith("[크몽]\n새 주문이 들어왔어요"));
  assert.match(text, /→ 바로 확인/);
  assert.match(text, /메일 제목: \[크몽\] 새로운 주문/);
  assert.ok(text.endsWith("https://kmong.com/seller/dashboard"));
  assert.ok(Array.from(text).length <= 200);
  const long = composeText(kmong("주문 " + "아주 긴 제목 ".repeat(60))!.payload);
  assert.ok(Array.from(long).length <= 200 && long.endsWith("https://kmong.com/seller/dashboard"));
});

test("api.market·RapidAPI·PayPal: 광고·가입 메일은 걸러지고 사업 소식만 알린다", () => {
  const am = (s: string) => classifyMail('"API.market" <hello@mail.api.market>', s);
  assert.equal(am("Your Weekly API.market Report: Top APIs"), null);
  assert.equal(am("How Pricing Works on API.market"), null);
  assert.equal(am("The most popular APIs on API.market"), null);
  assert.equal(am("New BytePlus Seedance Video Models are LIVE!"), null);
  assert.equal(am("[API.market] Sign in to API.market"), null);
  assert.match(am("Your API product has been approved")!.headline, /승인/);
  assert.match(am("Your product was rejected")!.headline, /반려/);
  assert.match(am("New subscription to KRDART")!.headline, /구독·결제/);

  const ra = (s: string) => classifyMail("Nokia API Hub <support@rapidapi.com>", s);
  assert.match(ra("Subscribe Confirmation: KRDART API")!.headline, /새 구독자/);
  assert.equal(ra("Make your API listing stand out"), null);

  const pp = (s: string) => classifyMail('"service@intl.paypal.com" <service@intl.paypal.com>', s);
  assert.equal(pp("PayPal 인증 코드"), null);
  assert.equal(pp("비밀번호를 변경했습니다."), null);
  assert.equal(pp("은행계좌를 확인해 주셔서 감사합니다."), null);
  assert.match(pp("결제대금을 받았습니다")!.headline, /돈이 들어왔어요/);

  assert.equal(classifyMail("Google Cloud <noreply@google.com>", "[Action Advised] GKE"), null);
});

// ---------- 다른 서비스 알림 ----------
test("정상 완료 보고는 보내지 않고, 실패는 한국어로 바꾼다", () => {
  assert.equal(normalizeIncoming({ title: "DART daily-crawl OK", body: "range 20261002~20261002 · filings +648" }), null);
  assert.equal(normalizeIncoming({ title: "lotto 주간 크롤", body: "latest 1244 · stores +12" }), null);
  const f = normalizeIncoming({ title: "DART daily-crawl 실패", body: "dartStatus=020 · timeout", url: "https://dart.ryanpp.com" })!;
  assert.equal(f.title, "KRDART 공시 수집 실패");
  assert.match(f.body, /자동 수집이 실패했어요[\s\S]*원인: dartStatus=020/);
  assert.match(normalizeIncoming({ title: "lotto 크롤 실패", body: "522" })!.title, /로또/);
  const other = { title: "직접 보낸 알림", body: "그대로" };
  assert.deepEqual(normalizeIncoming(other), other);
});

// ---------- 아침 요약 ----------
test("아침 요약: 평소 모습 — 약어 없이, 200자 이내", () => {
  const t = formatDigest({ date: "10/3", news: [], krdart: { rapidapi: 0, apimarket: 0 },
    kmong: { text: "서비스 4개 심사 중", checked: "10/3" }, problems: [] });
  assert.equal(t, [
    "[10/3 아침 요약]",
    "■ 어제 온 소식: 없음",
    "■ KRDART(공시 API) 고객 사용: 0건",
    "■ 크몽: 서비스 4개 심사 중 (10/3 확인)",
    "■ 시스템: 모두 정상",
  ].join("\n"));
  assert.ok(!/D-\d|90d|Rapid \d|24h|usage|크롤/.test(t));
});

test("아침 요약: 소식·고객 사용·문제가 있을 때", () => {
  const t = formatDigest({ date: "10/7", news: ["크몽: 서비스가 승인됐어요 🎉", "RapidAPI: KRDART 에 새 구독자가 생겼어요"],
    krdart: { rapidapi: 12, apimarket: 3 }, kmong: null, problems: ["한국 공시 자동 수집이 6일째 멈췄어요"] });
  assert.match(t, /■ 어제 온 소식 2건\n· 크몽: 서비스가 승인됐어요 🎉\n· RapidAPI/);
  assert.match(t, /고객 사용: 15건 🎉 \(RapidAPI 12, api.market 3\)/);
  assert.match(t, /■ 크몽: PC에서 \/status 로 확인/);
  assert.match(t, /■ 점검 필요\n· 한국 공시 자동 수집이 6일째 멈췄어요/);
  assert.ok(Array.from(t).length <= 200 && !hasBroken(t));
});

test("아침 요약: 사용량 조회 실패와 길이 초과", () => {
  const t = formatDigest({ date: "10/3", news: Array(5).fill("크몽: 고객 문의가 왔어요"), krdart: null, kmong: null,
    problems: Array(6).fill("아주 긴 문제 설명이 여러 줄로 이어집니다") });
  assert.match(t, /사용량 확인 실패/);
  assert.ok(Array.from(t).length <= 200);
});
