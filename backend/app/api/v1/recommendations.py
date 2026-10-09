from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_routing, get_workspace
from app.api.usecases import run_recommendation
from app.schemas.recommendation import PackageRecommendation, RecommendationRequest
from app.services.routing import OSRMClient

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.post("", response_model=list[PackageRecommendation])
async def recommend(
    body: RecommendationRequest,
    db: Session = Depends(get_db),
    ws: str = Depends(get_workspace),
    routing: OSRMClient = Depends(get_routing),
):
    return await run_recommendation(body, db, ws, routing)
