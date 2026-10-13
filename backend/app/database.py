import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

from app.config import settings


def new_id() -> str:
    """A random, stable identifier for a row."""
    return str(uuid.uuid4())


def now() -> str:
    """Current time in UTC as text, e.g. 2026-10-13T10:30:00+00:00."""
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def get_db():
    """Open a connection, commit if all went well, roll back if not."""
    conn = sqlite3.connect(settings.database_path)
    conn.row_factory = sqlite3.Row          # lets us read columns by name
    conn.execute("PRAGMA foreign_keys = ON")  # SQLite needs this to enforce links
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL
        REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    keywords TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS proposed_memories (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    keywords TEXT NOT NULL DEFAULT '',
    replaces_memory_id TEXT REFERENCES memories(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    source_conversation_id TEXT
        REFERENCES conversations(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


def init_db() -> None:
    """Create the tables if they do not exist yet. Safe to run many times."""
    with get_db() as conn:
        conn.executescript(SCHEMA)