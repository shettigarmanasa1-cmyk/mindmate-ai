from app.memory_retrieval import rank_memories
from app.memory_service import extract_keywords


def mem(content, updated_at="2026-01-01"):
    return {
        "id": content,
        "content": content,
        "keywords": extract_keywords(content),
        "updated_at": updated_at,
    }


def add_memory(client, content):
    response = client.post("/api/memories", json={"content": content})
    assert response.status_code == 201
    return response.json()


def relevant(client, question):
    response = client.get("/api/memories/relevant", params={"q": question})
    assert response.status_code == 200
    return response.json()


def test_finds_relevant_memory():
    memories = [mem("User prefers Python"), mem("User likes spicy pasta")]
    results = rank_memories("Can you explain Python lists?", memories)
    assert [r["content"] for r in results] == ["User prefers Python"]


def test_ignores_unrelated_memory():
    memories = [mem("User prefers Python"), mem("User is learning FastAPI")]
    assert rank_memories("What is a good recipe for pasta?", memories) == []


def test_generic_words_alone_do_not_match():
    memories = [mem("User is learning FastAPI"), mem("User is learning guitar")]
    results = rank_memories("What is the best way of learning guitar?", memories)
    assert [r["content"] for r in results] == ["User is learning guitar"]


def test_better_match_ranks_first():
    weak = mem("User prefers Python")
    strong = mem("User is building a Python FastAPI project")
    results = rank_memories("Help me with my Python FastAPI project", [weak, strong])
    assert [r["content"] for r in results] == [strong["content"], weak["content"]]
    assert results[0]["score"] > results[1]["score"]


def test_limit_is_respected():
    memories = [
        mem("User prefers Python"),
        mem("User is building a Python app"),
        mem("User uses Python daily"),
    ]
    assert len(rank_memories("Python", memories, limit=2)) == 2


def test_returns_matched_terms_and_score():
    result = rank_memories("Tell me about Python", [mem("User prefers Python")])[0]
    assert result["matched_terms"] == ["python"]
    assert result["score"] == 1.0


def test_plural_and_singular_match():
    memories = [mem("User is learning algorithms")]
    results = rank_memories("Explain this algorithm", memories)
    assert len(results) == 1


def test_no_memories_returns_empty():
    assert rank_memories("Anything at all", []) == []


def test_relevant_endpoint_finds_memory(client):
    saved = add_memory(client, "User prefers Python")
    results = relevant(client, "Show me Python tips")
    assert [r["id"] for r in results] == [saved["id"]]
    assert results[0]["matched_terms"] == ["python"]
    assert relevant(client, "What is the weather like?") == []


def test_deleted_memory_is_not_retrieved(client):
    saved = add_memory(client, "User prefers Python")
    assert len(relevant(client, "Python")) == 1
    client.delete(f"/api/memories/{saved['id']}")
    assert relevant(client, "Python") == []


def test_changed_preference_is_retrieved_after_replace(client):
    old = add_memory(client, "User prefers Python")
    proposal = client.post(
        "/api/memories/proposals",
        json={"content": "User prefers Java", "replaces_memory_id": old["id"]},
    ).json()
    client.post(f"/api/memories/proposals/{proposal['id']}/approve")
    assert len(relevant(client, "Java")) == 1
    assert relevant(client, "Python") == []


def test_relevant_endpoint_rejects_empty_query(client):
    assert client.get("/api/memories/relevant", params={"q": ""}).status_code == 422