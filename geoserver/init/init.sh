#!/bin/sh
# Configura GeoServer vía REST API: workspace, datastore PostGIS, capa y
# estilo SLD. Idempotente: cada paso primero consulta (GET) si el recurso
# ya existe antes de crearlo (POST), para poder correr en cada
# `docker compose up` sin duplicar ni fallar la segunda vez.
set -eu

GS_URL="http://geoserver:8080/geoserver/rest"
AUTH="${GEOSERVER_ADMIN_USER}:${GEOSERVER_ADMIN_PASSWORD}"
WS="${GEOSERVER_WORKSPACE}"
DS="${GEOSERVER_DATASTORE}"
LAYER="${GEOSERVER_LAYER}"
# Estilo por defecto de la capa: nivel 3 (mas especifico). nivel1 se deja
# creado tambien, por si se quiere usar como estilo alterno.
STYLE_DEFAULT="clc_nivel3"

curl_json() {
    curl -sS -f -u "$AUTH" -H "Content-Type: application/json" "$@"
}

status_code() {
    curl -s -o /dev/null -w "%{http_code}" -u "$AUTH" "$1"
}

echo "geoserver-init: esperando a que GeoServer responda..."
until [ "$(status_code "$GS_URL/about/version.json")" = "200" ]; do
    sleep 3
done

# 1. Workspace
if [ "$(status_code "$GS_URL/workspaces/$WS.json")" != "200" ]; then
    echo "geoserver-init: creando workspace $WS..."
    curl_json -X POST -d "{\"workspace\":{\"name\":\"$WS\"}}" "$GS_URL/workspaces"
else
    echo "geoserver-init: workspace $WS ya existe, se omite."
fi

# 2. Datastore PostGIS
if [ "$(status_code "$GS_URL/workspaces/$WS/datastores/$DS.json")" != "200" ]; then
    echo "geoserver-init: creando datastore $DS..."
    curl_json -X POST -d "{
      \"dataStore\": {
        \"name\": \"$DS\",
        \"connectionParameters\": {
          \"entry\": [
            {\"@key\": \"host\", \"\$\": \"$POSTGRES_HOST\"},
            {\"@key\": \"port\", \"\$\": \"$POSTGRES_PORT\"},
            {\"@key\": \"database\", \"\$\": \"$POSTGRES_DB\"},
            {\"@key\": \"user\", \"\$\": \"$POSTGRES_USER\"},
            {\"@key\": \"passwd\", \"\$\": \"$POSTGRES_PASSWORD\"},
            {\"@key\": \"dbtype\", \"\$\": \"postgis\"},
            {\"@key\": \"schema\", \"\$\": \"$DB_SCHEMA\"}
          ]
        }
      }
    }" "$GS_URL/workspaces/$WS/datastores"
else
    echo "geoserver-init: datastore $DS ya existe, se omite."
fi

# 3. Capa (featuretype) sobre coberturas.clc
if [ "$(status_code "$GS_URL/workspaces/$WS/datastores/$DS/featuretypes/$LAYER.json")" != "200" ]; then
    echo "geoserver-init: publicando capa $LAYER..."
    curl_json -X POST \
        -d "{\"featureType\":{\"name\":\"$LAYER\",\"nativeName\":\"$DB_TABLE\",\"srs\":\"EPSG:9377\"}}" \
        "$GS_URL/workspaces/$WS/datastores/$DS/featuretypes"
else
    echo "geoserver-init: capa $LAYER ya existe, se omite."
fi

# 4. Estilos SLD (nivel 1 y nivel 3 CLC)
for STYLE in clc_nivel1 clc_nivel3; do
    if [ "$(status_code "$GS_URL/styles/$STYLE.json")" != "200" ]; then
        echo "geoserver-init: creando estilo $STYLE..."
        curl_json -X POST -d "{\"style\":{\"name\":\"$STYLE\",\"filename\":\"$STYLE.sld\"}}" "$GS_URL/styles"
        curl -sS -f -u "$AUTH" -X PUT \
            -H "Content-Type: application/vnd.ogc.sld+xml" \
            --data-binary "@${STYLE}.sld" \
            "$GS_URL/styles/$STYLE"
    else
        echo "geoserver-init: estilo $STYLE ya existe, se omite."
    fi
done

# 5. Estilo por defecto de la capa (se reafirma en cada corrida, es barato
# e idempotente por naturaleza: PUT del mismo valor no tiene efecto extra).
echo "geoserver-init: asignando estilo por defecto a la capa ($STYLE_DEFAULT)..."
curl_json -X PUT -d "{\"layer\":{\"defaultStyle\":{\"name\":\"$STYLE_DEFAULT\"}}}" "$GS_URL/layers/$WS:$LAYER"

echo "geoserver-init: listo."
