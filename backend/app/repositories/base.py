"""Repository interface + SQLAlchemy implementation."""
from __future__ import annotations

from typing import Any, Generic, Protocol, TypeVar

from sqlalchemy import String, asc, desc, func, or_, select
from sqlalchemy.orm import Session

from app.db.models import Workspace

M = TypeVar("M")


class Repository(Protocol[M]):
    def list(self, filters: dict[str, Any], search: str | None, sort: str, order: str, limit: int, offset: int) -> tuple[list[M], int]: ...
    def get(self, id: str) -> M | None: ...
    def create(self, data: dict[str, Any]) -> M: ...
    def update(self, id: str, data: dict[str, Any]) -> M | None: ...
    def delete(self, id: str) -> bool: ...


def ensure_workspace(session: Session, workspace_id: str) -> None:
    if session.get(Workspace, workspace_id) is None:
        session.add(Workspace(id=workspace_id, name="Dev Workspace"))
        session.flush()


class SqlRepository(Generic[M]):
    def __init__(self, session: Session, model: type[M], workspace_id: str, search_fields: tuple[str, ...] = ()):
        self.s, self.model, self.ws, self.search_fields = session, model, workspace_id, search_fields

    def _base(self):
        return select(self.model).where(self.model.workspace_id == self.ws)  # type: ignore[attr-defined]

    def list(self, filters, search, sort, order, limit, offset):
        stmt = self._base()
        for k, v in filters.items():
            stmt = stmt.where(getattr(self.model, k) == v)
        if search and self.search_fields:
            like = f"%{search.lower()}%"
            stmt = stmt.where(or_(*[func.lower(getattr(self.model, f).cast(String)).like(like) for f in self.search_fields]))
        total = self.s.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        col = getattr(self.model, sort)
        stmt = stmt.order_by(desc(col) if order == "desc" else asc(col), self.model.id).limit(limit).offset(offset)  # type: ignore[attr-defined]
        return list(self.s.scalars(stmt)), total

    def get(self, id):
        obj = self.s.get(self.model, id)
        return obj if obj is not None and obj.workspace_id == self.ws else None  # type: ignore[attr-defined]

    def create(self, data):
        ensure_workspace(self.s, self.ws)
        obj = self.model(workspace_id=self.ws, **data)
        self.s.add(obj)
        self.s.commit()
        self.s.refresh(obj)
        return obj

    def update(self, id, data):
        obj = self.get(id)
        if obj is None:
            return None
        for k, v in data.items():
            setattr(obj, k, v)
        self.s.commit()
        self.s.refresh(obj)
        return obj

    def delete(self, id):
        obj = self.get(id)
        if obj is None:
            return False
        self.s.delete(obj)
        self.s.commit()
        return True
