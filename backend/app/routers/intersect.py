from fastapi import APIRouter, HTTPException

from ..schemas.intersect import IntersectRequest, IntersectResponse
from ..services.geo import InvalidGeometryError, run_intersect

router = APIRouter(tags=["intersect"])


@router.post("/intersect", response_model=IntersectResponse)
def intersect(payload: IntersectRequest):
    try:
        features, query_geometry, summary = run_intersect(payload)
    except InvalidGeometryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "type": "FeatureCollection",
        "features": features,
        "query_geometry": query_geometry,
        "summary": summary,
    }
