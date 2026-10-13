import re

from app.memory_service import STOPWORDS, list_memories

# Words that appear in many questions but say nothing about a topic.
# Without this list, "learning" in "best way of learning guitar" would
# wrongly pull in a memory about learning FastAPI.
GENERIC_WORDS = {
    "best", "better", "good", "great", "way", "ways", "help", "need", "make",
    "made", "use", "using", "used", "learn", "learning", "explain", "show",
    "give", "get", "know", "think", "work", "works", "working", "thing",
    "things", "something", "anything", "example", "examples", "simple",
    "easy", "new", "old", "start", "tips", "tip", "idea", "ideas",
}


def _stem(word: str) -> str:
    """Very light stemming: 'algorithms' -> 'algorithm'. Not a full stemmer."""
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def terms_of(text: str) -> set[str]:
    """The meaningful, stemmed words of a text."""
    terms = set()
    for word in re.findall(r"[a-z0-9][a-z0-9+#]*", text.lower()):
        if len(word) > 1 and word not in STOPWORDS and word not in GENERIC_WORDS:
            terms.add(_stem(word))
    return terms


def rank_memories(
    query: str, memories: list[dict], limit: int = 3, min_score: float = 1.0
) -> list[dict]:
    """Score every memory against the question and return the best few."""
    query_terms = terms_of(query)
    results = []
    for memory in memories:
        memory_terms = terms_of(memory["keywords"])
        shared = sorted(query_terms & memory_terms)
        if not shared:
            continue
        results.append(
            {
                **memory,
                "score": float(len(shared)),
                "coverage": round(len(shared) / len(memory_terms), 2),
                "matched_terms": shared,
            }
        )
    results = [r for r in results if r["score"] >= min_score]
    # Two stable sorts: newest first, then best score first (ties keep newest first).
    results.sort(key=lambda r: r["updated_at"], reverse=True)
    results.sort(key=lambda r: (r["score"], r["coverage"]), reverse=True)
    return results[:limit]


def find_relevant_memories(query: str, limit: int = 3) -> list[dict]:
    """Read the saved memories fresh from the database and rank them."""
    return rank_memories(query, list_memories(), limit=limit)