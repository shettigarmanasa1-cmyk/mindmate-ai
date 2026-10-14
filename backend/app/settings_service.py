from app.database import get_db

STYLES = ("friendly", "professional", "casual")
LENGTHS = ("short", "balanced", "detailed")

DEFAULTS = {
    "memory_enabled": "true",
    "response_style": "friendly",
    "answer_length": "balanced",
    "beginner_friendly": "false",
}


def get_settings() -> dict:
    with get_db() as conn:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
    merged = {**DEFAULTS, **{row["key"]: row["value"] for row in rows}}
    style = merged["response_style"]
    length = merged["answer_length"]
    return {
        "memory_enabled": merged["memory_enabled"] == "true",
        "response_style": style if style in STYLES else DEFAULTS["response_style"],
        "answer_length": length if length in LENGTHS else DEFAULTS["answer_length"],
        "beginner_friendly": merged["beginner_friendly"] == "true",
    }


def update_settings(changes: dict) -> dict:
    values = {}
    for key, value in changes.items():
        if key not in DEFAULTS or value is None:
            continue
        values[key] = ("true" if value else "false") if isinstance(value, bool) else str(value)
    if values:
        with get_db() as conn:
            for key, value in values.items():
                conn.execute(
                    "INSERT INTO settings (key, value) VALUES (?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    (key, value),
                )
    return get_settings()


def is_memory_enabled() -> bool:
    return get_settings()["memory_enabled"]