from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, model_validator


class GeoJSONGeometry(BaseModel):
    type: Literal["Polygon", "MultiPolygon"]
    coordinates: list[Any]


class PointQuery(BaseModel):
    lon: float = Field(..., ge=-180, le=180)
    lat: float = Field(..., ge=-90, le=90)


class IntersectRequest(BaseModel):
    geometry: Optional[GeoJSONGeometry] = None
    point: Optional[PointQuery] = None
    # Tope de 50 km: cubre de sobra la diagonal del área de estudio
    # recortada (~35 km) sin permitir buffers desproporcionados.
    radius_m: Optional[float] = Field(None, gt=0, le=50_000)

    @model_validator(mode="after")
    def _una_sola_opcion(self) -> "IntersectRequest":
        usa_geometria = self.geometry is not None
        usa_punto = self.point is not None
        if usa_geometria == usa_punto:
            raise ValueError(
                "Envíe exactamente una opción: 'geometry' o ('point' + 'radius_m')."
            )
        if usa_punto and self.radius_m is None:
            raise ValueError("'point' requiere también 'radius_m'.")
        return self


class CoberturaFeatureProps(BaseModel):
    codigo: str
    cobertura: str
    area_ha: float
    pct: float


class IntersectSummary(BaseModel):
    total_ha: float
    n_coberturas: int


class IntersectResponse(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[dict]
    query_geometry: dict
    summary: IntersectSummary
