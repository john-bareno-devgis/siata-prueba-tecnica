# SIATA — Prueba técnica (Contrato 247/2026) · Coberturas CORINE Land Cover, Valle de Aburrá

Stack geoespacial completo: PostGIS + FastAPI + GeoServer + visor Leaflet, orquestado con
Docker Compose y desplegable en **un solo comando**.

## Estado del proyecto

- [x] Módulo 1 — Infraestructura base (`docker-compose.yml`, `.env.example`)
- [x] Módulo 2 — PostGIS + loader de datos
- [ ] Módulo 3 — Backend FastAPI
- [ ] Módulo 4 — GeoServer + init automático
- [ ] Módulo 5 — Visor web

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
└── web/                       # Nginx: visor Leaflet estático + reverse proxy
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
| Visor | Leaflet estático servido por Nginx | Nginx también hace reverse proxy de `/api` y `/geoserver` → mismo origen, sin problemas de CORS. |
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
- `geoserver` — volumen con nombre para el data dir, healthcheck a REST `about/version`.
- `geoserver-init` — tras `geoserver` healthy: crea workspace `siata`, datastore PostGIS, capa `clc`, estilo SLD; idempotente (verifica antes de crear).
- `web` — Nginx: `/` visor, `/api/` → `backend:8000`, `/geoserver/` → `geoserver:8080`. Único puerto publicado al host.
- Redes: `internal` (db, loader, backend, geoserver, geoserver-init) y `public` (web, backend, geoserver).
- Todo parametrizado en `.env` (plantilla `.env.example`); ninguna credencial en el código.

## Endpoints

_Se documentan con ejemplos `curl` al completar el módulo de backend._

## Declaración de uso de IA

_Se completa al cierre del proyecto, documentando en qué partes se usó asistencia de IA
y cómo se validó cada una._
