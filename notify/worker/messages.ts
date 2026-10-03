/**
 * 카톡으로 보내는 문구를 만드는 순수 함수 모음 (입출력 없음 → node 로 단위 테스트).
 *
 * 원칙
 * - 받는 사람이 개발 용어 없이 읽고 "무슨 일이 생겼고, 내가 뭘 해야 하는지" 알 수 있어야 한다.
 * - 돈·승인·문의처럼 사업에 의미 있는 일만 알린다. 정상 동작 보고는 보내지 않는다.
 * - 글자가 깨지지 않게: 인코딩 판별, 글자 단위 자르기.
 */

export type Payload = { title?: string; body: string; url?: string; button?: string };

// ---------------- 글자 깨짐 방지 ----------------

/** 카톡 글자 수 제한에 맞춰 자른다. 이모지(서로게이트 쌍)를 반으로 자르지 않도록 글자(code point) 단위. */
export function truncate(s: string, n: number): string {
  const cps = Array.from(s);
  return cps.length <= n ? s : cps.slice(0, Math.max(0, n - 1)).join("") + "…";
}

// Workers 런타임은 "euc-kr"·"ks_c_5601-1987"·"windows-949" 는 지원하지만 "cp949" 등은 RangeError 를 던진다.
const KOREAN_LABELS = /^(cp949|ms949|x-windows-949|uhc|ksc5601|ks_c_5601|ksc_5601|ks_c_5601-1989|korean|x-euc-kr)$/i;

function decodeWith(bytes: Uint8Array, charset: string, fatal: boolean): string | null {
  try {
    return new TextDecoder(KOREAN_LABELS.test(charset.trim()) ? "euc-kr" : charset.trim(), { fatal }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * 바이트 → 문자열. 선언된 문자셋이 틀렸거나 없을 때도 한글이 깨지지 않게:
 * 선언 문자셋(엄격) → UTF-8(엄격) → EUC-KR(엄격) → UTF-8(깨진 글자는 � 로)
 */
export function decodeBytes(bytes: Uint8Array, charset?: string): string {
  const tries = [charset, "utf-8", "euc-kr"].filter((c): c is string => !!c);
  for (const cs of tries) {
    const s = decodeWith(bytes, cs, true);
    if (s !== null) return s;
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function latin1Bytes(s: string): Uint8Array {
  return Uint8Array.from(s, (ch) => ch.charCodeAt(0) & 0xff);
}

/**
 * RFC 2047 제목(=?charset?B|Q?...?=) 해석.
 * 한글 메일러는 글자 중간에서 인코딩 단어를 끊는 경우가 많아, 이어진 단어는 바이트를 먼저 합친 뒤 한 번에 해석한다.
 */
export function decodeMimeWords(s: string): string {
  const word = /=\?([^?\s]+)\?([BbQq])\?([^?\s]*)\?=/g;
  // 인코딩 단어 사이의 공백·줄바꿈은 표시하지 않는다(RFC 2047 6.2)
  const compact = s.replace(/(\?=)\s+(?==\?[^?\s]+\?[BbQq]\?)/g, "$1");
  let out = "";
  let last = 0;
  let run: { charset: string; bytes: number[] } | null = null;
  const flush = () => {
    if (run) out += decodeBytes(Uint8Array.from(run.bytes), run.charset);
    run = null;
  };
  for (let m = word.exec(compact); m; m = word.exec(compact)) {
    if (m.index > last) {
      flush();
      out += compact.slice(last, m.index);
    }
    const [, charset, enc, text] = m;
    let bytes: Uint8Array;
    try {
      bytes =
        enc.toUpperCase() === "B"
          ? latin1Bytes(atob(text))
          : latin1Bytes(text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_x, h) => String.fromCharCode(parseInt(h, 16))));
    } catch {
      flush();
      out += m[0];
      last = word.lastIndex;
      continue;
    }
    if (run && run.charset.toLowerCase() !== charset.toLowerCase()) flush();
    run = run ?? { charset, bytes: [] };
    run.bytes.push(...bytes);
    last = word.lastIndex;
  }
  flush();
  return out + compact.slice(last);
}

/** application/x-www-form-urlencoded 또는 쿼리스트링을 바이트 단위로 풀어 인코딩을 판별한다(EUC-KR 로 보낸 한글 대응). */
export function parseForm(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of raw.replace(/^\?/, "").split("&")) {
    if (!pair) continue;
    const i = pair.indexOf("=");
    const [k, v] = i < 0 ? [pair, ""] : [pair.slice(0, i), pair.slice(i + 1)];
    out[pctDecode(k)] = pctDecode(v);
  }
  return out;
}

function pctDecode(s: string): string {
  const bytes: number[] = [];
  const src = s.replace(/\+/g, " ");
  for (let i = 0; i < src.length; i++) {
    const hex = src[i] === "%" ? src.slice(i + 1, i + 3) : "";
    if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(...new TextEncoder().encode(src[i]));
    }
  }
  return decodeBytes(Uint8Array.from(bytes));
}

// ---------------- 메일 → 알림 문구 ----------------

type MailEvent = { re: RegExp; headline: string; todo: string };
type MailRule = { name: string; from: RegExp; skip?: RegExp; url: string; events: MailEvent[]; fallback?: MailEvent };

/** 위에서부터 먼저 맞는 것을 쓴다. '비승인'이 '승인'보다 먼저 와야 한다. */
const MAIL_RULES: MailRule[] = [
  {
    // 크몽은 마케팅 알림을 꺼 두었으므로 오는 메일은 전부 거래·심사 관련 → 분류가 안 돼도 알린다
    name: "크몽",
    from: /kmong/i,
    url: "https://kmong.com/seller/dashboard",
    events: [
      { re: /사업자/, headline: "사업자 인증 결과가 나왔어요", todo: "인증 정보 화면에서 승인·반려 여부를 확인하세요." },
      { re: /비승인|반려|거절|보완/, headline: "서비스 심사에서 반려됐어요", todo: "사유를 확인하고 수정해서 다시 제출해야 해요." },
      { re: /승인/, headline: "서비스가 승인됐어요 🎉", todo: "이제 크몽에서 판매가 시작됩니다." },
      { re: /주문|결제|구매|의뢰가/, headline: "새 주문이 들어왔어요 💰", todo: "바로 확인하고 작업을 시작해야 해요." },
      { re: /메시지|문의|견적|상담/, headline: "고객 문의가 왔어요", todo: "빨리 답장할수록 주문으로 이어져요." },
      { re: /정산|출금|수익금|세금계산서/, headline: "정산 관련 안내가 왔어요", todo: "수익금 화면에서 확인하세요." },
      { re: /리뷰|후기|평가/, headline: "새 후기가 등록됐어요", todo: "후기를 확인하고 답글을 남기세요." },
    ],
    fallback: { re: /./, headline: "크몽에서 메일이 왔어요", todo: "거래·심사 관련일 수 있으니 확인하세요." },
  },
  {
    name: "api.market",
    from: /api\.market/i,
    skip: /sign in|otp|welcome|newsletter|weekly|digest|popular|how .* works|new .* are live|integrate/i,
    url: "https://api.market/seller/krdart/products",
    events: [
      { re: /reject|declin|not approved|changes requested|반려/i, headline: "KRDART 입점 심사에서 반려됐어요", todo: "사유를 확인하고 수정해야 해요." },
      { re: /approv|is live|now live|published|승인/i, headline: "KRDART 입점이 승인됐어요 🎉", todo: "api.market 에서도 판매가 시작됩니다." },
      { re: /subscri|new order|purchase|payment received|new customer/i, headline: "KRDART 에 새 구독·결제가 생겼어요 💰", todo: "누가 어떤 요금제를 샀는지 확인하세요." },
      { re: /payout|invoice|earning/i, headline: "정산 관련 안내가 왔어요", todo: "정산 화면에서 확인하세요." },
      { re: /review|심사/i, headline: "KRDART 심사 관련 안내가 왔어요", todo: "내용을 확인하세요." },
    ],
  },
  {
    name: "RapidAPI",
    from: /rapidapi/i,
    skip: /verify your email|stand out|spotlight|newsletter/i,
    url: "https://rapidapi.com/studio",
    events: [
      { re: /unsubscri|cancel/i, headline: "KRDART 구독이 해지됐어요", todo: "해지 사유가 있는지 확인하세요." },
      { re: /subscri/i, headline: "KRDART 에 새 구독자가 생겼어요", todo: "유료 요금제인지 확인하세요. (내가 직접 구독한 경우에도 옵니다)" },
      { re: /payout|payment|invoice/i, headline: "KRDART 결제·정산 안내가 왔어요 💰", todo: "금액을 확인하세요." },
      { re: /message|question|issue|discussion/i, headline: "KRDART 사용자 문의가 왔어요", todo: "빨리 답하면 유료 전환에 도움이 돼요." },
      { re: /review|approv|reject/i, headline: "KRDART 심사 관련 안내가 왔어요", todo: "내용을 확인하세요." },
    ],
  },
  {
    // 가입·인증코드·주소 변경 같은 안내는 빼고 돈이 움직인 것만 알린다
    name: "PayPal",
    from: /paypal/i,
    skip: /인증 코드|새 주소|비즈니스 활성화|비밀번호|둘러보기|code/i,
    url: "https://www.paypal.com/mep/dashboard",
    events: [
      { re: /받았|입금|received|you've got|payment from/i, headline: "PayPal 로 돈이 들어왔어요 💰", todo: "금액을 확인하세요." },
      { re: /출금|송금|인출|withdraw|transfer/i, headline: "PayPal 출금·송금 안내가 왔어요", todo: "본인이 한 것이 맞는지 확인하세요." },
    ],
  },
  {
    // 본인 Gmail 에서 제목에 [notify-test] 를 넣어 보내면 메일 → 카톡 전체 경로 점검
    name: "테스트",
    from: /hanjunjung@gmail\.com/i,
    url: "https://notify.ryanpp.com/health",
    events: [{ re: /\[notify-test\]/i, headline: "알림 테스트 메일이 도착했어요", todo: "메일 → 카톡 연결이 정상입니다." }],
  },
];

export type MailAlert = { rule: string; headline: string; payload: Payload };

/** 알릴 필요가 없는 메일이면 null. */
export function classifyMail(from: string, subject: string): MailAlert | null {
  const rule = MAIL_RULES.find((r) => r.from.test(from));
  if (!rule || rule.skip?.test(subject)) return null;
  const ev = rule.events.find((e) => e.re.test(subject)) ?? rule.fallback;
  if (!ev) return null;
  return {
    rule: rule.name,
    headline: ev.headline,
    payload: { title: rule.name, body: `${ev.headline}\n→ ${ev.todo}\n메일 제목: ${subject}`, url: rule.url },
  };
}

// ---------------- 다른 서비스가 보내는 알림 정리 ----------------

/**
 * dart-api·lotto 워커가 보내는 알림을 사람이 읽을 수 있게 바꾼다.
 * 정상 완료 보고는 보내지 않는다(null) — 문제 없으면 아침 요약 한 통으로 충분하다.
 */
export function normalizeIncoming(p: Payload): Payload | null {
  const title = p.title ?? "";
  if (/^DART daily-crawl OK/i.test(title) || /^lotto 주간 크롤$/i.test(title)) return null;
  if (/^DART daily-crawl 실패/i.test(title)) {
    return {
      title: "KRDART 공시 수집 실패",
      body: `어젯밤 한국 공시 자동 수집이 실패했어요. 내일 새벽에 다시 시도합니다. 이틀 연속이면 점검이 필요해요.\n원인: ${p.body}`,
      url: p.url,
    };
  }
  if (/^lotto 크롤 실패/i.test(title)) {
    return {
      title: "로또 회차 수집 실패",
      body: `이번 주 로또 당첨번호 자동 수집이 실패했어요. 자동으로 다시 시도합니다.\n원인: ${p.body}`,
      url: p.url,
    };
  }
  return p;
}

/** 제목·본문·링크를 카톡 한 통(최대 200자)으로. 링크가 잘리지 않게 본문 쪽을 줄인다. */
export function composeText(p: Payload, limit = 200): string {
  const head = p.title ? `[${p.title}]\n` : "";
  const tail = p.url ? `\n${p.url}` : "";
  const room = limit - Array.from(tail).length;
  return truncate(head + p.body, Math.max(20, room)) + tail;
}

// ---------------- 아침 요약 ----------------

export type DigestData = {
  /** KST 기준 오늘 (M/D) */
  date: string;
  /** 지난 24시간 동안 카톡으로 알린 메일의 한 줄 요약 */
  news: string[];
  /** 지난 24시간 KRDART 유료 채널 호출 수. 조회 실패면 null */
  krdart: { rapidapi: number; apimarket: number } | null;
  /** PC 에서 /status 로 마지막 확인한 크몽 상태 */
  kmong: { text: string; checked: string } | null;
  /** 사람이 조치해야 하는 문제 (평소엔 빈 배열) */
  problems: string[];
};

export function formatDigest(d: DigestData): string {
  const lines = [`[${d.date} 아침 요약]`];
  if (d.news.length === 0) lines.push("■ 어제 온 소식: 없음");
  else lines.push(`■ 어제 온 소식 ${d.news.length}건`, ...d.news.slice(0, 3).map((n) => `· ${n}`));

  if (d.krdart === null) lines.push("■ KRDART(공시 API): 사용량 확인 실패");
  else {
    const total = d.krdart.rapidapi + d.krdart.apimarket;
    lines.push(
      total === 0
        ? "■ KRDART(공시 API) 고객 사용: 0건"
        : `■ KRDART(공시 API) 고객 사용: ${total}건 🎉 (RapidAPI ${d.krdart.rapidapi}, api.market ${d.krdart.apimarket})`,
    );
  }

  lines.push(d.kmong ? `■ 크몽: ${d.kmong.text} (${d.kmong.checked} 확인)` : "■ 크몽: PC에서 /status 로 확인");

  if (d.problems.length === 0) lines.push("■ 시스템: 모두 정상");
  else lines.push("■ 점검 필요", ...d.problems.map((p) => `· ${p}`));
  return truncate(lines.join("\n"), 200);
}
