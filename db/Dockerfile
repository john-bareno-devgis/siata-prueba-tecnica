# Se usa un Dockerfile (en vez de bind-mount directo a /docker-entrypoint-initdb.d)
# porque esa carpeta ya trae el script propio de la imagen (10_postgis.sh, crea
# la extensión PostGIS). Un bind-mount de directorio REEMPLAZA esa carpeta
# completa y borra ese script -> "type geometry does not exist". Con COPY se
# agrega el archivo sin tocar el resto; se nombra 20_ para que corra después.
FROM postgis/postgis:16-3.4
COPY init/01_schema.sql /docker-entrypoint-initdb.d/20_schema.sql
