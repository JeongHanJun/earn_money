# API Reference

블로그에서 사용할 외부 API 목록 및 참고문서 위치.

## 인증

- **data.go.kr 계정 공용 키**: `.env` 의 `DATA_GO_KR_API_KEY`
- **한 계정 = 하나의 키**로 모든 승인된 API 사용 가능
- 온통청년(youthcenter.go.kr)은 별도 계정/키

## API 목록

| API | 상태 | 문서 | 엔드포인트 |
|---|---|---|---|
| 기상청 단기예보 | ✅ 승인 (자동) | `weather/weather_api_guide.docx` | `apis.data.go.kr/1360000/VilageFcstInfoService_2.0` |
| 중앙부처 복지서비스 | ✅ 승인 (자동) | `welfare/welfare_api_guide.doc` | `apis.data.go.kr/B554287/NationalWelfareInformationsV001` |
| 온통청년 청년정책 | ⏳ 승인 대기 | (별도 사이트) | `youthcenter.go.kr/opi/openApiSvc.do` |
| 워크넷 채용 | ❌ 제외 | - | 별도 회원가입+수동승인 필요, 나중에 추가 |

## 폴더 구조

```
docs/api_reference/
├── README.md                    ← 여기
├── weather/
│   ├── weather_api_guide.docx   ← 기상청 원문서
│   └── weather_grid_coords.xlsx ← 격자좌표↔위경도 변환표
├── welfare/
│   └── welfare_api_guide.doc    ← 복지 원문서
└── youth/                       ← 승인 후 문서 배치
```

## 사용 시 주의

- 인증키는 이미 URL-encoded 상태 (`%2B`, `%2F`, `%3D` 포함). 파이썬 requests 등에서 자동 인코딩되면 이중인코딩 발생 → 그대로 붙여 쓰거나 디코딩 후 사용
- 각 API별 일일 트래픽 제한 있음 (기본 1,000회/일). 수집기에서 캐싱 필수
