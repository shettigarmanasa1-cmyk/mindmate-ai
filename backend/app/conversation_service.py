from app.database import get_db, new_id, now


def create_conversation(title: str = "New conversation") -> dict:
    conv_id = new_id()
    timestamp = now()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO conversations (id, title, created_at, updated_at) "
            "VALUES (?, ?, ?, ?)",
            (conv_id, title, timestamp, timestamp),
        )
    return {
        "id": conv_id,
        "title": title,
        "created_at": timestamp,
        "updated_at": timestamp,
    }


def list_conversations() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, title, created_at, updated_at FROM conversations "
            "ORDER BY updated_at DESC"
        ).fetchall()
    return [dict(row) for row in rows]


def get_conversation(conv_id: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?",
            (conv_id,),
        ).fetchone()
        if row is None:
            return None
        messages = conn.execute(
            "SELECT id, role, content, created_at FROM messages "
            "WHERE conversation_id = ? ORDER BY created_at, rowid",
            (conv_id,),
        ).fetchall()
    conversation = dict(row)
    conversation["messages"] = [dict(m) for m in messages]
    return conversation


def rename_conversation(conv_id: str, title: str) -> dict | None:
    with get_db() as conn:
        cursor = conn.execute(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
            (title, now(), conv_id),
        )
        if cursor.rowcount == 0:
            return None
    return get_conversation(conv_id)


def delete_conversation(conv_id: str) -> bool:
    # The messages are deleted automatically (ON DELETE CASCADE).
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
        return cursor.rowcount > 0


def add_message(conv_id: str, role: str, content: str) -> dict | None:
    """Save one message. Returns None if the conversation does not exist."""
    message_id = new_id()
    timestamp = now()
    with get_db() as conn:
        exists = conn.execute(
            "SELECT 1 FROM conversations WHERE id = ?", (conv_id,)
        ).fetchone()
        if exists is None:
            return None
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (message_id, conv_id, role, content, timestamp),
        )
        conn.execute(
            "UPDATE conversations SET updated_at = ? WHERE id = ?",
            (timestamp, conv_id),
        )
    return {
        "id": message_id,
        "role": role,
        "content": content,
        "created_at": timestamp,
    }


def search_conversations(query: str) -> list[dict]:
    """Find conversations whose title or any message contains the text."""
    # Make %, _ and \ in the user's text count as ordinary characters.
    escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"
    with get_db() as conn:
        rows = conn.execute(
            "SELECT DISTINCT c.id, c.title, c.created_at, c.updated_at "
            "FROM conversations c "
            "LEFT JOIN messages m ON m.conversation_id = c.id "
            "WHERE c.title LIKE ? ESCAPE '\\' OR m.content LIKE ? ESCAPE '\\' "
            "ORDER BY c.updated_at DESC",
            (pattern, pattern),
        ).fetchall()
    return [dict(row) for row in rows]
def delete_all_conversations() -> int:
    """Delete every conversation (messages go with them). Returns the count."""
    with get_db() as conn:
        return conn.execute("DELETE FROM conversations").rowcount