"""기상청 단기예보 격자 좌표 변환 (Lambert Conformal Conic).

기상청은 전국을 5km 격자(nx, ny)로 나누어 예보 제공.
위경도 → 격자 변환식은 기상청 공식 활용가이드에 명시된 상수 사용.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

# LCC projection constants (from 기상청 API 활용가이드)
_RE = 6371.00877       # 지구 반경 (km)
_GRID = 5.0            # 격자 간격 (km)
_SLAT1 = 30.0          # 표준위도 1
_SLAT2 = 60.0          # 표준위도 2
_OLON = 126.0          # 기준점 경도
_OLAT = 38.0           # 기준점 위도
_XO = 43               # 기준점 X 좌표
_YO = 136              # 기준점 Y 좌표

_DEGRAD = math.pi / 180.0
_re = _RE / _GRID
_slat1 = _SLAT1 * _DEGRAD
_slat2 = _SLAT2 * _DEGRAD
_olon = _OLON * _DEGRAD
_olat = _OLAT * _DEGRAD

_sn = math.tan(math.pi * 0.25 + _slat2 * 0.5) / math.tan(math.pi * 0.25 + _slat1 * 0.5)
_sn = math.log(math.cos(_slat1) / math.cos(_slat2)) / math.log(_sn)
_sf = math.tan(math.pi * 0.25 + _slat1 * 0.5)
_sf = (_sf**_sn) * math.cos(_slat1) / _sn
_ro = math.tan(math.pi * 0.25 + _olat * 0.5)
_ro = _re * _sf / (_ro**_sn)


@dataclass(frozen=True)
class Grid:
    nx: int
    ny: int


def latlon_to_grid(lat: float, lon: float) -> Grid:
    """위경도(도) → 기상청 격자 좌표."""
    ra = math.tan(math.pi * 0.25 + lat * _DEGRAD * 0.5)
    ra = _re * _sf / (ra**_sn)
    theta = lon * _DEGRAD - _olon
    if theta > math.pi:
        theta -= 2.0 * math.pi
    if theta < -math.pi:
        theta += 2.0 * math.pi
    theta *= _sn

    nx = int(ra * math.sin(theta) + _XO + 0.5)
    ny = int(_ro - ra * math.cos(theta) + _YO + 0.5)
    return Grid(nx=nx, ny=ny)


# 주요 도시 프리셋 (블로그 페이지 자동 생성용)
REGIONS: dict[str, tuple[float, float]] = {
    "seoul": (37.5665, 126.9780),
    "busan": (35.1796, 129.0756),
    "daegu": (35.8714, 128.6014),
    "incheon": (37.4563, 126.7052),
    "gwangju": (35.1595, 126.8526),
    "daejeon": (36.3504, 127.3845),
    "ulsan": (35.5384, 129.3114),
    "sejong": (36.4801, 127.2890),
    "suwon": (37.2636, 127.0286),
    "jeju": (33.4996, 126.5312),
}


def region_grid(name: str) -> Grid:
    lat, lon = REGIONS[name]
    return latlon_to_grid(lat, lon)
