/**
 * Cloudflare Worker cron trigger for GitHub Actions workflow_dispatch.
 *
 * GitHub Actions schedule cron은 사실상 6~12시간 throttling되므로 (알려진 이슈),
 * CF Worker cron (매시간 정각, 정확) 에서 GitHub API로 workflow_dispatch를 대신 호출.
 *
 * Secrets (wrangler secret put):
 * - GITHUB_TOKEN: fine-grained PAT with "Actions: read/write" for earn_money repo
 *
 * Env (wrangler.toml [vars]):
 * - REPO: "JeongHanJun/earn_money"
 * - WORKFLOW: "daily-deploy.yml"
 * - REF: "main"
 */
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(dispatch(env, "scheduled"));
  },

  async fetch(request, env, ctx) {
    // 수동 트리거 (디버깅용): /?token=<some-shared-secret> 도 함께 검증하고 싶으면 아래 확장
    if (new URL(request.url).pathname !== "/dispatch") {
      return new Response(
        "cron-trigger alive. POST /dispatch to fire GitHub workflow_dispatch manually.",
        { status: 200 },
      );
    }
    if (request.method !== "POST") {
      return new Response("Use POST", { status: 405 });
    }
    const result = await dispatch(env, "manual");
    return new Response(JSON.stringify(result, null, 2), {
      status: result.ok ? 200 : 500,
      headers: { "content-type": "application/json" },
    });
  },
};

async function dispatch(env, source) {
  const url = `https://api.github.com/repos/${env.REPO}/actions/workflows/${env.WORKFLOW}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cf-worker-cron-ryanpp",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: env.REF, inputs: {} }),
  });
  const body = await res.text();
  const ok = res.status === 204;
  console.log(`[${source}] dispatch ${env.WORKFLOW} → ${res.status} ${body}`);
  return { ok, status: res.status, source, body };
}
