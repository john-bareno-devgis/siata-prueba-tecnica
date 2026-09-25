# SIATA — Prueba técnica (Contrato 247/2026) · Coberturas CORINE Land Cover, Medellín

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

## Modo desarrollo

[`docker-compose.dev.yml`](docker-compose.dev.yml) monta `backend/app` y `web/site` como bind
mount sobre las imágenes ya construidas, y corre `uvicorn --reload`. Así los cambios en
Python/HTML/CSS/JS se ven sin `docker compose build`. **No se carga automático** (a propósito:
`docker compose` solo auto-carga un archivo llamado `docker-compose.override.yml`; este tiene
otro nombre para no arriesgar que alguien lo levante sin darse cuenta en un despliegue real) —
hay que pasarlo explícito con `-f`:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Editar un archivo en `backend/app/` o `web/site/` y ver el cambio reflejado (backend: recarga
automática de uvicorn; web: recarga la página, Nginx sirve el archivo del bind mount directo).
Para volver al modo normal, `docker compose down` y levantar de nuevo sin `-f docker-compose.dev.yml`.

## Estructura del repo

```
.
├── docker-compose.yml
├── .env.example
├── data/CLC_Medellin.gpkg     # dataset fuente (CORINE Land Cover, Medellín)
├── db/init/                   # SQL de esquema, se ejecuta al primer arranque de PostGIS
├── loader/                    # contenedor GDAL: carga el .gpkg a la BD
├── backend/                   # FastAPI (app/{main,config,db,routers,schemas,services})
├── geoserver/init/            # contenedor que configura GeoServer vía REST API (workspace, datastore, capa, 2 estilos SLD)
├── geoserver/projections/     # EPSG:9377 para GeoTools (user_projections)
└── web/                       # Nginx: visor Leaflet estático + reverse proxy
    ├── nginx.conf
    └── site/                  # index.html, css/, js/, assets/logos/, vendor/{leaflet,d3}/ (vendorizados, sin CDN)
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
| Estilo | SLD por código CLC nivel 3 (21 categorías, por defecto), nivel 1 también disponible | Nivel 3 es la clasificación operativa real (nivel 1 son solo 5 macro-categorías); colores por familia de tono según nivel1, igual que el estándar CORINE. |
| Visor | Leaflet estático servido por Nginx, assets vendorizados (sin CDN) | Nginx también hace reverse proxy de `/api` y `/geoserver` → mismo origen, sin problemas de CORS; sin CDN, el visor no depende de que el navegador del evaluador tenga salida a internet más allá de las teselas OSM. |
| Gráficas | D3 v7 (vendorizado) sobre SVG propio, sin librería de charts de alto nivel | El anillo del mapa necesita control fino de geometría/sincronía con Leaflet (pan/zoom), que una librería de charts cerrada no ofrece; se reutiliza para las barras del dashboard (una sola dependencia). |
| Imágenes multi-arch | `ghcr.io/osgeo/gdal` (loader), `python:3.12-slim` (backend), `nginx:1.27-alpine` (web) nativas; `postgis/postgis` y GeoServer forzadas a `linux/amd64` | Ver tabla de requisitos por SO arriba — decisión basada en qué publica cada registro, no supuesta. |

## Modelo de datos

Esquema `coberturas`, tabla `clc`:

| Columna | Tipo | Origen |
|---|---|---|
| `id` | serial PK | generado |
| `codigo` | varchar | campo `codigo` del `.gpkg` |
| `nivel1` | varchar | derivado: primer dígito de `codigo` (validado contra el campo `nivel_1` del `.gpkg`) |
| `nivel3` | text | campo `nivel_3` del `.gpkg` (nombre oficial IDEAM del nivel 3 — no se deriva de `codigo`, ver abajo) |
| `cobertura` | text | campo `leyenda` del `.gpkg` |
| `geom` | `geometry(MultiPolygon, 9377)` NOT NULL | reproyectado desde 4686 (SRID original), `ST_MakeValid` + `ST_Multi` |

Índice `GIST` sobre `geom`. Script en [`db/init/`](db/init/).

**Carga de datos** ([`loader/`](loader/)): `ogr2ogr` importa el `.gpkg` (SRID 4686) a una
tabla staging reproyectando a 9377 en el mismo paso; luego [`normalize.sql`](loader/normalize.sql)
aplica `ST_MakeValid` + `ST_Multi` y vuelca a `coberturas.clc`. Idempotente: si la tabla
final ya tiene filas, [`load.sh`](loader/load.sh) no repite la carga (importante porque el
contenedor `loader` corre en cada `docker compose up`, no solo la primera vez).

**Por qué `nivel3` viene del `.gpkg` y no se deriva por substring de `codigo`**: a diferencia
de `nivel1` (siempre el primer dígito, sin ambigüedad), el nivel 3 IDEAM no es simplemente
"los primeros 3 dígitos de `codigo`" con un nombre fijo — el dataset trae códigos de 4 y 5
dígitos (ej. `31111`, `31121`, subcategorías de "Bosque denso") que agrupan bajo el mismo
nivel 3 pero con nombres más específicos (`leyenda`) distintos entre sí. El `.gpkg` ya trae
un campo `nivel_3` con el nombre oficial correcto para cada fila (verificado con `ogrinfo`:
`codigo=3232` → `nivel_3="3.2.3. Vegetación secundaria o en transición"`, distinto de
`leyenda="3.2.3.2. Vegetación secundaria baja"`), así que se usa tal cual en vez de adivinar
nombres.

**GeoServer** ([`geoserver/init/`](geoserver/init/)): el contenedor `geoserver-init` configura todo
vía REST API tras el healthcheck de `geoserver` (`curl` autenticado, idempotente — cada
paso hace `GET` antes de `POST`): workspace `siata` → datastore PostGIS (`coberturas.clc`)
→ capa `clc` → dos estilos SLD, [`clc_nivel1.sld`](geoserver/init/clc_nivel1.sld) (5 colores,
nivel 1) y [`clc_nivel3.sld`](geoserver/init/clc_nivel3.sld) (21 colores, nivel 3 — estilo por
defecto de la capa). Los colores de `clc_nivel3.sld` no se inventaron a mano: se generaron
con un script Python (HSL) que fija un tono (hue) por nivel1 y varía la luminosidad según la
posición del código dentro de su grupo — mismo criterio que usa CORINE Land Cover
oficialmente (subcategorías de una misma familia comparten matiz). El frontend
([`app.js`](web/site/js/app.js)) recalcula esos mismos colores con la misma fórmula en vez
de mantener una lista de 21 colores duplicada a mano: así el mapa (SLD), la leyenda y las
gráficas del dashboard siempre quedan sincronizados entre sí y con lo que de verdad
devuelve `/api/stats`, sin poder desincronizarse por un edit en un solo lugar.

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
(~lat 25, cerca de México) en vez de Medellín. Se declara el WKT en orden
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
- `geoserver-init` — tras `geoserver` healthy: crea workspace `siata`, datastore PostGIS, capa `clc`, estilos `clc_nivel1`/`clc_nivel3` (nivel3 por defecto); idempotente (verifica antes de crear).
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

Área por cobertura (una fila por `codigo`) sobre toda el área de estudio, calculada en
PostGIS con `SUM() OVER()`. Incluye `nivel1` y `nivel3` en cada fila para que el frontend
pueda agrupar/graficar sin pedir nada extra (varios `codigo` pueden compartir `nivel3`, ver
nota arriba — el dashboard los agrupa en el cliente).

```bash
curl http://localhost/api/stats
```
```json
{
  "coberturas": [
    {
      "codigo": "111", "nivel1": "1", "nivel3": "1.1.1. Tejido urbano continuo",
      "cobertura": "1.1.1. Tejido urbano continuo", "area_ha": 9379.3186, "pct": 25.12
    }
  ],
  "total_ha": 37344.0416
}
```

## Visor

`http://localhost:${WEB_PORT}` — encabezado con el logo institucional de SIATA
([`assets/logos/logo-siata.svg`](web/site/assets/logos/logo-siata.svg), oficial, tomado de
siata.gov.co) y dos pestañas:

- **Mapa**: Leaflet con base OSM + capa WMS `siata:clc` (estilo nivel 3). Clic en el mapa +
  radio (m) en el panel → `POST /api/intersect` → dibuja el círculo de consulta, las
  coberturas resultantes, tabla (código, cobertura, ha, %) **y un anillo estadístico
  animado en D3** alrededor del círculo (arcos proporcionales al % de cada cobertura,
  mismos colores que la leyenda; ver detalle técnico abajo).
- **Dashboard**: tarjetas KPI (área total, n.º de coberturas nivel 3, cobertura dominante,
  % de área natural) + **gráficas de barras en D3, interactivas** (área por nivel 1, todas
  las coberturas nivel 3 ordenadas por área — animación de entrada, resaltado y tooltip con
  valor exacto al pasar el mouse) — todo calculado en el cliente a partir de una sola
  llamada a `GET /api/stats` (cacheada, no se repite la petición al cambiar de pestaña).

**D3 + Leaflet** ([`app.js`](web/site/js/app.js)): el anillo del mapa usa el patrón estándar
"capa D3 sobre Leaflet" — un `<svg>` propio en el `overlayPane` que se reposiciona en cada
pan (clase `D3RingLayer`), y se **redibuja** (no solo reposiciona) en cada zoom, porque su
geometría (radios en píxeles) se calculó para un nivel de zoom que ya no aplica; el círculo
nativo de Leaflet no tiene este problema porque Leaflet lo recalcula solo. El color de cada
arco/barra sale de `colorPorCodigo`, un mapa global `codigo → color` armado una sola vez al
cargar `/api/stats` — reutiliza la misma fórmula HSL que usa `clc_nivel3.sld` (ver arriba),
así el anillo, la leyenda, el dashboard y el mapa WMS nunca muestran colores distintos para
la misma cobertura. D3 está vendorizado ([`vendor/d3/`](web/site/vendor/d3/), sin CDN, mismo
criterio que Leaflet).

La leyenda (nivel 3, 21 categorías agrupadas por nivel 1, colapsables) y el indicador de
estado de `/api/health` (punto verde/rojo) son visibles en ambas pestañas. Al final de la
barra lateral, crédito de autoría con link al portafolio.

## Declaración de uso de IA

Este proyecto se construyó con asistencia de un modelo de lenguaje (asistente de código en
terminal), módulo por módulo, con commit al cierre de cada uno. El flujo de trabajo fue:
yo defino requisitos y decisiones de arquitectura (ver tabla de decisiones técnicas arriba),
la IA genera una primera versión del código/configuración, y cada módulo se valida
levantando el stack completo desde cero (`docker compose down -v && up -d --build`) antes
de pasar al siguiente — nada se dio por bueno solo porque "se veía razonable".

Ejemplos concretos de errores reales que la validación en vivo encontró y que tuvieron que
corregirse (no hipotéticos, quedan documentados en el código y en los mensajes de commit):

- Un bind-mount que borraba el script de inicialización propio de la imagen de PostGIS
  (`db/Dockerfile`).
- EPSG:9377 no viene precargado ni en PostGIS ni en GeoTools (motor de CRS de GeoServer);
  hubo que registrar la definición manualmente en ambos, cada uno con su propio mecanismo
  (`db/init/01_schema.sql`, `geoserver/projections/epsg.properties`).
- Un error de orden de ejes (Northing/Easting) en esa misma definición para GeoTools que
  hacía que el mapa se desplazara a otro continente — solo visible probando el visor en un
  navegador real, no con `curl`.

Todo el SQL espacial, los endpoints y sus reglas de validación, y las decisiones de
arquitectura (SRID de almacenamiento, separación staging/normalización, manejo de errores
por capas) fueron revisados y entendidos línea por línea, no solo copiados — es el criterio
que debo poder sustentar en la entrevista técnica.
