import os
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from .services.import_identity import build_transaction_fingerprint

DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "smartspend.db"
DEFAULT_DATABASE_URL = f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL).strip() or DEFAULT_DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def ensure_sqlite_transaction_columns():
    if not DATABASE_URL.startswith("sqlite"):
        return

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    if "transactions" in table_names:
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

        if "source_fingerprint" not in existing_columns:
            statements.append(
                "ALTER TABLE transactions ADD COLUMN source_fingerprint STRING NOT NULL DEFAULT ''"
            )

        if "import_id" not in existing_columns:
            statements.append(
                "ALTER TABLE transactions ADD COLUMN import_id INTEGER"
            )

        if "category_source" not in existing_columns:
            statements.append(
                "ALTER TABLE transactions ADD COLUMN category_source STRING NOT NULL DEFAULT 'system'"
            )

        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))

        transaction_sql = _get_create_table_sql("transactions")
        if transaction_sql and (
            "uq_tx_dedupe" in transaction_sql
            or "UNIQUE (ACCOUNT_ID, DATE, DESCRIPTION, AMOUNT)" in transaction_sql.upper()
        ):
            _rebuild_transactions_table_without_raw_unique_constraint()

        with engine.begin() as connection:
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_transactions_source_fingerprint "
                    "ON transactions (source_fingerprint)"
                )
            )
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_transactions_import_id "
                    "ON transactions (import_id)"
                )
            )
        _backfill_transaction_fingerprints()

    if "transaction_imports" in table_names:
        import_columns = {column["name"] for column in inspector.get_columns("transaction_imports")}
        import_statements: list[str] = []

        if "date_from" not in import_columns:
            import_statements.append(
                "ALTER TABLE transaction_imports ADD COLUMN date_from DATE"
            )

        if "date_to" not in import_columns:
            import_statements.append(
                "ALTER TABLE transaction_imports ADD COLUMN date_to DATE"
            )

        if "error_message" not in import_columns:
            import_statements.append(
                "ALTER TABLE transaction_imports ADD COLUMN error_message STRING"
            )

        if import_statements:
            with engine.begin() as connection:
                for statement in import_statements:
                    connection.execute(text(statement))


def _get_create_table_sql(table_name: str) -> str | None:
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT sql FROM sqlite_master WHERE type='table' AND name = :name"),
            {"name": table_name},
        ).scalar()
    return str(result) if result else None


def _rebuild_transactions_table_without_raw_unique_constraint():
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE transactions RENAME TO transactions_legacy"))
        connection.execute(
            text(
                """
                CREATE TABLE transactions (
                    id INTEGER NOT NULL PRIMARY KEY,
                    account_id INTEGER NOT NULL,
                    date DATE NOT NULL,
                    description STRING NOT NULL,
                    amount FLOAT NOT NULL,
                    transaction_type STRING NOT NULL,
                    category STRING,
                    category_source STRING NOT NULL DEFAULT 'system',
                    balance_after FLOAT NOT NULL,
                    source_fingerprint STRING NOT NULL DEFAULT '',
                    import_id INTEGER,
                    is_anomaly BOOLEAN NOT NULL DEFAULT 0,
                    anomaly_score FLOAT,
                    created_at DATETIME
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO transactions (
                    id,
                    account_id,
                    date,
                    description,
                    amount,
                    transaction_type,
                    category,
                    category_source,
                    balance_after,
                    source_fingerprint,
                    import_id,
                    is_anomaly,
                    anomaly_score,
                    created_at
                )
                SELECT
                    id,
                    account_id,
                    date,
                    description,
                    amount,
                    transaction_type,
                    category,
                    COALESCE(category_source, 'system'),
                    balance_after,
                    COALESCE(source_fingerprint, ''),
                    import_id,
                    COALESCE(is_anomaly, 0),
                    anomaly_score,
                    created_at
                FROM transactions_legacy
                """
            )
        )
        connection.execute(text("DROP TABLE transactions_legacy"))


def _backfill_transaction_fingerprints():
    with engine.begin() as connection:
        rows = connection.execute(
            text(
                "SELECT id, account_id, date, amount, description "
                "FROM transactions "
                "WHERE source_fingerprint IS NULL OR source_fingerprint = ''"
            )
        ).mappings().all()

        for row in rows:
            fingerprint = build_transaction_fingerprint(
                int(row["account_id"]),
                row["date"],
                float(row["amount"]),
                str(row["description"]),
            )
            connection.execute(
                text(
                    "UPDATE transactions SET source_fingerprint = :source_fingerprint "
                    "WHERE id = :transaction_id"
                ),
                {
                    "source_fingerprint": fingerprint,
                    "transaction_id": int(row["id"]),
                },
            )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
