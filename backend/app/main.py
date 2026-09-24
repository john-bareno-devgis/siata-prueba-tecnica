from contextlib import asynccontextmanager

import psycopg
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .db import close_pool, open_pool
from .routers import health, intersect, stats


@asynccontextmanager
async def lifespan(app: FastAPI):
    open_pool()
    yield
    close_pool()


app = FastAPI(
    title="SIATA - Coberturas CLC Valle de Aburrá",
    description="API espacial sobre CORINE Land Cover 2018 recortado al Valle de Aburrá.",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(health.router, prefix="/api")
app.include_router(intersect.router, prefix="/api")
app.include_router(stats.router, prefix="/api")


@app.exception_handler(psycopg.OperationalError)
async def db_down_handler(request: Request, exc: psycopg.OperationalError):
    return JSONResponse(
        status_code=503,
        content={"detail": "Base de datos no disponible."},
    )
