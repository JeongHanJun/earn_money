# collector — 공공데이터 수집기

now.ryanpp 블로그의 컨텐츠 원천 데이터를 수집한다.

## 실행 환경

- Python 3.11+
- 인증키는 repo 루트 `.env` (`DATA_GO_KR_API_KEY`)

## 설치

```bash
cd collector
python -m venv .venv
.venv/Scripts/activate      # Windows
# source .venv/bin/activate # macOS/Linux
pip install -r requirements.txt
```

## 실행

```bash
# 주요 10개 도시 단기예보 수집 → data/weather/{region}.json
python scripts/fetch_weather.py

# 중앙부처 복지서비스 목록 수집 → data/welfare/list.json
python scripts/fetch_welfare.py
```

## 구조

```
collector/
├── collector/            # 라이브러리 코드
│   ├── config.py         # .env 로더
│   ├── grid.py           # 위경도 ↔ 기상청 격자 변환
│   ├── weather.py        # 기상청 단기예보 클라이언트
│   ├── welfare.py        # 중앙부처 복지 클라이언트
│   └── storage.py        # JSON 출력
├── scripts/              # CLI 진입점
│   ├── fetch_weather.py
│   └── fetch_welfare.py
├── requirements.txt
└── pyproject.toml
```

## 출력 위치

- `data/weather/{region}.json` — 지역별 3일치 단기예보 (3시간 간격)
- `data/welfare/list.json` — 복지서비스 목록 (페이지네이션 결과)

Next.js 빌드 시 이 JSON 파일들을 read 하여 정적 페이지 생성 (STEP 5).

## 참고

- 기상청 API 활용가이드: `docs/api_reference/weather/weather_api_guide.docx`
- 복지 API 활용가이드: `docs/api_reference/welfare/welfare_api_guide.doc`
- 인증키는 계정당 1개 공용 (data.go.kr)
