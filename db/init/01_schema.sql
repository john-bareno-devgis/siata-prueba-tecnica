-- Se ejecuta automáticamente en el primer arranque de PostGIS
-- (docker-entrypoint-initdb.d), solo si el volumen de datos está vacío.

CREATE SCHEMA IF NOT EXISTS coberturas;

-- EPSG:9377 (MAGNA-SIRGAS Origen Nacional) no viene precargado en el
-- spatial_ref_sys que trae esta imagen de PostGIS (es un código EPSG
-- reciente). Sin esta fila, GDAL/ogr2ogr no encuentra coincidencia exacta
-- y autogenera un SRID "privado" (900xxx) en vez de reusar 9377, lo que
-- choca con la columna tipada geometry(...,9377) de abajo. Definición
-- (srtext/proj4text) tomada de PROJ vía `gdalsrsinfo EPSG:9377`.
INSERT INTO spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text)
VALUES (
    9377,
    'EPSG',
    9377,
    'PROJCS["MAGNA-SIRGAS 2018 / Origen-Nacional",GEOGCS["MAGNA-SIRGAS 2018",DATUM["Marco_Geocentrico_Nacional_de_Referencia_2018",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","1329"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","20046"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",4],PARAMETER["central_meridian",-73],PARAMETER["scale_factor",0.9992],PARAMETER["false_easting",5000000],PARAMETER["false_northing",2000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Northing",NORTH],AXIS["Easting",EAST],AUTHORITY["EPSG","9377"]]',
    '+proj=tmerc +lat_0=4 +lon_0=-73 +k=0.9992 +x_0=5000000 +y_0=2000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
)
ON CONFLICT (srid) DO NOTHING;

-- nivel1 se deriva del primer dígito de "codigo" (nomenclatura CORINE Land
-- Cover: el primer dígito es el nivel 1 jerárquico, ej. 111 -> nivel1 '1'
-- "Territorios artificializados"). Se guarda ya calculado para no repetir
-- la extracción de substring en cada consulta del backend.
-- nivel3 viene tal cual del campo "nivel_3" del .gpkg fuente (nombre
-- oficial IDEAM del nivel 3, ej. codigo 3232 -> nivel3 "3.2.3. Vegetación
-- secundaria o en transición" -- mas general que "cobertura", que para
-- ese mismo codigo es "3.2.3.2. Vegetación secundaria baja", nivel 4).
CREATE TABLE IF NOT EXISTS coberturas.clc (
    id        SERIAL PRIMARY KEY,
    codigo    VARCHAR(10) NOT NULL,
    nivel1    VARCHAR(1)  NOT NULL,
    nivel3    TEXT        NOT NULL,
    cobertura TEXT        NOT NULL,
    geom      GEOMETRY(MultiPolygon, 9377) NOT NULL
);

CREATE INDEX IF NOT EXISTS clc_geom_gist ON coberturas.clc USING GIST (geom);
CREATE INDEX IF NOT EXISTS clc_codigo_idx ON coberturas.clc (codigo);
