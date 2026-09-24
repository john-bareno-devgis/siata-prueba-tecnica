# curlimages/curl es multi-arch (amd64+arm64) y minimo: todo lo que este
# contenedor necesita es curl + un shell POSIX (busybox sh, ya incluido).
FROM curlimages/curl:8.11.1

WORKDIR /app
COPY init.sh style_nivel1.sld ./

USER root
RUN chmod +x init.sh
USER curl_user

ENTRYPOINT ["sh", "init.sh"]
