from app import conversation_service as conversations
from app.config import settings
from app.database import get_db


def test_delete_all_conversations_requires_confirmation(client):
    conv = client.post("/api/conversations", json={"title": "A"}).json()
    conversations.add_message(conv["id"], "user", "hi")

    assert client.delete("/api/conversations").status_code == 400
    assert len(client.get("/api/conversations").json()) == 1

    response = client.delete("/api/conversations", params={"confirm": "true"})
    assert response.status_code == 200
    assert response.json() == {"deleted": 1}
    assert client.get("/api/conversations").json() == []
    with get_db() as conn:
        assert conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0] == 0


def test_export_contains_all_user_data(client):
    conv = client.post("/api/conversations", json={"title": "A"}).json()
    conversations.add_message(conv["id"], "user", "hi")
    client.post("/api/memories", json={"content": "User prefers Python"})
    client.post("/api/memories/proposals", json={"content": "User is learning SQL"})

    response = client.get("/api/export")
    assert response.status_code == 200
    assert "attachment" in response.headers["content-disposition"]
    data = response.json()
    assert data["conversations"][0]["messages"][0]["content"] == "hi"
    assert [m["content"] for m in data["memories"]] == ["User prefers Python"]
    assert [p["content"] for p in data["suggestions"]["pending"]] == ["User is learning SQL"]
    assert data["settings"]["memory_enabled"] is True
    assert "exported_at" in data


def test_export_and_info_never_contain_the_api_key(client, monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "sk-test-secret-123")
    assert "sk-test-secret-123" not in client.get("/api/export").text
    assert "sk-test-secret-123" not in client.get("/api/data-info").text


def test_data_info_explains_storage(client):
    info = client.get("/api/data-info").json()
    assert info["stored"]
    assert info["sent_to_ai_provider"]
    assert info["your_controls"]
    