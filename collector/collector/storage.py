"""JSON output helpers — 수집 결과를 data/ 폴더에 저장."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import DATA_DIR


def write_json(relative_path: str, payload: Any) -> Path:
    """data/{relative_path} 에 JSON 저장. metadata(fetched_at, source) 자동 첨부."""
    path = DATA_DIR / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)

    wrapped = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "data": payload,
    }

    path.write_text(
        json.dumps(wrapped, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return path
