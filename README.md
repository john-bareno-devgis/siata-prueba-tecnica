# SIATA — Prueba técnica (Contrato 247/2026) · Coberturas CORINE Land Cover, Valle de Aburrá

Stack geoespacial completo: PostGIS + FastAPI + GeoServer + visor Leaflet, orquestado con
Docker Compose y desplegable en **un solo comando**.

## Estado del proyecto

- [x] Módulo 1 — Infraestructura base (`docker-compose.yml`, `.env.example`)
- [x] Módulo 2 — PostGIS + loader de datos
- [x] Módulo 3 — Backend FastAPI
- [x] Módulo 4 — GeoServer + init automático
- [x] Módulo 5 — Visor web

## Requisitos por sistema operativo

El stack corre igual en Linux, Windows y Mac (Intel o Apple Silicon) porque:
todos los servicios usan **volúmenes con nombre** (no bind mounts que dependan de permisos
del SO host), los scripts se invocan con `sh` (POSIX, sin bashismos) y el repo fija
`eol=lf` vía `.gitattributes` para que ningún script se rompa por finales de línea CRLF.

| SO | Requisitos | Notas |
|---|---|---|
| **Linux** | Docker Engine ≥ 24 + plugin `docker compose` | Ruta nativa, sin emulación. |
| **Windows** | Docker Desktop con backend **WSL2** habilitado | Clonar el repo **dentro del filesystem de WSL2** (ej. `\\wsl$\Ubuntu\home\...`), no en `C:\`, para evitar problemas de permisos/rendimiento en el volumen bind del código fuente. |
| **Mac (Intel)** | Docker Desktop | Ruta nativa. |
| **Mac (Apple Silicon / ARM)** | Docker Desktop con emulación x86_64 habilitada (activada por defecto) | Las imágenes `postgis/postgis:16-3.4` y `docker.osgeo.org/geoserver:2.25.2` **no publican build arm64** (verificado contra el manifest de cada registro); se fija `platform: linux/amd64` en esos servicios y Docker Desktop las ejecuta vía Rosetta/QEMU automáticamente. El resto de imágenes (`ghcr.io/osgeo/gdal`, `python`, `nginx`) sí son multi-arch nativas. |

El puerto publicado al host es configurable vía `WEB_PORT` en `.env` (por si `80` ya está
ocupado en la máquina del evaluador).

## Despliegue (un solo paso)

```bash
cp .env.example .env
docker compose up -d --build
```

Para reiniciar desde cero (borra el volumen de datos):

```bash
docker compose down -v
docker compose up -d --build
```

Visor: `http://localhost:${WEB_PORT}` (por defecto `http://localhost:80`).

## Estructura del repo

```
.
├── docker-compose.yml
├── .env.example
├── data/CLC_Medellin.gpkg     # dataset fuente (CORINE Land Cover, Valle de Aburrá)
├── db/init/                   # SQL de esquema, se ejecuta al primer arranque de PostGIS
├── loader/                    # contenedor GDAL: carga el .gpkg a la BD
├── backend/                   # FastAPI (app/{main,config,db,routers,schemas,services})
├── geoserver/init/            # contenedor que configura GeoServer vía REST API
├── geoserver/projections/     # EPSG:9377 para GeoTools (user_projections)
└── web/                       # Nginx: visor Leaflet estático + reverse proxy
    ├── nginx.conf
    └── site/                  # index.html, css/, js/, vendor/leaflet/ (vendorizado, sin CDN)
```

## Stack y decisiones técnicas

| Componente | Elección | Por qué |
|---|---|---|
| BD | PostGIS 16-3.4 (versión fija) | Estándar de facto para datos espaciales; funciones espaciales corren en el motor, no en la aplicación. |
| SRID de almacenamiento | **EPSG:9377** (MAGNA-SIRGAS Origen Nacional) | Proyectado en metros → áreas (ha) y buffers en metros exactos, sin distorsión. La API expone/recibe siempre en 4326 (estándar web/GeoJSON). |
| Índice espacial | GIST sobre `geom` | Acelera intersección/vecindad, las operaciones que hace el endpoint `/intersect`. |
| Carga de datos | Contenedor GDAL (`ogr2ogr`) → tabla staging → SQL normaliza (`ST_MakeValid`, `ST_Multi`) | Reproducible desde el `.gpkg` fuente; idempotente (no duplica si ya hay datos). |
| Backend | FastAPI + `psycopg 3` con pool, SQL espacial explícito (sin ORM) | Liviano, Swagger/OpenAPI automático; el cálculo geométrico pesado queda en PostGIS, no en Python. |
| Publicación OGC | GeoServer oficial (versión fija) + contenedor `geoserver-init` que llama la REST API con `curl` | Configuración 100% automática y auditable (queda en un script versionado, no en clicks manuales). |
| Estilo | SLD por código CLC nivel 1 | Leyenda temática legible en el visor. |
| Visor | Leaflet estático servido por Nginx, assets vendorizados (sin CDN) | Nginx también hace reverse proxy de `/api` y `/geoserver` → mismo origen, sin problemas de CORS; sin CDN, el visor no depende de que el navegador del evaluador tenga salida a internet más allá de las teselas OSM. |
| Imágenes multi-arch | `ghcr.io/osgeo/gdal` (loader), `python:3.12-slim` (backend), `nginx:1.27-alpine` (web) nativas; `postgis/postgis` y GeoServer forzadas a `linux/amd64` | Ver tabla de requisitos por SO arriba — decisión basada en qué publica cada registro, no supuesta. |

## Modelo de datos

Esquema `coberturas`, tabla `clc`:

| Columna | Tipo | Origen |
|---|---|---|
| `id` | serial PK | generado |
| `codigo` | varchar | campo `codigo` del `.gpkg` |
| `nivel1` | varchar | derivado: primer dígito de `codigo` (validado contra el campo `nivel_1` del `.gpkg`) |
| `cobertura` | text | campo `leyenda` del `.gpkg` |
| `geom` | `geometry(MultiPolygon, 9377)` NOT NULL | reproyectado desde 4686 (SRID original), `ST_MakeValid` + `ST_Multi` |

Índice `GIST` sobre `geom`. Script en [`db/init/`](db/init/).

**Carga de datos** ([`loader/`](loader/)): `ogr2ogr` importa el `.gpkg` (SRID 4686) a una
tabla staging reproyectando a 9377 en el mismo paso; luego [`normalize.sql`](loader/normalize.sql)
aplica `ST_MakeValid` + `ST_Multi` y vuelca a `coberturas.clc`. Idempotente: si la tabla
final ya tiene filas, [`load.sh`](loader/load.sh) no repite la carga (importante porque el
contenedor `loader` corre en cada `docker compose up`, no solo la primera vez).

**GeoServer** ([`geoserver/init/`](geoserver/init/)): el contenedor `geoserver-init` configura todo
vía REST API tras el healthcheck de `geoserver` (`curl` autenticado, idempotente — cada
paso hace `GET` antes de `POST`): workspace `siata` → datastore PostGIS (`coberturas.clc`)
→ capa `clc` → estilo [`style_nivel1.sld`](geoserver/init/style_nivel1.sld) (5 colores por
código CLC nivel 1) como estilo por defecto de la capa.

**Tercer y cuarto caso del mismo problema de EPSG:9377**: GeoTools (motor de CRS de GeoServer)
tampoco trae ese código precargado — es una base EPSG distinta a la de PostGIS/PROJ. La solución
oficial de GeoServer es un archivo `user_projections/epsg.properties` en el data dir; como
ese data dir vive en un volumen con nombre, el servicio `geoserver-projections` lo escribe
ahí **antes** de que arranque `geoserver` (mismo WKT ya usado para PostGIS).

Al probar el visor por primera vez, la capa WMS cargaba pero no dibujaba nada. La causa:
la definición oficial de EPSG:9377 declara eje 1 = **Northing**, eje 2 = **Easting**
(verificado con `projinfo EPSG:9377`). GeoTools respeta ese orden al pie de la letra al
reproyectar; PostGIS/GDAL, en cambio, siempre leen/escriben coordenadas como
(X=easting, Y=northing), sin importar esa metadata — por eso nunca fue un problema para
`ogr2ogr` ni para el backend. Con el orden "oficial" en el WKT, GeoServer interpretaba las
coordenadas de PostGIS invertidas y calculaba un `latLonBoundingBox` en otro continente
(~lat 25, cerca de México) en vez del Valle de Aburrá. Se declara el WKT en orden
(Easting, Northing) en [`epsg.properties`](geoserver/projections/epsg.properties) —no el
oficial, sino el que coincide con cómo el resto del stack realmente sirve los datos.

**Dos detalles no obvios, resueltos y documentados en el código:**
1. La imagen `postgis/postgis` trae su propio script de init (`10_postgis.sh`, crea la
   extensión PostGIS) dentro de `/docker-entrypoint-initdb.d/`. Un bind-mount de directorio
   ahí lo **reemplaza y lo borra** (`type "geometry" does not exist`). Por eso `db/` tiene
   su propio [`Dockerfile`](db/Dockerfile) que agrega nuestro SQL con `COPY` (no lo pisa) y
   lo nombra `20_schema.sql` para que corra después del script de la extensión.
2. **EPSG:9377 no viene precargado** en `spatial_ref_sys` de esta imagen de PostGIS (es un
   código EPSG relativamente nuevo). Sin esa fila, `ogr2ogr` no encuentra coincidencia
   exacta y autogenera un SRID "privado" (rango 900000+), que choca con la columna tipada
   `geometry(...,9377)`. [`01_schema.sql`](db/init/01_schema.sql) inserta la definición
   oficial (WKT/proj4 desde PROJ) antes de crear la tabla.

## Servicios (`docker compose`)

- `db` — PostGIS, volumen con nombre `pgdata`, healthcheck `pg_isready`, **sin puertos al host**.
- `loader` — GDAL, corre una vez tras `db` healthy; no recarga si ya hay datos (idempotente).
- `backend` — FastAPI (uvicorn), healthcheck a `/api/health`, depende de que `loader` termine con éxito.
- `geoserver-projections` — escribe `user_projections/epsg.properties` en el volumen antes de que arranque `geoserver`.
- `geoserver` — volumen con nombre para el data dir, healthcheck a REST `about/version`.
- `geoserver-init` — tras `geoserver` healthy: crea workspace `siata`, datastore PostGIS, capa `clc`, estilo SLD; idempotente (verifica antes de crear).
- `web` — Nginx: `/` visor, `/api/` → `backend:8000`, `/geoserver/` → `geoserver:8080`. Único puerto publicado al host.
- Redes: `internal` (db, loader, backend, geoserver, geoserver-init, geoserver-projections) y `public` (web, backend, geoserver).
- Todo parametrizado en `.env` (plantilla `.env.example`); ninguna credencial en el código.

## Endpoints

Prefijo `/api` (vía Nginx: `http://localhost:${WEB_PORT}/api/...`). Documentación interactiva
(Swagger) en `/api/docs`.

### `GET /api/health`

Estado del backend + conexión a PostGIS. `200` si la BD responde, `503` si no.

```bash
curl http://localhost/api/health
# {"status":"ok","postgis_version":"3.4 USE_GEOS=1 USE_PROJ=1 USE_STATS=1"}
```

### `POST /api/intersect`

Body: **una** de dos opciones (rechaza `422` si envías ambas, ninguna, o `point` sin `radius_m`).

**Opción A — polígono (GeoJSON, EPSG:4326):**
```bash
curl -X POST http://localhost/api/intersect \
  -H "Content-Type: application/json" \
  -d '{
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[-75.60,6.24],[-75.58,6.24],[-75.58,6.26],[-75.60,6.26],[-75.60,6.24]]]
    }
  }'
```

**Opción B — punto + radio en metros:**
```bash
curl -X POST http://localhost/api/intersect \
  -H "Content-Type: application/json" \
  -d '{"point": {"lon": -75.59, "lat": 6.25}, "radius_m": 800}'
```

Respuesta (`FeatureCollection` en 4326):
```json
{
  "type": "FeatureCollection",
  "features": [
    {"type": "Feature", "geometry": {"...": "..."},
     "properties": {"codigo": "231", "cobertura": "2.3.1. Pastos limpios", "area_ha": 45.12, "pct": 22.59}}
  ],
  "query_geometry": {"type": "Polygon", "coordinates": [["..."]]},
  "summary": {"total_ha": 199.77, "n_coberturas": 4}
}
```

Errores: `422` si el body no cumple el esquema (Pydantic) o `radius_m` está fuera de rango
(`0 < radius_m ≤ 50000`); `400` si la geometría no se puede interpretar (GeoJSON mal formado,
coordenadas fuera de rango); `200` con `features: []` si no hay intersección (no es error).

### `GET /api/stats`

Área por cobertura sobre toda el área de estudio, calculada en PostGIS con `SUM() OVER()`.

```bash
curl http://localhost/api/stats
```
```json
{
  "coberturas": [
    {"codigo": "111", "cobertura": "1.1.1. Tejido urbano continuo", "area_ha": 9379.3186, "pct": 25.12}
  ],
  "total_ha": 37344.0416
}
```

## Visor

`http://localhost:${WEB_PORT}` — mapa Leaflet con base OSM + capa WMS `siata:clc`
(estilo por código CLC nivel 1). Clic en el mapa + radio (m) en el panel → `POST /api/intersect`
→ dibuja el círculo de consulta y las coberturas resultantes, con tabla (código, cobertura,
ha, %). Botón "Ver estadísticas del área de estudio" → `GET /api/stats`. Indicador de estado
de `/api/health` en el encabezado (punto verde/rojo).

## Declaración de uso de IA

_Se completa al cierre del proyecto, documentando en qué partes se usó asistencia de IA
y cómo se validó cada una._
