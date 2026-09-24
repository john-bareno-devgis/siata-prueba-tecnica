from pydantic import BaseModel


class CoberturaStat(BaseModel):
    codigo: str
    cobertura: str
    area_ha: float
    pct: float


class StatsResponse(BaseModel):
    coberturas: list[CoberturaStat]
    total_ha: float
