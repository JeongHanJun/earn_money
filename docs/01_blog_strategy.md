# 블로그 프로젝트 전략 v1 (2026-08-23)

## 프로젝트 정의

**한 줄**: 공공데이터 API 기반 자동 컨텐츠 생성 + 실시간 트렌드 애그리게이션 웹사이트. AdSense + CPA 제휴 + Pulse 앱 다운로드 유도로 다중 수익 모델.

**도메인**: `now.ryanpp.com` (Cloudflare Pages 배포)

## 사업 목표

- **초기 목표 (6개월)**: 월 세션 30,000, 총 매출 월 50~100만원
- **중기 목표 (12개월)**: 월 세션 200,000, 총 매출 월 300~500만원
- **장기 목표 (24개월)**: 월 세션 700,000+, 총 매출 월 1,000~2,000만원
- **자동화 목표**: 정착 후 주 1~3시간 유지 (모니터링 + 데이터 소스 추가)

## 왜 이번은 다르게 되는가

### 지난번 블로그 실패 원인
- 순수 AI 생성 컨텐츠 → Google Helpful Content Update에 걸림
- 실제로 자동화하지도 못했음
- 수익 모델(AdSense 등) 자체를 몰랐음

### 이번 접근의 차별점
1. **컨텐츠 소스 = 팩트 데이터** (공공데이터 API, RSS, 트렌드 데이터)
2. **Claude 역할 = 정리/요약** (원본 링크 상단 배치, AI 감지 회피)
3. **Pulse 인프라 재활용** (Python collector, Cloudflare KV, Workers 이미 구축됨)
4. **다중 수익 모델** (AdSense + CPA + 앱 다운로드 유도)
5. **실시간성 재방문 트래픽** (트렌드 페이지가 매일 방문 유도)

## 컨텐츠 카테고리 (3-column 아키텍처)

```
now.ryanpp.com
├── /trends           ← Pulse 데이터 재활용 (실시간, 재방문)
├── /policy           ← 공공데이터 API + Claude (SEO 검색 유입)
│   ├── /policy/청년
│   ├── /policy/복지
│   ├── /policy/고용
│   └── /policy/세무
└── /app-download     ← Pulse 앱 다운로드 (부가 수익)
```

## 데이터 소스

### Tier 1: 공공데이터 API (data.go.kr)
- 청년정책포털 (청년 지원금)
- 정책브리핑 (부처별 신규 정책)
- 국세청 세무일정
- 고용노동부 지원사업
- 보건복지부 복지로
- 기상청 동네예보 (지역별 상세)
- 국토교통부 부동산

### Tier 2: Pulse 재활용 (`C:\Users\hanjun\google_admob\backend-collector\`)
- Google Trends (pytrends)
- YouTube Data API v3
- Reddit (r/popular per locale)
- Wikipedia Pageviews
- HackerNews API
- Naver DataLab
- Country news RSS

### Tier 3 (선택): 뉴스/RSS
- 정부24, 부처별 RSS
- 네이버 뉴스 카테고리별 RSS

## 기술 스택

| 레이어 | 기술 | 비고 |
|---|---|---|
| 프론트엔드 | Next.js 14 (App Router) | SSG + ISR |
| 배포 | Cloudflare Pages | 무료, 글로벌 CDN |
| 데이터 저장 | Cloudflare KV/R2 | Pulse 인프라 재활용 |
| 데이터 수집 | Python (기존 Pulse collector 확장) | 매 1~6시간 실행 |
| AI 요약 | Claude Code headless (Max 구독) | 프롬프트 캐싱 |
| 크론 | GitHub Actions or Cloudflare Cron Triggers | 무료 |
| 광고 | Google AdSense (기본) + 쿠팡 파트너스 (CPS) | |
| 애널리틱스 | Google Analytics 4 + Search Console | |

## 수익 모델

| 채널 | 예상 매출 비율 | 발동 조건 |
|---|---|---|
| Google AdSense | 40~60% | 페이지 30+ 후 심사 통과 |
| 쿠팡 파트너스 (CPS) | 15~25% | 관련 상품 링크 삽입 |
| 지원금 관련 CPA (보험/금융) | 10~20% | 승인 후 |
| Pulse 앱 다운로드 유도 | 5~10% | 앱 배포 후 |
| (미래) 프리미엄 알림 티어 | ? | MRR 30만 확보 후 |

## Phase별 실행 계획

### Phase 1 (Week 1): 인프라 세팅
- Day 1: 계정 세팅 (공공데이터포털, Cloudflare Pages, GA4)
- Day 2~3: Next.js 스캐폴딩 + 기본 페이지 5개
- Day 4~5: 공공데이터 collector 개발
- Day 6~7: Claude 요약 파이프라인

### Phase 2 (Week 2): 자동 컨텐츠 생성
- 지원금/정책 30~50 페이지 자동 생성
- SEO 메타태그, sitemap.xml, robots.txt
- Google Search Console 등록

### Phase 3 (Week 3): 트렌드 페이지
- Pulse 데이터 → `/trends` 페이지
- 실시간 업데이트 (Cloudflare Workers)

### Phase 4 (Week 4+): 수익화
- AdSense 신청 (페이지 50+ 확보 후)
- Google 색인 요청
- 쿠팡 파트너스 연결
- 성과 모니터링

## 리스크 & 대응

| 리스크 | 대응 |
|---|---|
| AdSense 심사 탈락 | 대안: 카카오 애드핏, 네이버 애드포스트, 쿠팡 파트너스 |
| Google 자동생성 페이지 감지 | 원본 데이터 = 팩트, Claude는 요약만, 원본 출처 상단 배치 |
| 공공데이터 API 정책 변경/장애 | 다중 소스 + RSS 백업 |
| 정책 정보 오류 → 법적 리스크 | "원본 출처 확인 필수" 고지 + 원본 링크 상단 배치 |
| SEO 램프 6~12개월 | Direct 트래픽 (Pulse 재활용) 병행 |

## 보류 사항

- **Pulse Android 앱 배포**: 20 tester 문제. 웹 트래픽 확보 후 사용자에게 테스터 요청 or 대체 마켓(Amazon Appstore) 검토. 일단 코드는 유지, 배포 후순위.

## 관련 자산 위치

- 기존 Pulse 코드: `C:\Users\hanjun\google_admob\`
- 블로그 프로젝트 코드: `C:\Users\hanjun\earn_money\src\` (예정)
- 도메인/Cloudflare: `ryanpp.com` (사용자 소유)
