from __future__ import annotations

import csv
import io
import json
from collections.abc import Iterable, Sequence
from typing import Any

from fastapi import Response

_DANGEROUS = ("=", "+", "-", "@", "\t", "\r")


def _cell(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, (dict, list)):
        v = json.dumps(v, default=str)
    s = str(v)
    # CSV/formula injection guard for spreadsheet apps (numbers like -5 are left alone)
    if s.startswith(_DANGEROUS) and not _is_number(s):
        return "'" + s
    return s


def _is_number(s: str) -> bool:
    try:
        float(s)
        return True
    except ValueError:
        return False


def to_csv_response(rows: Iterable[Any], columns: Sequence[str], filename: str) -> Response:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(columns)
    for r in rows:
        w.writerow([_cell(getattr(r, c, None) if not isinstance(r, dict) else r.get(c)) for c in columns])
    return Response(
        buf.getvalue(), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
