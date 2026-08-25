"""기상청 단기예보 조회서비스 클라이언트.

API 활용가이드: docs/api_reference/weather/weather_api_guide.docx
- getUltraSrtNcst: 초단기실황 (1시간 이내)
- getUltraSrtFcst: 초단기예보 (6시간 이내)
- getVilageFcst:   단기예보 (3일간, 3시간 간격)  ← 블로그 컨텐츠에 주로 사용

단기예보 base_time: 02, 05, 08, 11, 14, 17, 20, 23시 발표.
데이터는 발표 10분 이후 조회 가능.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

import requests

from .config import Config
from .grid import Grid

# 단기예보 발표 시각 (HH)
_VILAGE_BASE_TIMES = [2, 5, 8, 11, 14, 17, 20, 23]


def _latest_base_datetime(now: datetime) -> tuple[str, str]:
    """현재 시각 기준으로 사용 가능한 가장 최근 base_date, base_time.

    발표 후 10분은 데이터 준비 시간으로 간주하여 이전 발표를 사용.
    """
    candidate = now - timedelta(minutes=10)
    for hour in reversed(_VILAGE_BASE_TIMES):
        if candidate.hour >= hour:
            return candidate.strftime("%Y%m%d"), f"{hour:02d}00"
    # 새벽(00~01시)이라 오늘 발표가 없으면 어제 23시 사용
    yesterday = candidate - timedelta(days=1)
    return yesterday.strftime("%Y%m%d"), "2300"


@dataclass
class ForecastItem:
    """단기예보 개별 응답 항목."""

    base_date: str
    base_time: str
    fcst_date: str
    fcst_time: str
    category: str
    fcst_value: str
    nx: int
    ny: int

    @classmethod
    def from_api(cls, raw: dict[str, Any]) -> "ForecastItem":
        return cls(
            base_date=raw["baseDate"],
            base_time=raw["baseTime"],
            fcst_date=raw["fcstDate"],
            fcst_time=raw["fcstTime"],
            category=raw["category"],
            fcst_value=str(raw["fcstValue"]),
            nx=int(raw["nx"]),
            ny=int(raw["ny"]),
        )


@dataclass
class ForecastResponse:
    grid: Grid
    base_date: str
    base_time: str
    items: list[ForecastItem] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        return {
            "grid": {"nx": self.grid.nx, "ny": self.grid.ny},
            "base_date": self.base_date,
            "base_time": self.base_time,
            "count": len(self.items),
            "items": [
                {
                    "base_date": it.base_date,
                    "base_time": it.base_time,
                    "fcst_date": it.fcst_date,
                    "fcst_time": it.fcst_time,
                    "category": it.category,
                    "fcst_value": it.fcst_value,
                    "nx": it.nx,
                    "ny": it.ny,
                }
                for it in self.items
            ],
        }


class WeatherClient:
    """기상청 단기예보 API 클라이언트."""

    def __init__(self, timeout: float = 10.0) -> None:
        self._session = requests.Session()
        self._timeout = timeout

    def village_forecast(
        self,
        grid: Grid,
        base_date: str | None = None,
        base_time: str | None = None,
        num_rows: int = 1000,
    ) -> ForecastResponse:
        """단기예보 (getVilageFcst) 조회. 3일치 3시간 간격 예보."""
        if base_date is None or base_time is None:
            base_date, base_time = _latest_base_datetime(datetime.now())

        url = f"{Config.WEATHER_API_BASE}/getVilageFcst"
        params = {
            "serviceKey": Config.DATA_GO_KR_API_KEY,
            "pageNo": 1,
            "numOfRows": num_rows,
            "dataType": "JSON",
            "base_date": base_date,
            "base_time": base_time,
            "nx": grid.nx,
            "ny": grid.ny,
        }

        # serviceKey가 이미 URL-encoded 상태이므로 requests가 이중 인코딩하지 않도록 raw로 전달.
        resp = self._session.get(url, params=_no_double_encode(params), timeout=self._timeout)
        resp.raise_for_status()
        payload = resp.json()

        header = payload["response"]["header"]
        if header["resultCode"] != "00":
            raise RuntimeError(
                f"기상청 API 오류: {header['resultCode']} - {header['resultMsg']}"
            )

        body_items = payload["response"]["body"]["items"]["item"]
        items = [ForecastItem.from_api(it) for it in body_items]
        return ForecastResponse(
            grid=grid, base_date=base_date, base_time=base_time, items=items
        )


def _no_double_encode(params: dict[str, Any]) -> str:
    """serviceKey가 URL-encoded 상태로 저장되어 있으므로 그대로 붙임."""
    parts = []
    for k, v in params.items():
        if k == "serviceKey":
            parts.append(f"{k}={v}")
        else:
            parts.append(f"{k}={v}")
    return "&".join(parts)
