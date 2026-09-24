import psycopg
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..services.geo import get_postgis_version

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    try:
        version = get_postgis_version()
    except psycopg.Error:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "detail": "Base de datos no disponible."},
        )
    return {"status": "ok", "postgis_version": version}
