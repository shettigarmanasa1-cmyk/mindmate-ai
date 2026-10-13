from app.database import get_db

DEFAULTS = {"memory_enabled": "true"}


def get_settings() -> dict:
    with get_db() as conn:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
    stored = {row["key"]: row["value"] for row in rows}
    merged = {**DEFAULTS, **stored}
    return {"memory_enabled": merged["memory_enabled"] == "true"}


def update_settings(memory_enabled: bool | None = None) -> dict:
    if memory_enabled is not None:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO settings (key, value) VALUES ('memory_enabled', ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                ("true" if memory_enabled else "false",),
            )
    return get_settings()


def is_memory_enabled() -> bool:
    return get_settings()["memory_enabled"]