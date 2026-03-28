from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "sqlite:///./smartspend.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def ensure_sqlite_transaction_columns():
    inspector = inspect(engine)
    if "transactions" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("transactions")}
    statements: list[str] = []

    if "is_anomaly" not in existing_columns:
        statements.append(
            "ALTER TABLE transactions ADD COLUMN is_anomaly BOOLEAN NOT NULL DEFAULT 0"
        )

    if "anomaly_score" not in existing_columns:
        statements.append(
            "ALTER TABLE transactions ADD COLUMN anomaly_score FLOAT"
        )

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
