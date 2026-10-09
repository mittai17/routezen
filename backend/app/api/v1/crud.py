"""Generic CRUD router factory over the repository interface."""
from typing import Any, Callable, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel
from sqlalchemy import Boolean, Float, Integer
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.csvutil import to_csv_response
from app.api.deps import get_db, get_workspace
from app.repositories.base import SqlRepository
from app.schemas.common import Page

Prepare = Callable[[dict[str, Any], Session, str], None]


def _coerce(model: type, field: str, raw: str) -> Any:
    ctype = getattr(model, field).type
    try:
        if isinstance(ctype, Boolean):
            if raw.lower() in ("1", "true", "yes"):
                return True
            if raw.lower() in ("0", "false", "no"):
                return False
            raise ValueError
        if isinstance(ctype, Integer):
            return int(raw)
        if isinstance(ctype, Float):
            return float(raw)
    except ValueError:
        raise HTTPException(422, f"invalid value for filter '{field}'") from None
    return raw


def check_fks(session: Session, ws: str, data: dict[str, Any], fks: dict[str, type]) -> None:
    for field, model in fks.items():
        val = data.get(field)
        if val is None:
            continue
        obj = session.get(model, val)
        if obj is None or obj.workspace_id != ws:
            raise HTTPException(422, f"{field} '{val}' does not exist")


def build_crud_router(
    *,
    prefix: str,
    tag: str,
    model: type,
    create_schema: type[BaseModel],
    read_schema: type[BaseModel],
    filter_fields: tuple[str, ...] = (),
    search_fields: tuple[str, ...] = (),
    csv_columns: tuple[str, ...] = (),
    default_sort: str = "created_at",
    fks: dict[str, type] | None = None,
    prepare: Prepare | None = None,
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[tag])
    sortable = set(csv_columns) | {"created_at", "updated_at"}

    def repo(db: Session, ws: str) -> SqlRepository:
        return SqlRepository(db, model, ws, search_fields)

    def prep(data: dict[str, Any], db: Session, ws: str) -> dict[str, Any]:
        check_fks(db, ws, data, fks or {})
        if prepare:
            prepare(data, db, ws)
        return data

    def guard(fn: Callable[[], Any], db: Session):
        try:
            return fn()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(409, "constraint violation (duplicate or referenced record)") from exc

    @router.get("", response_model=Page[read_schema])  # type: ignore[valid-type]
    def list_items(
        request: Request,
        limit: int = Query(50, ge=1, le=500),
        offset: int = Query(0, ge=0),
        q: str | None = Query(None, max_length=100),
        sort: str = default_sort,
        order: Literal["asc", "desc"] = "desc",
        db: Session = Depends(get_db),
        ws: str = Depends(get_workspace),
    ):
        if sort not in sortable:
            raise HTTPException(422, f"sort must be one of {sorted(sortable)}")
        filters = {f: _coerce(model, f, request.query_params[f]) for f in filter_fields if f in request.query_params}
        items, total = repo(db, ws).list(filters, q, sort, order, limit, offset)
        return {"items": items, "total": total, "limit": limit, "offset": offset}

    @router.get("/export.csv")
    def export_csv(
        request: Request,
        q: str | None = Query(None, max_length=100),
        db: Session = Depends(get_db),
        ws: str = Depends(get_workspace),
    ):
        filters = {f: _coerce(model, f, request.query_params[f]) for f in filter_fields if f in request.query_params}
        items, _ = repo(db, ws).list(filters, q, default_sort, "desc", 10000, 0)
        return to_csv_response(items, csv_columns or ("id",), f"{prefix.strip('/')}.csv")

    @router.post("", response_model=read_schema, status_code=201)
    def create_item(body: create_schema, db: Session = Depends(get_db), ws: str = Depends(get_workspace)):  # type: ignore[valid-type]
        data = prep(body.model_dump(), db, ws)
        return guard(lambda: repo(db, ws).create(data), db)

    @router.get("/{item_id}", response_model=read_schema)
    def get_item(item_id: str, db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
        obj = repo(db, ws).get(item_id)
        if obj is None:
            raise HTTPException(404, f"{tag} not found")
        return obj

    @router.put("/{item_id}", response_model=read_schema)
    def update_item(item_id: str, body: create_schema, db: Session = Depends(get_db), ws: str = Depends(get_workspace)):  # type: ignore[valid-type]
        data = prep(body.model_dump(), db, ws)
        obj = guard(lambda: repo(db, ws).update(item_id, data), db)
        if obj is None:
            raise HTTPException(404, f"{tag} not found")
        return obj

    @router.delete("/{item_id}", status_code=204)
    def delete_item(item_id: str, db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
        if not guard(lambda: repo(db, ws).delete(item_id), db):
            raise HTTPException(404, f"{tag} not found")
        return Response(status_code=204)

    return router
