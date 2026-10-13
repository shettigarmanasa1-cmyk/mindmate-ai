from fastapi.testclient import TestClient

from app.main import app
from app.memory_service import extract_keywords


def add_memory(client, content="User prefers Python", category="preference"):
    response = client.post("/api/memories", json={"content": content, "category": category})
    assert response.status_code == 201
    return response.json()


def propose(client, content, replaces=None):
    body = {"content": content, "category": "preference"}
    if replaces:
        body["replaces_memory_id"] = replaces
    return client.post("/api/memories/proposals", json=body)


def test_add_and_list_memory(client):
    memory = add_memory(client)
    listed = client.get("/api/memories").json()
    assert [m["id"] for m in listed] == [memory["id"]]
    assert "python" in memory["keywords"].split()


def test_proposal_is_not_a_memory_until_approved(client):
    proposal = propose(client, "User is learning FastAPI").json()
    assert proposal["status"] == "pending"
    assert client.get("/api/memories").json() == []

    result = client.post(f"/api/memories/proposals/{proposal['id']}/approve")
    assert result.status_code == 200
    assert result.json()["replaced"] is False
    assert [m["content"] for m in client.get("/api/memories").json()] == ["User is learning FastAPI"]
    assert client.get("/api/memories/proposals").json() == []


def test_rejected_proposal_is_not_saved(client):
    proposal = propose(client, "User likes spicy food").json()
    assert client.post(f"/api/memories/proposals/{proposal['id']}/reject").status_code == 200
    assert client.get("/api/memories").json() == []
    rejected = client.get("/api/memories/proposals", params={"status": "rejected"}).json()
    assert len(rejected) == 1


def test_rejected_suggestion_is_not_proposed_again(client):
    proposal = propose(client, "User likes spicy food").json()
    client.post(f"/api/memories/proposals/{proposal['id']}/reject")
    again = propose(client, "user likes spicy food.")
    assert again.status_code == 409


def test_duplicates_are_blocked(client):
    add_memory(client, "User prefers Python")
    assert propose(client, "user prefers python").status_code == 409
    assert client.post("/api/memories", json={"content": "User prefers Python"}).status_code == 409

    propose(client, "User is learning SQL")
    assert propose(client, "User is learning SQL").status_code == 409


def test_a_proposal_cannot_be_decided_twice(client):
    proposal = propose(client, "User is learning SQL").json()
    client.post(f"/api/memories/proposals/{proposal['id']}/approve")
    assert client.post(f"/api/memories/proposals/{proposal['id']}/approve").status_code == 409
    assert client.post(f"/api/memories/proposals/{proposal['id']}/reject").status_code == 409


def test_changed_preference_replace(client):
    old = add_memory(client, "User prefers Python")
    proposal = propose(client, "User prefers Java", replaces=old["id"]).json()
    assert proposal["old_content"] == "User prefers Python"
    # Nothing changes until the user decides.
    assert client.get("/api/memories").json()[0]["content"] == "User prefers Python"

    result = client.post(f"/api/memories/proposals/{proposal['id']}/approve").json()
    assert result["replaced"] is True
    memories = client.get("/api/memories").json()
    assert len(memories) == 1
    assert memories[0]["id"] == old["id"]
    assert memories[0]["content"] == "User prefers Java"
    assert "java" in memories[0]["keywords"].split()


def test_changed_preference_keep_old(client):
    old = add_memory(client, "User prefers Python")
    proposal = propose(client, "User prefers Java", replaces=old["id"]).json()
    client.post(f"/api/memories/proposals/{proposal['id']}/reject")
    memories = client.get("/api/memories").json()
    assert [m["content"] for m in memories] == ["User prefers Python"]


def test_proposal_to_replace_missing_memory_fails(client):
    assert propose(client, "User prefers Java", replaces="nope").status_code == 404


def test_update_memory(client):
    memory = add_memory(client, "User prefers Python")
    response = client.patch(
        f"/api/memories/{memory['id']}",
        json={"content": "User prefers Python and TypeScript", "category": "preference"},
    )
    assert response.status_code == 200
    assert response.json()["content"] == "User prefers Python and TypeScript"
    assert "typescript" in response.json()["keywords"].split()


def test_update_to_duplicate_or_missing_fails(client):
    add_memory(client, "User prefers Python")
    other = add_memory(client, "User is learning SQL", "goal")
    duplicate = client.patch(
        f"/api/memories/{other['id']}", json={"content": "user prefers python"}
    )
    assert duplicate.status_code == 409
    assert client.patch("/api/memories/nope", json={"content": "x"}).status_code == 404


def test_delete_memory(client):
    memory = add_memory(client)
    assert client.delete(f"/api/memories/{memory['id']}").status_code == 204
    assert client.get("/api/memories").json() == []
    assert client.delete(f"/api/memories/{memory['id']}").status_code == 404


def test_deleting_a_memory_removes_pending_replacements(client):
    old = add_memory(client, "User prefers Python")
    propose(client, "User prefers Java", replaces=old["id"])
    client.delete(f"/api/memories/{old['id']}")
    assert client.get("/api/memories/proposals").json() == []


def test_clear_all_requires_confirmation(client):
    add_memory(client, "User prefers Python")
    add_memory(client, "User is learning SQL", "goal")

    assert client.delete("/api/memories").status_code == 400
    assert len(client.get("/api/memories").json()) == 2

    response = client.delete("/api/memories", params={"confirm": "true"})
    assert response.status_code == 200
    assert response.json() == {"deleted": 2}
    assert client.get("/api/memories").json() == []


def test_approved_memories_survive_restart(client):
    proposal = propose(client, "User is learning FastAPI").json()
    client.post(f"/api/memories/proposals/{proposal['id']}/approve")
    with TestClient(app) as restarted:
        contents = [m["content"] for m in restarted.get("/api/memories").json()]
    assert contents == ["User is learning FastAPI"]


def test_invalid_input_is_rejected(client):
    assert client.post("/api/memories", json={"content": ""}).status_code == 422
    assert client.post("/api/memories", json={"content": "   "}).status_code == 422
    assert client.post("/api/memories", json={"content": "x" * 301}).status_code == 422
    assert client.post("/api/memories", json={"content": "ok", "category": "secret"}).status_code == 422


def test_extract_keywords_drops_common_words():
    assert extract_keywords("The user prefers Python and FastAPI") == "python fastapi"
    assert "c++" in extract_keywords("User is learning C++").split()