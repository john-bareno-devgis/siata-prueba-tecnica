#!/bin/sh
# Carga idempotente: si coberturas.clc ya tiene filas, no vuelve a cargar.
# sh (no bash) a propósito: la imagen base de GDAL es Ubuntu mínima y el
# comportamiento debe ser igual en cualquier host (Linux/Windows/Mac).
set -eu

export PGPASSWORD="$POSTGRES_PASSWORD"

SCHEMA="${DB_SCHEMA:-coberturas}"
TABLE="${DB_TABLE:-clc}"
GPKG="/data/CLC_Medellin.gpkg"
LAYER="CLC_Medellin"

PSQL="psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -v ON_ERROR_STOP=1"

EXISTING=$($PSQL -tAc "SELECT count(*) FROM ${SCHEMA}.${TABLE};")

if [ "$EXISTING" -gt 0 ]; then
    echo "loader: ${SCHEMA}.${TABLE} ya tiene ${EXISTING} registros, se omite la carga."
    exit 0
fi

echo "loader: cargando ${GPKG} a tabla staging (reproyectando a EPSG:9377)..."
ogr2ogr \
    -f PostgreSQL \
    "PG:host=${POSTGRES_HOST} port=${POSTGRES_PORT} dbname=${POSTGRES_DB} user=${POSTGRES_USER} password=${POSTGRES_PASSWORD}" \
    "${GPKG}" "${LAYER}" \
    -t_srs EPSG:9377 \
    -nln "${SCHEMA}.clc_staging" \
    -lco GEOMETRY_NAME=geom \
    -lco SPATIAL_INDEX=NONE \
    -overwrite

echo "loader: normalizando (ST_MakeValid, ST_Multi) y volcando a ${SCHEMA}.${TABLE}..."
$PSQL -v schema="${SCHEMA}" -v table="${TABLE}" -f normalize.sql

COUNT=$($PSQL -tAc "SELECT count(*) FROM ${SCHEMA}.${TABLE};")
echo "loader: listo, ${COUNT} registros en ${SCHEMA}.${TABLE}."
