"""온통청년 청년정책 API 클라이언트 (JSON 응답).

Base URL: https://www.youthcenter.go.kr/go/ythip/getPlcy
Auth: apiKeyNm query param (UUID 형식)
Response: JSON

## 실 응답 스키마 핵심 필드
- plcyNo: 정책번호
- plcyNm: 정책명
- plcyKywdNm: 정책키워드
- plcyExplnCn: 정책설명
- plcySprtCn: 지원내용
- plcyAplyMthdCn: 신청방법 (텍스트)
- aplyUrlAddr: 신청 URL ★
- refUrlAddr1/2: 참고 URL
- sprvsnInstCdNm: 주관기관
- bizPrdBgngYmd/bizPrdEndYmd: 사업기간
- aplyYmd: 신청기간 (문자열, "20260812 ~ 20260909")
- sprtTrgtMinAge/MaxAge: 지원대상 연령
- earnCndSeCd, earnMinAmt/MaxAmt: 소득조건
- addAplyQlfcCndCn: 추가 자격
- lclsfNm/mclsfNm: 대/중 분류
- inqCnt: 조회수
- zipCd: 우편번호 (지역 필터)
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any

import requests


BASE_URL = "https://www.youthcenter.go.kr/go/ythip"


@dataclass
class YouthPolicy:
    plcy_no: str
    name: str
    keyword: str
    description: str          # plcyExplnCn
    support_content: str      # plcySprtCn
    apply_method: str         # plcyAplyMthdCn (텍스트 안내)
    apply_url: str            # aplyUrlAddr ★ 실 신청 링크
    ref_urls: list[str]       # refUrlAddr1, refUrlAddr2
    department: str           # sprvsnInstCdNm
    biz_start: str            # bizPrdBgngYmd
    biz_end: str              # bizPrdEndYmd
    apply_period: str         # aplyYmd
    min_age: int
    max_age: int
    age_limit: bool           # sprtTrgtAgeLmtYn
    earn_min: int
    earn_max: int
    earn_note: str            # earnEtcCn
    add_qual: str             # addAplyQlfcCndCn
    submission_docs: str      # sbmsnDcmntCn
    screening: str            # srngMthdCn
    etc: str                  # etcMttrCn
    major_category: str       # lclsfNm
    sub_category: str         # mclsfNm
    inquiry_count: int
    zip_codes: list[str]      # zipCd (지역 필터)
    first_reg: str            # frstRegDt

    @classmethod
    def from_json(cls, item: dict[str, Any]) -> "YouthPolicy":
        def s(key: str) -> str:
            v = item.get(key)
            return str(v).strip() if v is not None else ""

        def i(key: str) -> int:
            v = item.get(key)
            try:
                return int(v) if v not in (None, "") else 0
            except (ValueError, TypeError):
                return 0

        refs = [item.get("refUrlAddr1", ""), item.get("refUrlAddr2", "")]
        refs = [r for r in refs if r and r.strip()]

        return cls(
            plcy_no=s("plcyNo"),
            name=s("plcyNm"),
            keyword=s("plcyKywdNm"),
            description=s("plcyExplnCn"),
            support_content=s("plcySprtCn"),
            apply_method=s("plcyAplyMthdCn"),
            apply_url=s("aplyUrlAddr"),
            ref_urls=refs,
            department=s("sprvsnInstCdNm"),
            biz_start=s("bizPrdBgngYmd"),
            biz_end=s("bizPrdEndYmd"),
            apply_period=s("aplyYmd"),
            min_age=i("sprtTrgtMinAge"),
            max_age=i("sprtTrgtMaxAge"),
            age_limit=s("sprtTrgtAgeLmtYn").upper() == "Y",
            earn_min=i("earnMinAmt"),
            earn_max=i("earnMaxAmt"),
            earn_note=s("earnEtcCn"),
            add_qual=s("addAplyQlfcCndCn"),
            submission_docs=s("sbmsnDcmntCn"),
            screening=s("srngMthdCn"),
            etc=s("etcMttrCn"),
            major_category=s("lclsfNm"),
            sub_category=s("mclsfNm"),
            inquiry_count=i("inqCnt"),
            zip_codes=[z.strip() for z in s("zipCd").split(",") if z.strip()],
            first_reg=s("frstRegDt"),
        )

    def to_json(self) -> dict[str, Any]:
        return {
            "plcy_no": self.plcy_no,
            "name": self.name,
            "keyword": self.keyword,
            "description": self.description,
            "support_content": self.support_content,
            "apply_method": self.apply_method,
            "apply_url": self.apply_url,
            "ref_urls": self.ref_urls,
            "department": self.department,
            "biz_start": self.biz_start,
            "biz_end": self.biz_end,
            "apply_period": self.apply_period,
            "min_age": self.min_age,
            "max_age": self.max_age,
            "age_limit": self.age_limit,
            "earn_min": self.earn_min,
            "earn_max": self.earn_max,
            "earn_note": self.earn_note,
            "add_qual": self.add_qual,
            "submission_docs": self.submission_docs,
            "screening": self.screening,
            "etc": self.etc,
            "major_category": self.major_category,
            "sub_category": self.sub_category,
            "inquiry_count": self.inquiry_count,
            "zip_codes": self.zip_codes,
            "first_reg": self.first_reg,
        }


@dataclass
class YouthListResponse:
    total_count: int
    page_num: int
    page_size: int
    items: list[YouthPolicy] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        return {
            "total_count": self.total_count,
            "page_num": self.page_num,
            "page_size": self.page_size,
            "count": len(self.items),
            "items": [p.to_json() for p in self.items],
        }


class YouthClient:
    def __init__(self, timeout: float = 10.0) -> None:
        self._session = requests.Session()
        self._timeout = timeout
        self._api_key = os.environ["YOUTH_API_KEY"]

    def list_policies(
        self,
        page_num: int = 1,
        page_size: int = 100,
    ) -> YouthListResponse:
        url = f"{BASE_URL}/getPlcy"
        params = {
            "apiKeyNm": self._api_key,
            "pageType": "1",
            "pageNum": page_num,
            "pageSize": page_size,
            "rtnType": "json",
        }
        resp = self._session.get(url, params=params, timeout=self._timeout)
        resp.raise_for_status()
        data = resp.json()

        if data.get("resultCode") not in (200, "200"):
            raise RuntimeError(
                f"온통청년 API 오류: {data.get('resultCode')} - {data.get('resultMessage')}"
            )

        result = data["result"]
        paging = result["pagging"]
        items = [YouthPolicy.from_json(it) for it in result.get("youthPolicyList", [])]

        return YouthListResponse(
            total_count=int(paging["totCount"]),
            page_num=int(paging["pageNum"]),
            page_size=int(paging["pageSize"]),
            items=items,
        )
