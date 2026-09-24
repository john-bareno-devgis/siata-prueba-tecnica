from fastapi import APIRouter

from ..schemas.stats import StatsResponse
from ..services.geo import get_stats

router = APIRouter(tags=["stats"])


@router.get("/stats", response_model=StatsResponse)
def stats():
    coberturas, total_ha = get_stats()
    return {"coberturas": coberturas, "total_ha": total_ha}
