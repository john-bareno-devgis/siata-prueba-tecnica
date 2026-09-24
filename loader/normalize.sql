-- Normaliza la tabla staging (cruda, tal como la deja ogr2ogr) hacia la
-- tabla final. ST_MakeValid corrige geometrías inválidas (auto-intersecciones
-- típicas de digitalización manual); ST_Multi asegura tipo MultiPolygon
-- uniforme aunque algún polígono haya entrado como Polygon simple.
INSERT INTO :"schema".:"table" (codigo, nivel1, nivel3, cobertura, geom)
SELECT
    codigo::varchar               AS codigo,
    substr(codigo::varchar, 1, 1) AS nivel1,
    nivel_3                       AS nivel3,
    leyenda                       AS cobertura,
    ST_Multi(ST_MakeValid(geom))  AS geom
FROM :"schema".clc_staging;

DROP TABLE :"schema".clc_staging;
