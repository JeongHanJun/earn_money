"""중앙부처 복지서비스 클라이언트.

API 활용가이드: docs/api_reference/welfare/welfare_api_guide.doc
- NationalWelfarelistV001: 복지서비스 목록 조회
- NationalWelfaredetailedV001: 복지서비스 상세 조회

응답 포맷은 XML.

## 실 응답 스키마 (확인 완료)

    <servList>
      <servId>WLF00000023</servId>            서비스 고유 ID
      <servNm>서비스명</servNm>
      <servDgst>서비스 요약</servDgst>
      <servDtlLink>원문 링크</servDtlLink>
      <jurMnofNm>담당부처</jurMnofNm>
      <jurOrgNm>담당조직</jurOrgNm>
      <rprsCtadr>대표연락처</rprsCtadr>
      <intrsThemaArray>관심주제(콤마 구분)</intrsThemaArray>
      <lifeArray>생애주기(옵션, 콤마 구분)</lifeArray>
      <onapPsbltYn>온라인신청가능여부 Y/N</onapPsbltYn>
      <sprtCycNm>지원주기</sprtCycNm>
      <srvPvsnNm>서비스제공유형</srvPvsnNm>
      <svcfrstRegTs>최초등록일 YYYYMMDD</svcfrstRegTs>
      <inqNum>조회수</inqNum>
    </servList>

## 필수 파라미터

    serviceKey, callTp=L, pageNo, numOfRows, srchKeyCode
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Any

import requests

from .config import Config


@dataclass
class WelfareService:
    """복지서비스 목록 항목."""

    service_id: str
    service_name: str
    summary: str
    detail_url: str
    department: str
    org_name: str
    contact: str
    interest_topics: list[str]      # ['보육', '보호·돌봄']
    life_stages: list[str]          # ['영유아', '아동', '청소년']
    online_apply: bool              # Y/N → True/False
    support_cycle: str              # 1회성 / 월별 / 수시 등
    provision_type: str             # 현물 / 현금 / 서비스 등
    first_registered: str           # YYYYMMDD
    inquiry_count: int

    @classmethod
    def from_xml(cls, elem: ET.Element) -> "WelfareService":
        def _t(tag: str, default: str = "") -> str:
            node = elem.find(tag)
            return (node.text or default).strip() if node is not None and node.text else default

        def _list(tag: str) -> list[str]:
            raw = _t(tag)
            return [x.strip() for x in raw.split(",") if x.strip()] if raw else []

        def _int(tag: str) -> int:
            raw = _t(tag)
            try:
                return int(raw)
            except ValueError:
                return 0

        return cls(
            service_id=_t("servId"),
            service_name=_t("servNm"),
            summary=_t("servDgst"),
            detail_url=_t("servDtlLink"),
            department=_t("jurMnofNm"),
            org_name=_t("jurOrgNm"),
            contact=_t("rprsCtadr"),
            interest_topics=_list("intrsThemaArray"),
            life_stages=_list("lifeArray"),
            online_apply=_t("onapPsbltYn").upper() == "Y",
            support_cycle=_t("sprtCycNm"),
            provision_type=_t("srvPvsnNm"),
            first_registered=_t("svcfrstRegTs"),
            inquiry_count=_int("inqNum"),
        )


@dataclass
class WelfareListResponse:
    total_count: int
    page_no: int
    num_of_rows: int
    items: list[WelfareService] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        return {
            "total_count": self.total_count,
            "page_no": self.page_no,
            "num_of_rows": self.num_of_rows,
            "count": len(self.items),
            "items": [
                {
                    "service_id": it.service_id,
                    "service_name": it.service_name,
                    "summary": it.summary,
                    "detail_url": it.detail_url,
                    "department": it.department,
                    "org_name": it.org_name,
                    "contact": it.contact,
                    "interest_topics": it.interest_topics,
                    "life_stages": it.life_stages,
                    "online_apply": it.online_apply,
                    "support_cycle": it.support_cycle,
                    "provision_type": it.provision_type,
                    "first_registered": it.first_registered,
                    "inquiry_count": it.inquiry_count,
                }
                for it in self.items
            ],
        }


@dataclass
class WelfareServiceDetail:
    """복지서비스 상세 (신청방법/지원대상/선정기준/지원내용/문의처/법령/서식)."""

    service_id: str
    service_name: str
    department: str
    target_detail: str          # 지원대상
    selection_criteria: str     # 선정기준
    benefit_detail: str         # 지원내용
    outline: str                # 서비스 개요
    reference_year: str
    contact: str
    support_cycle: str
    provision_type: str
    life_stages: list[str]
    target_groups: list[str]    # 대상특성 (다자녀, 다문화·탈북민 등)
    interest_topics: list[str]
    apply_methods: list[dict]   # {name, description}
    inquiry_contacts: list[dict]  # {name, contact}
    related_sites: list[dict]     # {name, url}
    forms: list[dict]           # {name, url}
    laws: list[str]

    @classmethod
    def from_xml(cls, root: ET.Element) -> "WelfareServiceDetail":
        def _t(tag: str, default: str = "") -> str:
            node = root.find(f".//{tag}")
            return (node.text or default).strip() if node is not None and node.text else default

        def _list(tag: str) -> list[str]:
            raw = _t(tag)
            return [x.strip() for x in raw.split(",") if x.strip()] if raw else []

        def _entries(list_tag: str, name_key: str = "servSeDetailNm", link_key: str = "servSeDetailLink") -> list[dict]:
            entries: list[dict] = []
            seen: set[tuple[str, str]] = set()
            for elem in root.findall(f".//{list_tag}"):
                name = (elem.findtext(name_key) or "").strip()
                link = (elem.findtext(link_key) or "").strip()
                if not name and not link:
                    continue
                key = (name, link)
                if key in seen:
                    continue
                seen.add(key)
                entries.append({"name": name, "description": link} if list_tag == "applmetList" else {"name": name, "url": link})
            return entries

        return cls(
            service_id=_t("servId"),
            service_name=_t("servNm"),
            department=_t("jurMnofNm"),
            target_detail=_t("tgtrDtlCn"),
            selection_criteria=_t("slctCritCn"),
            benefit_detail=_t("alwServCn"),
            outline=_t("wlfareInfoOutlCn"),
            reference_year=_t("crtrYr"),
            contact=_t("rprsCtadr"),
            support_cycle=_t("sprtCycNm"),
            provision_type=_t("srvPvsnNm"),
            life_stages=_list("lifeArray"),
            target_groups=_list("trgterIndvdlArray"),
            interest_topics=_list("intrsThemaArray"),
            apply_methods=_entries("applmetList"),
            inquiry_contacts=[{"name": e["name"], "contact": e["url"]} for e in _entries("inqplCtadrList")],
            related_sites=_entries("inqplHmpgReldList"),
            forms=_entries("basfrmList"),
            laws=[
                (e.findtext("servSeDetailNm") or "").strip()
                for e in root.findall(".//baslawList")
                if e.findtext("servSeDetailNm")
            ],
        )

    def to_json(self) -> dict[str, Any]:
        return {
            "service_id": self.service_id,
            "service_name": self.service_name,
            "department": self.department,
            "target_detail": self.target_detail,
            "selection_criteria": self.selection_criteria,
            "benefit_detail": self.benefit_detail,
            "outline": self.outline,
            "reference_year": self.reference_year,
            "contact": self.contact,
            "support_cycle": self.support_cycle,
            "provision_type": self.provision_type,
            "life_stages": self.life_stages,
            "target_groups": self.target_groups,
            "interest_topics": self.interest_topics,
            "apply_methods": self.apply_methods,
            "inquiry_contacts": self.inquiry_contacts,
            "related_sites": self.related_sites,
            "forms": self.forms,
            "laws": self.laws,
        }


class WelfareClient:
    """복지 API 클라이언트 (XML 응답 파싱)."""

    def __init__(self, timeout: float = 10.0) -> None:
        self._session = requests.Session()
        self._timeout = timeout

    def get_detail(self, service_id: str) -> WelfareServiceDetail:
        """복지서비스 상세 조회 (신청방법/지원대상/선정기준 등)."""
        url = f"{Config.WELFARE_API_BASE}/NationalWelfaredetailedV001"
        params = {
            "serviceKey": Config.DATA_GO_KR_API_KEY,
            "callTp": "D",
            "servId": service_id,
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        resp = self._session.get(f"{url}?{query}", timeout=self._timeout)
        resp.raise_for_status()

        root = ET.fromstring(resp.text)
        result_code = root.findtext(".//resultCode") or root.findtext(".//cmmMsgHeader/returnReasonCode")
        if result_code and result_code not in ("0", "00"):
            reason = (
                root.findtext(".//resultMessage")
                or root.findtext(".//cmmMsgHeader/returnAuthMsg")
                or "unknown"
            )
            raise RuntimeError(f"복지 상세 API 오류: {result_code} - {reason}")

        return WelfareServiceDetail.from_xml(root)

    def list_services(
        self,
        page_no: int = 1,
        num_of_rows: int = 100,
        search_key: str = "003",  # 003=중앙부처, 001=전체
    ) -> WelfareListResponse:
        """복지서비스 목록 조회."""
        url = f"{Config.WELFARE_API_BASE}/NationalWelfarelistV001"
        params = {
            "serviceKey": Config.DATA_GO_KR_API_KEY,
            "callTp": "L",
            "pageNo": page_no,
            "numOfRows": num_of_rows,
            "srchKeyCode": search_key,
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        resp = self._session.get(f"{url}?{query}", timeout=self._timeout)
        resp.raise_for_status()

        root = ET.fromstring(resp.text)
        result_code = root.findtext(".//resultCode") or root.findtext(".//cmmMsgHeader/returnReasonCode")
        if result_code and result_code not in ("0", "00"):
            reason = (
                root.findtext(".//resultMessage")
                or root.findtext(".//cmmMsgHeader/returnAuthMsg")
                or "unknown"
            )
            raise RuntimeError(f"복지 API 오류: {result_code} - {reason}")

        total = int(root.findtext(".//totalCount") or 0)
        items = [WelfareService.from_xml(el) for el in root.findall(".//servList")]

        return WelfareListResponse(
            total_count=total,
            page_no=page_no,
            num_of_rows=num_of_rows,
            items=items,
        )
