import { Hono } from "hono";
import {
  type DigestData,
  type Payload,
  classifyMail,
  composeText,
  decodeBytes,
  decodeMimeWords,
  formatDigest,
  normalizeIncoming,
  parseForm,
} from "./messages";

type Env = {
  NOTIFY_DB: D1Database;
  KAKAO_CLIENT_ID: string;
  KAKAO_CLIENT_SECRET?: string;
  KAKAO_REDIRECT_URI: string;
  NOTIFY_SECRET: string;
  ADMIN_SECRET: string;
  FORWARD_TO: string; // 메일 원래 수신함 (Email Routing 에서 인증된 주소여야 함)
  DART_DB: D1Database; // KRDART usage_log 조회용 (읽기 전용으로만 사용)
};

type TokenRow = {
  access_token: string;
  access_expires_at: number;
  refresh_token: string;
  refresh_expires_at: number;
  updated_at: number;
};

const KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const KAKAO_MEMO_URL = "https://kapi.kakao.com/v2/api/talk/memo/default/send";

// Access token is written with a 60s safety margin, so we refresh a bit early too.
const ACCESS_MARGIN_SEC = 60;

const app = new Hono<{ Bindings: Env }>();

// 시크릿이 설정되지 않은 환경에서 "둘 다 undefined" 로 통과되는 일이 없게 한다
const secretOk = (given: string | undefined, expected: string | undefined) => !!expected && given === expected;

app.get("/health", (c) => c.json({ ok: true, ts: nowSec() }));

/**
 * POST /kakao?token=<NOTIFY_SECRET>[&dry=1]
 * Body (JSON or form): { title?, body, url?, button? }
 *
 * Or query-only for GET-style callers:
 *   POST /kakao?token=...&title=...&body=...&url=...
 * dry=1 이면 보내지 않고 실제로 나갈 문구만 돌려준다.
 */
app.post("/kakao", async (c) => {
  if (!secretOk(c.req.query("token"), c.env.NOTIFY_SECRET)) return c.json({ error: "unauthorized" }, 401);

  const raw = await parseBody(c.req.raw);
  if (!raw.body) return c.json({ error: "body is required" }, 400);

  const payload = normalizeIncoming(raw as Payload);
  if (!payload) {
    // 정상 완료 보고는 카톡으로 보내지 않는다 (아침 요약으로 충분)
    await log(c.env, "kakao", "suppress", 0, String(raw.title ?? "").slice(0, 200));
    return c.json({ ok: true, suppressed: true });
  }
  if (c.req.query("dry") === "1") return c.json({ ok: true, dry: true, text: composeText(payload) });

  try {
    const data = await notify(c.env, payload);
    return c.json({ ok: data.result_code === 0, kakao: data });
  } catch (err: any) {
    return c.json({ ok: false, error: String(err?.message ?? err) }, 500);
  }
});

async function notify(env: Env, payload: Payload) {
  // URL 은 버튼으로도 전달되지만, 카톡 UI 특성상 텍스트에 있어야 잘 보이므로 본문 끝에도 붙인다.
  const text = composeText(payload);

  try {
    const access = await ensureAccessToken(env);
    const res = await sendMemo(access, {
      text,
      link_url: payload.url,
      button_title: payload.button ?? "열기",
    });
    await log(env, "kakao", "send", res.status, JSON.stringify(res.data).slice(0, 400));
    return res.data;
  } catch (err: any) {
    await log(env, "kakao", "error", 0, String(err?.message ?? err).slice(0, 400));
    throw err;
  }
}

/**
 * POST /admin/init-tokens?secret=<ADMIN_SECRET>
 * Body JSON: { access_token, expires_in, refresh_token, refresh_token_expires_in }
 *
 * Called ONCE after running the local OAuth script. Overwrites any existing row.
 */
app.post("/admin/init-tokens", async (c) => {
  if (!secretOk(c.req.query("secret"), c.env.ADMIN_SECRET)) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json<any>();
  const now = nowSec();
  const row: TokenRow = {
    access_token: String(body.access_token),
    access_expires_at: now + Number(body.expires_in) - ACCESS_MARGIN_SEC,
    refresh_token: String(body.refresh_token),
    refresh_expires_at: now + Number(body.refresh_token_expires_in ?? 60 * 60 * 24 * 60),
    updated_at: now,
  };
  await writeTokens(c.env, row);
  return c.json({ ok: true, expires_at: row.access_expires_at, refresh_expires_at: row.refresh_expires_at });
});

/**
 * GET /admin/status?secret=<ADMIN_SECRET>
 * Debug view: token TTLs + recent send log.
 */
app.get("/admin/status", async (c) => {
  if (!secretOk(c.req.query("secret"), c.env.ADMIN_SECRET)) return c.json({ error: "unauthorized" }, 401);
  const tokens = await readTokens(c.env);
  const logs = await c.env.NOTIFY_DB.prepare(
    "SELECT ts, channel, event, status, detail FROM notify_log ORDER BY ts DESC LIMIT 20",
  ).all();
  const now = nowSec();
  return c.json({
    now,
    tokens: tokens
      ? {
          access_expires_in: tokens.access_expires_at - now,
          refresh_expires_in: tokens.refresh_expires_at - now,
          updated_at: tokens.updated_at,
        }
      : null,
    recent_logs: logs.results,
  });
});

/**
 * POST /admin/refresh?secret=<ADMIN_SECRET>
 * Force a refresh cycle. Debugging aid.
 */
app.post("/admin/refresh", async (c) => {
  if (!secretOk(c.req.query("secret"), c.env.ADMIN_SECRET)) return c.json({ error: "unauthorized" }, 401);
  try {
    const tokens = await readTokens(c.env);
    if (!tokens) return c.json({ error: "no tokens stored" }, 404);
    const refreshed = await refresh(c.env, tokens.refresh_token);
    return c.json({ ok: true, access_expires_at: refreshed.access_expires_at });
  } catch (err: any) {
    return c.json({ ok: false, error: String(err?.message ?? err) }, 500);
  }
});

// ---------- 메일 → 카톡 ----------
// Cloudflare Email Routing 이 이 Worker 로 메일을 넘기면, 원래 받던 Gmail 로 그대로 전달한 뒤
// 사업에 의미 있는 메일(승인·주문·문의·구독·정산)만 골라 "무슨 일인지 + 할 일" 을 카톡으로 알린다.
// 분류 규칙과 문구는 messages.ts.

async function email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
  // 메일 전달이 최우선: 카톡 쪽이 실패해도 메일은 반드시 Gmail 에 도착해야 한다
  await message.forward(env.FORWARD_TO);

  const from = `${decodeMimeWords(message.headers.get("from") ?? "")} ${message.from}`;
  const subject = decodeMimeWords(message.headers.get("subject") ?? "(제목 없음)");
  const alert = classifyMail(from, subject);
  if (!alert) {
    await log(env, "mail", "skip", 0, `${from} | ${subject}`.slice(0, 400));
    return;
  }
  // 아침 요약의 "어제 온 소식" 에 쓰인다: 규칙이름|한줄요약|제목
  await log(env, "mail", "alert", 0, `${alert.rule}|${alert.headline}|${subject}`.slice(0, 400));
  ctx.waitUntil(notify(env, alert.payload).catch(() => {}));
}

// 매일 09:00 KST: Kakao refresh token 연장(keepalive) 후 아침 요약을 카톡 한 통으로 보낸다.
async function scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(
    (async () => {
      let daysLeft: number | null = null;
      try {
        const tokens = await readTokens(env);
        if (tokens) {
          const refreshed = await refresh(env, tokens.refresh_token);
          daysLeft = Math.floor((refreshed.refresh_expires_at - nowSec()) / 86400);
        }
      } catch (err: any) {
        await log(env, "kakao", "keepalive-error", 0, String(err?.message ?? err).slice(0, 400));
      }
      const text = formatDigest(await gatherDigest(env, daysLeft));
      await notify(env, { body: text });
    })().catch((err) => log(env, "digest", "error", 0, String(err?.message ?? err).slice(0, 400))),
  );
}

/**
 * GET /admin/digest?secret=<ADMIN_SECRET>[&send=1]
 * 아침 요약 미리보기. send=1 이면 카톡으로도 보낸다.
 */
app.get("/admin/digest", async (c) => {
  if (!secretOk(c.req.query("secret"), c.env.ADMIN_SECRET)) return c.json({ error: "unauthorized" }, 401);
  const tokens = await readTokens(c.env);
  const daysLeft = tokens ? Math.floor((tokens.refresh_expires_at - nowSec()) / 86400) : null;
  const data = await gatherDigest(c.env, daysLeft);
  const text = formatDigest(data);
  if (c.req.query("send") === "1") await notify(c.env, { body: text });
  return c.json({ text, length: Array.from(text).length, data });
});

/** 아침 요약에 들어갈 사실을 모은다. 문구는 messages.ts 의 formatDigest. 평소엔 problems 가 비어 있어야 한다. */
async function gatherDigest(env: Env, kakaoDaysLeft: number | null): Promise<DigestData> {
  const since = nowSec() - 86400;
  const kst = new Date(Date.now() + 9 * 3600e3);
  const md = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  const problems: string[] = [];

  // 어제 카톡으로 알린 메일 (승인·주문·문의·구독·정산)
  let news: string[] = [];
  try {
    const { results } = await env.NOTIFY_DB.prepare(
      "SELECT detail FROM notify_log WHERE ts > ? AND channel = 'mail' AND event = 'alert' ORDER BY id",
    ).bind(since).all<{ detail: string }>();
    news = results.map((r) => {
      const [rule, headline] = r.detail.split("|");
      return `${rule}: ${headline}`;
    });
  } catch {
    // 로그 조회 실패는 요약을 막지 않는다
  }

  // KRDART: 마켓을 거친 호출 = 실제 고객 사용
  let krdart: DigestData["krdart"] = null;
  try {
    const { results } = await env.DART_DB.prepare(
      "SELECT channel, COUNT(*) n, SUM(status >= 500) err FROM usage_log WHERE ts > ? GROUP BY channel",
    ).bind(since).all<{ channel: string; n: number; err: number }>();
    const by = Object.fromEntries(results.map((r) => [r.channel, r]));
    krdart = { rapidapi: by.rapidapi?.n ?? 0, apimarket: by.apimarket?.n ?? 0 };
    const errs = results.reduce((s, x) => s + (x.err ?? 0), 0);
    if (errs > 0) problems.push(`KRDART 서버 오류 응답 ${errs}건`);
  } catch {
    // krdart = null → "사용량 확인 실패"
  }
  try {
    const st: any = await (await fetch("https://dart.ryanpp.com/stats")).json();
    const f = String(st.last_filing_dt ?? "");
    const fd = new Date(`${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}T00:00:00Z`);
    const days = Math.floor((kst.getTime() - fd.getTime()) / 86400e3);
    // 주말·연휴에는 공시가 없으므로 6일 이상일 때만 문제로 본다
    if (!(days < 6)) problems.push(`한국 공시 자동 수집이 ${Number.isFinite(days) ? days + "일째" : "계속"} 멈췄어요`);
  } catch {
    problems.push("KRDART 사이트가 응답하지 않아요");
  }

  // lotto: 매주 토요일 추첨 → 8일 넘게 안 바뀌면 수집 실패
  try {
    const l: any = await (await fetch("https://lotto.ryanpp.com/api/latest")).json();
    if (kst.getTime() - new Date(`${l.drw_date}T00:00:00Z`).getTime() > 8 * 86400e3) {
      problems.push("로또 사이트 회차가 일주일 넘게 갱신되지 않았어요");
    }
  } catch {
    problems.push("로또 사이트가 응답하지 않아요");
  }

  // GitHub Actions (공개 리포라 토큰 불필요): 최근 24시간 실패. 조회 한도 초과 등은 문제로 치지 않는다.
  try {
    const res = await fetch(
      `https://api.github.com/repos/JeongHanJun/earn_money/actions/runs?per_page=50&created=>${new Date(since * 1000).toISOString()}`,
      { headers: { "User-Agent": "notify-digest", Accept: "application/vnd.github+json" } },
    );
    const j: any = await res.json();
    const fails = new Set<string>();
    for (const run of j.workflow_runs ?? []) if (run.conclusion === "failure") fails.add(run.name);
    if (fails.size) problems.push(`자동 작업 실패: ${[...fails].join(", ")}`);
  } catch {
    // ignore
  }

  // 알림 시스템 자체
  if (kakaoDaysLeft !== null && kakaoDaysLeft < 14) problems.push(`카톡 연결이 ${kakaoDaysLeft}일 뒤 끊겨요. PC에서 재인증 필요`);
  try {
    const err = await env.NOTIFY_DB.prepare(
      "SELECT COUNT(*) n FROM notify_log WHERE ts > ? AND event LIKE '%error%'",
    ).bind(since).first<{ n: number }>();
    if ((err?.n ?? 0) > 0) problems.push(`카톡 알림 전송 오류 ${err!.n}건`);
  } catch {
    // ignore
  }

  // 크몽은 로그인해야 보여서 서버가 직접 볼 수 없다 → PC 의 /status 가 마지막으로 확인한 상태를 state 표에 적어 둔다
  let kmong: DigestData["kmong"] = null;
  try {
    const row = await env.NOTIFY_DB.prepare("SELECT value, updated_at FROM state WHERE key = 'kmong'").first<{
      value: string;
      updated_at: number;
    }>();
    if (row?.value) kmong = { text: row.value, checked: md(new Date(row.updated_at * 1000 + 9 * 3600e3)) };
  } catch {
    // state 표가 아직 없으면 "PC에서 /status 로 확인" 으로 표시
  }

  return { date: md(kst), news, krdart, kmong, problems };
}

export default { fetch: app.fetch, email, scheduled };

// ---------- helpers ----------

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

/** 본문·쿼리를 바이트 단위로 읽어 인코딩을 판별한다. EUC-KR(CP949)로 보낸 한글도 깨지지 않는다. */
async function parseBody(req: Request): Promise<Partial<Payload>> {
  const ct = req.headers.get("content-type") ?? "";
  const charset = /charset=["']?([^;"'\s]+)/i.exec(ct)?.[1];
  const raw = decodeBytes(new Uint8Array(await req.arrayBuffer()), charset);
  let body: Record<string, any> = {};
  if (ct.includes("application/json")) {
    try {
      body = JSON.parse(raw) ?? {};
    } catch {
      body = {};
    }
  } else if (ct.includes("application/x-www-form-urlencoded")) {
    body = parseForm(raw);
  }
  const query = parseForm(new URL(req.url).search);
  const pick = (k: string) => (typeof body[k] === "string" && body[k] ? body[k] : query[k]) as string | undefined;
  return { title: pick("title"), body: pick("body"), url: pick("url"), button: pick("button") };
}

async function readTokens(env: Env): Promise<TokenRow | null> {
  const row = await env.NOTIFY_DB.prepare(
    "SELECT access_token, access_expires_at, refresh_token, refresh_expires_at, updated_at FROM kakao_tokens WHERE id = 1",
  ).first<TokenRow>();
  return row ?? null;
}

async function writeTokens(env: Env, row: TokenRow) {
  await env.NOTIFY_DB.prepare(
    `INSERT INTO kakao_tokens (id, access_token, access_expires_at, refresh_token, refresh_expires_at, updated_at)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       access_token = excluded.access_token,
       access_expires_at = excluded.access_expires_at,
       refresh_token = excluded.refresh_token,
       refresh_expires_at = excluded.refresh_expires_at,
       updated_at = excluded.updated_at`,
  )
    .bind(
      row.access_token,
      row.access_expires_at,
      row.refresh_token,
      row.refresh_expires_at,
      row.updated_at,
    )
    .run();
}

async function ensureAccessToken(env: Env): Promise<string> {
  const tokens = await readTokens(env);
  if (!tokens) throw new Error("no kakao tokens stored — run /admin/init-tokens first");
  const now = nowSec();
  if (now >= tokens.refresh_expires_at) {
    throw new Error("refresh token expired — re-authenticate via kakao-init script");
  }
  if (now < tokens.access_expires_at) return tokens.access_token;
  const refreshed = await refresh(env, tokens.refresh_token);
  return refreshed.access_token;
}

async function refresh(env: Env, refreshToken: string): Promise<TokenRow> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env.KAKAO_CLIENT_ID,
    refresh_token: refreshToken,
  });
  if (env.KAKAO_CLIENT_SECRET) body.set("client_secret", env.KAKAO_CLIENT_SECRET);

  const res = await fetch(KAKAO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
  });
  const data = (await res.json()) as any;
  // 토큰 값은 로그에 남기지 않는다
  const { access_token: _a, refresh_token: _r, ...safe } = data ?? {};
  await log(env, "kakao", "refresh", res.status, JSON.stringify({ ...safe, rotated: !!_r }).slice(0, 400));
  if (!res.ok || !data.access_token) {
    throw new Error(`refresh failed: ${res.status} ${JSON.stringify(data)}`);
  }

  const now = nowSec();
  const current = await readTokens(env);
  const row: TokenRow = {
    access_token: data.access_token,
    access_expires_at: now + Number(data.expires_in) - ACCESS_MARGIN_SEC,
    // Only overwrite refresh_token if Kakao returned a new one (happens when <30d left).
    refresh_token: data.refresh_token ?? current!.refresh_token,
    refresh_expires_at: data.refresh_token_expires_in
      ? now + Number(data.refresh_token_expires_in)
      : current!.refresh_expires_at,
    updated_at: now,
  };
  await writeTokens(env, row);
  return row;
}

async function sendMemo(
  accessToken: string,
  opts: { text: string; link_url?: string; button_title?: string },
) {
  const template: any = {
    object_type: "text",
    text: opts.text,
    link: {
      web_url: opts.link_url ?? "https://ryanpp.com",
      mobile_web_url: opts.link_url ?? "https://ryanpp.com",
    },
  };
  if (opts.link_url) template.button_title = opts.button_title ?? "열기";

  // URLSearchParams 는 항상 UTF-8 로 퍼센트 인코딩한다 → 한글·이모지 그대로 전달
  const body = new URLSearchParams({ template_object: JSON.stringify(template) });
  const res = await fetch(KAKAO_MEMO_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as any;
  return { status: res.status, data };
}

async function log(env: Env, channel: string, event: string, status: number, detail: string) {
  try {
    await env.NOTIFY_DB.prepare(
      "INSERT INTO notify_log (ts, channel, event, status, detail) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(nowSec(), channel, event, status, detail)
      .run();
  } catch {
    // never let logging fail the request
  }
}
