from fastapi import APIRouter, Depends, HTTPException

from app.api.usecases import routing_http_error
from app.api.deps import get_routing
from app.schemas.routing import CoordinatesRequest, MatrixResponse, RouteResponse, RoutingStatus
from app.services.routing import InvalidCoordinates, OSRMClient, RoutingUnavailable

router = APIRouter(prefix="/routing", tags=["routing"])


@router.post("/route", response_model=RouteResponse)
async def route(body: CoordinatesRequest, client: OSRMClient = Depends(get_routing)):
    try:
        return await client.route_or_fallback(body.coordinates, body.allow_fallback_estimate)
    except (RoutingUnavailable, InvalidCoordinates) as exc:
        raise routing_http_error(exc) from exc


@router.post("/matrix", response_model=MatrixResponse)
async def matrix(body: CoordinatesRequest, client: OSRMClient = Depends(get_routing)):
    try:
        return await client.matrix_or_fallback(body.coordinates, body.allow_fallback_estimate)
    except (RoutingUnavailable, InvalidCoordinates) as exc:
        raise routing_http_error(exc) from exc


@router.get("/status", response_model=RoutingStatus)
async def status(client: OSRMClient = Depends(get_routing)):
    return await client.status()
