# ryanpp-cron-trigger

CF Worker cron → GitHub Actions `workflow_dispatch`.

GitHub Actions `schedule:` 는 알려진 이슈로 6~12시간 트로틀링돼서, hourly로 설정해도 실제로는 하루 2회 수준만 fire됩니다. CF Workers cron은 정확히 정각에 fire되므로 이걸로 GitHub workflow를 대신 트리거합니다.

## 셋업 (1회)

1. **GitHub Fine-grained PAT 발급**
   - https://github.com/settings/personal-access-tokens/new
   - Resource owner: 본인
   - Repository access: **Only select repositories → `JeongHanJun/earn_money`**
   - Permissions → Repository permissions → **Actions: Read and write**
   - Expiration: 1 year (재발급 알림 대비 짧게)
   - 발급된 토큰(`github_pat_...`) 복사

2. **CF Worker에 secret 등록**
   ```bash
   cd C:/Users/hanjun/earn_money/cron-trigger
   npx wrangler secret put GITHUB_TOKEN
   # 프롬프트에 위에서 복사한 PAT 붙여넣기
   ```

3. **배포**
   ```bash
   npx wrangler deploy
   ```
   배포 성공 시 CF Workers 대시보드에 `ryanpp-cron-trigger` 등장.

## 검증

수동 트리거:
```bash
curl -X POST https://ryanpp-cron-trigger.<account>.workers.dev/dispatch
# {"ok":true,"status":204,"source":"manual","body":""}
```

또는 CF 대시보드 → Workers → ryanpp-cron-trigger → Triggers → Cron triggers → **Send test event**.

GitHub Actions 탭에서 새 run이 `workflow_dispatch` 이벤트로 생성되면 성공.

## 운영

- Cron은 UTC 기준 매시간 정각.
- 실패 시 CF 대시보드 Logs에서 확인 (`console.log`가 wrangler tail에 잡힘).
- GITHUB_TOKEN 만료되면 PAT 재발급 후 `wrangler secret put GITHUB_TOKEN` 재실행.
