import re

from app.database import get_db, new_id, now

# Very common words. If we kept them as keywords, unrelated memories
# would "match" just because they share words like "the" or "prefers".
STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "is", "are", "was", "were", "be",
    "been", "am", "i", "me", "my", "mine", "we", "you", "your", "he", "she",
    "it", "its", "they", "them", "of", "to", "in", "on", "at", "for", "with",
    "from", "by", "as", "that", "this", "these", "those", "so", "do", "does",
    "did", "have", "has", "had", "will", "would", "can", "could", "should",
    "user", "users", "prefer", "prefers", "like", "likes", "want", "wants",
    "what", "which", "who", "how", "why", "when", "where", "about", "please",
    "tell", "some",
}


class MemoryServiceError(Exception):
    """A problem with a message that is safe to show to the user."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class NotFoundError(MemoryServiceError):
    def __init__(self, message: str = "Not found"):
        super().__init__(message, 404)


class ConflictError(MemoryServiceError):
    def __init__(self, message: str):
        super().__init__(message, 409)


def normalize(text: str) -> str:
    """Lowercase, collapse spaces, drop end punctuation. Used to spot duplicates."""
    return re.sub(r"\s+", " ", text.strip().lower()).rstrip(".!? ")


def extract_keywords(text: str) -> str:
    """Keep the meaningful words, as a space-separated string."""
    keywords: list[str] = []
    for word in re.findall(r"[a-z0-9][a-z0-9+#]*", text.lower()):
        if len(word) > 1 and word not in STOPWORDS and word not in keywords:
            keywords.append(word)
    return " ".join(keywords)


# ---------- internal helpers (they receive an open connection) ----------

def _get_memory(conn, memory_id: str) -> dict | None:
    row = conn.execute(
        "SELECT id, content, category, keywords, created_at, updated_at "
        "FROM memories WHERE id = ?",
        (memory_id,),
    ).fetchone()
    return dict(row) if row else None


def _find_duplicate(conn, content: str, exclude_id: str | None = None) -> str | None:
    target = normalize(content)
    for row in conn.execute("SELECT id, content FROM memories").fetchall():
        if row["id"] != exclude_id and normalize(row["content"]) == target:
            return row["id"]
    return None


def _insert_memory(conn, content: str, category: str) -> dict:
    if _find_duplicate(conn, content):
        raise ConflictError("This memory is already saved.")
    memory_id = new_id()
    timestamp = now()
    conn.execute(
        "INSERT INTO memories (id, content, category, keywords, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (memory_id, content, category, extract_keywords(content), timestamp, timestamp),
    )
    return _get_memory(conn, memory_id)


_PROPOSAL_SQL = (
    "SELECT p.id, p.content, p.category, p.status, p.replaces_memory_id, "
    "p.source_conversation_id, p.created_at, m.content AS old_content "
    "FROM proposed_memories p "
    "LEFT JOIN memories m ON m.id = p.replaces_memory_id "
)


def _get_proposal(conn, proposal_id: str) -> dict | None:
    row = conn.execute(_PROPOSAL_SQL + "WHERE p.id = ?", (proposal_id,)).fetchone()
    return dict(row) if row else None


def _pending_proposal(conn, proposal_id: str) -> dict:
    proposal = _get_proposal(conn, proposal_id)
    if proposal is None:
        raise NotFoundError("Suggestion not found")
    if proposal["status"] != "pending":
        raise ConflictError("This suggestion was already decided.")
    return proposal


# ---------- memories ----------

def list_memories() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, content, category, keywords, created_at, updated_at "
            "FROM memories ORDER BY updated_at DESC"
        ).fetchall()
    return [dict(row) for row in rows]


def create_memory(content: str, category: str = "general") -> dict:
    """Used when the user adds a memory by hand (their own explicit choice)."""
    with get_db() as conn:
        return _insert_memory(conn, content, category)


def update_memory(memory_id: str, content: str, category: str) -> dict:
    with get_db() as conn:
        if _get_memory(conn, memory_id) is None:
            raise NotFoundError("Memory not found")
        if _find_duplicate(conn, content, exclude_id=memory_id):
            raise ConflictError("Another memory already says this.")
        conn.execute(
            "UPDATE memories SET content = ?, category = ?, keywords = ?, "
            "updated_at = ? WHERE id = ?",
            (content, category, extract_keywords(content), now(), memory_id),
        )
        return _get_memory(conn, memory_id)


def delete_memory(memory_id: str) -> None:
    with get_db() as conn:
        # A pending "replace this memory" suggestion makes no sense any more.
        conn.execute(
            "DELETE FROM proposed_memories "
            "WHERE replaces_memory_id = ? AND status = 'pending'",
            (memory_id,),
        )
        cursor = conn.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
        if cursor.rowcount == 0:
            raise NotFoundError("Memory not found")


def clear_memories() -> int:
    """Delete every memory. Returns how many were deleted."""
    with get_db() as conn:
        conn.execute(
            "DELETE FROM proposed_memories "
            "WHERE replaces_memory_id IS NOT NULL AND status = 'pending'"
        )
        return conn.execute("DELETE FROM memories").rowcount


# ---------- proposals ----------

def propose_memory(
    content: str,
    category: str = "general",
    replaces_memory_id: str | None = None,
    source_conversation_id: str | None = None,
) -> dict:
    target = normalize(content)
    with get_db() as conn:
        if replaces_memory_id and _get_memory(conn, replaces_memory_id) is None:
            raise NotFoundError("The memory to replace was not found")
        if source_conversation_id:
            exists = conn.execute(
                "SELECT 1 FROM conversations WHERE id = ?", (source_conversation_id,)
            ).fetchone()
            if exists is None:
                raise NotFoundError("Conversation not found")
        if _find_duplicate(conn, content):
            raise ConflictError("This is already saved as a memory.")

        earlier = conn.execute(
            "SELECT content, status FROM proposed_memories "
            "WHERE status IN ('pending', 'rejected')"
        ).fetchall()
        for row in earlier:
            if normalize(row["content"]) == target:
                if row["status"] == "pending":
                    raise ConflictError("This suggestion is already waiting for your decision.")
                raise ConflictError("You already rejected this suggestion.")

        proposal_id = new_id()
        conn.execute(
            "INSERT INTO proposed_memories (id, content, category, keywords, "
            "replaces_memory_id, status, source_conversation_id, created_at) "
            "VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
            (
                proposal_id, content, category, extract_keywords(content),
                replaces_memory_id, source_conversation_id, now(),
            ),
        )
        return _get_proposal(conn, proposal_id)


def list_proposals(status: str = "pending") -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            _PROPOSAL_SQL + "WHERE p.status = ? ORDER BY p.created_at DESC",
            (status,),
        ).fetchall()
    return [dict(row) for row in rows]


def approve_proposal(proposal_id: str) -> dict:
    """Approve: add a new memory, or replace the old one if the proposal asks to."""
    with get_db() as conn:
        proposal = _pending_proposal(conn, proposal_id)
        old_id = proposal["replaces_memory_id"]
        if old_id:
            if _get_memory(conn, old_id) is None:
                raise ConflictError("The memory this would replace no longer exists.")
            if _find_duplicate(conn, proposal["content"], exclude_id=old_id):
                raise ConflictError("Another memory already says this.")
            conn.execute(
                "UPDATE memories SET content = ?, category = ?, keywords = ?, "
                "updated_at = ? WHERE id = ?",
                (
                    proposal["content"], proposal["category"],
                    extract_keywords(proposal["content"]), now(), old_id,
                ),
            )
            memory = _get_memory(conn, old_id)
        else:
            memory = _insert_memory(conn, proposal["content"], proposal["category"])
        conn.execute(
            "UPDATE proposed_memories SET status = 'approved' WHERE id = ?",
            (proposal_id,),
        )
    return {"memory": memory, "replaced": bool(old_id)}


def reject_proposal(proposal_id: str) -> dict:
    """Reject: nothing is saved. For a replace proposal this means 'keep the old one'."""
    with get_db() as conn:
        _pending_proposal(conn, proposal_id)
        conn.execute(
            "UPDATE proposed_memories SET status = 'rejected' WHERE id = ?",
            (proposal_id,),
        )
        return _get_proposal(conn, proposal_id)