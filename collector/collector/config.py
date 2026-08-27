"""Config loader — reads .env from repo root."""
from __future__ import annotations

from pathlib import Path
from urllib.parse import quote, unquote

from dotenv import load_dotenv
import os

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"

load_dotenv(REPO_ROOT / ".env")


def _normalize_service_key(raw: str) -> str:
    """data.go.kr serviceKey를 항상 URL-encoded 형태로 통일.

    로컬 .env는 URL-encoded (Z%2B...) 형태, GitHub Secrets는 raw (Z+...)로
    저장돼 있을 수 있음. quote(unquote(x))는 두 경우 모두 encoded로 변환.
    """
    return quote(unquote(raw), safe="")


class Config:
    """공용 설정. 인증키는 data.go.kr 계정당 1개."""

    DATA_GO_KR_API_KEY: str = _normalize_service_key(os.environ["DATA_GO_KR_API_KEY"])
    WEATHER_API_BASE: str = os.environ["WEATHER_API_BASE"]
    WELFARE_API_BASE: str = os.environ["WELFARE_API_BASE"]

    @classmethod
    def check(cls) -> None:
        assert cls.DATA_GO_KR_API_KEY, "DATA_GO_KR_API_KEY missing in .env"
        assert cls.WEATHER_API_BASE.startswith("https://"), "WEATHER_API_BASE invalid"
        assert cls.WELFARE_API_BASE.startswith("https://"), "WELFARE_API_BASE invalid"
