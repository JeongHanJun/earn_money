"""Config loader — reads .env from repo root."""
from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
import os

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"

load_dotenv(REPO_ROOT / ".env")


class Config:
    """공용 설정. 인증키는 data.go.kr 계정당 1개."""

    DATA_GO_KR_API_KEY: str = os.environ["DATA_GO_KR_API_KEY"]
    WEATHER_API_BASE: str = os.environ["WEATHER_API_BASE"]
    WELFARE_API_BASE: str = os.environ["WELFARE_API_BASE"]

    @classmethod
    def check(cls) -> None:
        assert cls.DATA_GO_KR_API_KEY, "DATA_GO_KR_API_KEY missing in .env"
        assert cls.WEATHER_API_BASE.startswith("https://"), "WEATHER_API_BASE invalid"
        assert cls.WELFARE_API_BASE.startswith("https://"), "WELFARE_API_BASE invalid"
