from psycopg_pool import ConnectionPool

from .config import settings

# open=False: el pool no conecta en el import (que ocurre al cargar el
# módulo), sino en el lifespan de FastAPI -> evita que un import falle
# si la BD todavía no está lista.
pool = ConnectionPool(conninfo=settings.dsn, min_size=1, max_size=10, open=False)


def open_pool() -> None:
    pool.open(wait=True, timeout=30)


def close_pool() -> None:
    pool.close()
