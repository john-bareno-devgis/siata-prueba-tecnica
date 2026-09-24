# ubuntu-small-3.8.4 es multi-arch (amd64+arm64) y coincide con la versión
# de GDAL instalada en el equipo de desarrollo (verificado con ogrinfo).
FROM ghcr.io/osgeo/gdal:ubuntu-small-3.8.4

RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY load.sh normalize.sql ./
RUN chmod +x load.sh

ENTRYPOINT ["sh", "load.sh"]
