from fastapi import APIRouter

from app.api.v1 import analytics, health, optimization, recommendations, resources, routing, travel

api_router = APIRouter(prefix="/api/v1")
for r in (
    health.router, routing.router, recommendations.router, optimization.router,
    resources.locations, resources.packages, resources.vehicles, resources.events,
    resources.plans, resources.scenarios, resources.settings_router, analytics.router,
    travel.router,
):
    api_router.include_router(r)
