from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Config leída de variables de entorno (inyectadas por docker-compose
    desde .env). case_sensitive=False (default) para que POSTGRES_HOST
    mapee a postgres_host sin duplicar nombres."""

    postgres_host: str = "db"
    postgres_port: int = 5432
    postgres_db: str
    postgres_user: str
    postgres_password: str
    db_schema: str = "coberturas"
    db_table: str = "clc"

    @property
    def dsn(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
