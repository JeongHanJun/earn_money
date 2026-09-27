import { Hono } from "hono";

type Env = {
  NOTIFY_DB: D1Database;
  KAKAO_CLIENT_ID: string;
  KAKAO_CLIENT_SECRET?: string;
  KAKAO_REDIRECT_URI: string;
  NOTIFY_SECRET: string;
  ADMIN_SECRET: string;
  FORWARD_TO: string; // 메일 원래 수신함 (Email Routing 에서 인증된 주소여야 함)
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

app.get("/health", (c) => c.json({ ok: true, ts: nowSec() }));

/**
 * POST /kakao?token=<NOTIFY_SECRET>
 * Body (JSON or form): { title?, body, url?, button? }
 *
 * Or query-only for GET-style callers:
 *   POST /kakao?token=...&title=...&body=...&url=...
 */
app.post("/kakao", async (c) => {
  if (c.req.query("token") !== c.env.NOTIFY_SECRET) return c.json({ error: "unauthorized" }, 401);

  const payload = await parseBody(c.req.raw, c.req.query());
  if (!payload.body) return c.json({ error: "body is required" }, 400);

  try {
    const data = await notify(c.env, payload as Payload);
    return c.json({ ok: data.result_code === 0, kakao: data });
  } catch (err: any) {
    return c.json({ ok: false, error: String(err?.message ?? err) }, 500);
  }
});

type Payload = { title?: string; body: string; url?: string; button?: string };

async function notify(env: Env, payload: Payload) {
  // 메시지 조립: [제목] + 본문 + URL 인라인.
  // URL 은 button/link 로도 전달되지만, 카톡 UI 특성상 텍스트에 있어야 잘 보이므로 inline.
  const parts: string[] = [];
  if (payload.title) parts.push(`[${payload.title}]`);
  parts.push(payload.body);
  if (payload.url) parts.push(payload.url);
  const text = truncate(parts.join("\n"), 200);

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
  if (c.req.query("secret") !== c.env.ADMIN_SECRET) return c.json({ error: "unauthorized" }, 401);
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
  if (c.req.query("secret") !== c.env.ADMIN_SECRET) return c.json({ error: "unauthorized" }, 401);
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
  if (c.req.query("secret") !== c.env.ADMIN_SECRET) return c.json({ error: "unauthorized" }, 401);
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
// 중요한 메일(크몽 주문·문의·심사, api.market·RapidAPI 심사·구독·정산)만 골라 카톡으로 알린다.

type MailRule = { name: string; from: RegExp; subject?: RegExp; skip?: RegExp; url: string };

const MAIL_RULES: MailRule[] = [
  // 크몽은 마케팅 알림을 꺼 두었으므로 오는 메일은 전부 거래·심사 관련
  { name: "크몽", from: /kmong/i, url: "https://kmong.com/seller/dashboard" },
  {
    name: "api.market",
    from: /api\.market/i,
    subject: /review|approv|reject|live|publish|subscri|payment|payout|invoice|order|심사|승인|반려/i,
    skip: /sign in|otp|welcome|newsletter/i,
    url: "https://api.market/seller-console",
  },
  {
    name: "RapidAPI",
    from: /rapidapi/i,
    subject: /subscri|payment|payout|invoice|review|approv|reject|message|issue|question/i,
    skip: /verify your email|stand out|spotlight|newsletter/i,
    url: "https://rapidapi.com/studio",
  },
  // 본인 Gmail에서 제목에 [notify-test] 를 넣어 보내면 전체 경로(메일 → Worker → 카톡) 점검
  { name: "테스트", from: /hanjunjung@gmail\.com/i, subject: /\[notify-test\]/i, url: "https://notify.ryanpp.com/health" },
];

async function email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
  // 메일 전달이 최우선: 카톡 쪽이 실패해도 메일은 반드시 Gmail 에 도착해야 한다
  await message.forward(env.FORWARD_TO);

  const from = `${message.headers.get("from") ?? ""} ${message.from}`;
  const subject = decodeMimeWords(message.headers.get("subject") ?? "(제목 없음)");
  const rule = MAIL_RULES.find((r) => r.from.test(from));
  if (!rule || (rule.subject && !rule.subject.test(subject)) || rule.skip?.test(subject)) {
    await log(env, "mail", "skip", 0, `${from} | ${subject}`.slice(0, 400));
    return;
  }
  ctx.waitUntil(notify(env, { title: `${rule.name} 메일`, body: subject, url: rule.url }).catch(() => {}));
}

// Kakao refresh token 은 갱신 호출이 있어야 연장된다. 알림이 뜸한 시기에도 끊기지 않도록 매일 한 번 갱신한다.
async function scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(
    (async () => {
      const tokens = await readTokens(env);
      if (!tokens) return;
      const refreshed = await refresh(env, tokens.refresh_token);
      const daysLeft = Math.floor((refreshed.refresh_expires_at - nowSec()) / 86400);
      if (daysLeft < 7) {
        await notify(env, {
          title: "notify 토큰 만료 임박",
          body: `Kakao refresh token ${daysLeft}일 남음 — npm run auth:init 으로 재인증 필요`,
        });
      }
    })().catch((err) => log(env, "kakao", "keepalive-error", 0, String(err?.message ?? err).slice(0, 400))),
  );
}

export default { fetch: app.fetch, email, scheduled };

// ---------- helpers ----------

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

// RFC 2047 인코딩 제목(=?UTF-8?B?...?= / =?UTF-8?Q?...?=)을 사람이 읽을 수 있는 문자열로 푼다
function decodeMimeWords(s: string) {
  return s
    .replace(/\?=\s+=\?/g, "?==?") // 인접한 인코딩 단어 사이 공백은 제거
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_m, charset: string, enc: string, text: string) => {
      try {
        const bytes =
          enc.toUpperCase() === "B"
            ? Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0))
            : Uint8Array.from(
                text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_x, h) => String.fromCharCode(parseInt(h, 16))),
                (ch) => ch.charCodeAt(0),
              );
        return new TextDecoder(charset).decode(bytes);
      } catch {
        return text;
      }
    });
}

function truncate(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

async function parseBody(req: Request, query: Record<string, string>) {
  const ct = req.headers.get("content-type") ?? "";
  let json: any = {};
  if (ct.includes("application/json")) {
    try {
      json = await req.json();
    } catch {
      json = {};
    }
  } else if (ct.includes("application/x-www-form-urlencoded")) {
    const t = await req.text();
    json = Object.fromEntries(new URLSearchParams(t));
  }
  return {
    title: json.title ?? query.title,
    body: json.body ?? query.body,
    url: json.url ?? query.url,
    button: json.button ?? query.button,
  } as { title?: string; body?: string; url?: string; button?: string };
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
