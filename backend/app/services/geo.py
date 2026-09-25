import json

import psycopg
from psycopg.rows import dict_row

from ..config import settings
from ..db import pool
from ..schemas.intersect import IntersectRequest

SCHEMA = settings.db_schema
TABLE = settings.db_table


class InvalidGeometryError(Exception):
    """Geometría de entrada mal formada, degenerada o que colapsa a vacío
    tras ST_MakeValid (ej. anillo con <4 puntos, coordenadas duplicadas)."""


def get_postgis_version() -> str:
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT postgis_version();")
        return cur.fetchone()[0]


def get_stats() -> tuple[list[dict], float]:
    # SUM() OVER() calcula el total y el % de cada fila en la misma
    # pasada de agregación, sin una segunda consulta para el total.
    sql = f"""
        WITH por_cobertura AS (
            SELECT codigo, nivel1, nivel3, cobertura, SUM(ST_Area(geom)) / 10000.0 AS area_ha
            FROM {SCHEMA}.{TABLE}
            GROUP BY codigo, nivel1, nivel3, cobertura
        )
        SELECT
            codigo,
            nivel1,
            nivel3,
            cobertura,
            round(area_ha::numeric, 4) AS area_ha,
            round((area_ha / SUM(area_ha) OVER ())::numeric * 100, 2) AS pct,
            round((SUM(area_ha) OVER ())::numeric, 4) AS total_ha
        FROM por_cobertura
        ORDER BY area_ha DESC;
    """
    with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql)
        rows = cur.fetchall()

    total_ha = float(rows[0]["total_ha"]) if rows else 0.0
    coberturas = [
        {
            "codigo": r["codigo"],
            "nivel1": r["nivel1"],
            "nivel3": r["nivel3"],
            "cobertura": r["cobertura"],
            "area_ha": float(r["area_ha"]),
            "pct": float(r["pct"]),
        }
        for r in rows
    ]
    return coberturas, total_ha


def _query_geom_9377(payload: IntersectRequest) -> tuple[str, dict]:
    """Arma la expresión SQL (ya en 9377) para la geometría de consulta,
    según qué opción del payload se usó. Los valores del usuario siempre
    van como parámetros (%(..)s), nunca interpolados en el SQL."""
    if payload.geometry is not None:
        params = {"geojson": json.dumps(payload.geometry.model_dump())}
        expr = (
            "ST_Transform("
            "ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(%(geojson)s), 4326)), "
            "9377)"
        )
        return expr, params

    assert payload.point is not None and payload.radius_m is not None
    params = {
        "lon": payload.point.lon,
        "lat": payload.point.lat,
        "radius_m": payload.radius_m,
    }
    # El buffer se calcula directo en 9377 (SRID métrico) para que
    # radius_m sea un radio exacto en metros, no en grados.
    expr = (
        "ST_Buffer("
        "ST_Transform(ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326), 9377), "
        "%(radius_m)s, 'quad_segs=32')"
    )
    return expr, params


def run_intersect(payload: IntersectRequest) -> tuple[list[dict], dict, dict]:
    query_expr, params = _query_geom_9377(payload)

    with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        try:
            cur.execute(
                f"""
                SELECT
                    ST_AsGeoJSON(ST_Transform({query_expr}, 4326)) AS gj,
                    ST_IsEmpty({query_expr}) AS vacio
                """,
                params,
            )
        except psycopg.Error as exc:
            raise InvalidGeometryError(f"Geometría de consulta inválida: {exc}") from exc

        row = cur.fetchone()
        if row is None or row["gj"] is None or row["vacio"]:
            raise InvalidGeometryError("Geometría de consulta inválida o vacía.")
        query_geometry = json.loads(row["gj"])

        # ST_CollectionExtract(..., 3) se queda solo con la parte
        # poligonal: ST_Intersection puede devolver una GeometryCollection
        # cuando el borde de la consulta toca el borde de un polígono
        # (comparten solo una línea o un punto, no área).
        sql = f"""
            WITH q AS (
                SELECT {query_expr} AS geom
            ),
            intersecciones AS (
                SELECT
                    c.codigo,
                    c.cobertura,
                    ST_CollectionExtract(ST_Intersection(c.geom, q.geom), 3) AS geom
                FROM {SCHEMA}.{TABLE} c, q
                WHERE ST_Intersects(c.geom, q.geom)
            ),
            areas AS (
                SELECT codigo, cobertura, geom, ST_Area(geom) / 10000.0 AS area_ha
                FROM intersecciones
                WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
            )
            SELECT
                codigo,
                cobertura,
                round(area_ha::numeric, 4) AS area_ha,
                round(
                    (area_ha / NULLIF(SUM(area_ha) OVER (), 0))::numeric * 100, 2
                ) AS pct,
                ST_AsGeoJSON(ST_Transform(geom, 4326)) AS geojson
            FROM areas
            ORDER BY area_ha DESC;
        """
        cur.execute(sql, params)
        rows = cur.fetchall()

    features = [
        {
            "type": "Feature",
            "geometry": json.loads(r["geojson"]),
            "properties": {
                "codigo": r["codigo"],
                "cobertura": r["cobertura"],
                "area_ha": float(r["area_ha"]),
                "pct": float(r["pct"]),
            },
        }
        for r in rows
    ]
    total_ha = round(sum(f["properties"]["area_ha"] for f in features), 4)
    n_coberturas = len({f["properties"]["codigo"] for f in features})
    summary = {"total_ha": total_ha, "n_coberturas": n_coberturas}

    return features, query_geometry, summary
