from __future__ import annotations

from datetime import datetime
from typing import Annotated, Generic, TypeVar

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

T = TypeVar("T")


def _aware(v: datetime | None) -> datetime | None:
    """Naive datetimes are rejected: every timestamp must carry an offset (stored as UTC)."""
    if v is None:
        return v
    if v.tzinfo is None:
        raise ValueError("datetime must be timezone-aware (e.g. 2026-01-01T10:00:00+05:30 or Z)")
    return v


AwareDatetime = Annotated[datetime, AfterValidator(_aware)]
Latitude = Annotated[float, Field(ge=-90, le=90)]
Longitude = Annotated[float, Field(ge=-180, le=180)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


class Coordinate(BaseModel):
    lat: Latitude
    lng: Longitude
