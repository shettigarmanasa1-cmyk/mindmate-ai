from fastapi.testclient import TestClient

from app import conversation_service as service
from app.database import get_db
from app.main import app


def make(client, title="Python help"):
    return client.post("/api/conversations", json={"title": title}).json()


def test_create_and_get_conversation(client):
    response = client.post("/api/conversations", json={"title": "Python help"})
    assert response.status_code == 201
    created = response.json()
    assert created["title"] == "Python help"

    fetched = client.get(f"/api/conversations/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["messages"] == []


def test_list_conversations(client):
    make(client, "First")
    make(client, "Second")
    titles = [c["title"] for c in client.get("/api/conversations").json()]
    assert sorted(titles) == ["First", "Second"]


def test_messages_are_saved_in_order(client):
    conv = make(client)
    service.add_message(conv["id"], "user", "Hello")
    service.add_message(conv["id"], "assistant", "Hi there")
    service.add_message(conv["id"], "user", "Explain lists")

    messages = client.get(f"/api/conversations/{conv['id']}").json()["messages"]
    assert [m["content"] for m in messages] == ["Hello", "Hi there", "Explain lists"]
    assert [m["role"] for m in messages] == ["user", "assistant", "user"]


def test_rename_conversation(client):
    conv = make(client, "Old name")
    response = client.patch(f"/api/conversations/{conv['id']}", json={"title": "New name"})
    assert response.status_code == 200
    assert response.json()["title"] == "New name"


def test_delete_conversation_removes_its_messages(client):
    conv = make(client)
    service.add_message(conv["id"], "user", "Hello")

    assert client.delete(f"/api/conversations/{conv['id']}").status_code == 204
    assert client.get(f"/api/conversations/{conv['id']}").status_code == 404

    with get_db() as conn:
        count = conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
    assert count == 0


def test_missing_conversation_returns_404(client):
    assert client.get("/api/conversations/nope").status_code == 404
    assert client.patch("/api/conversations/nope", json={"title": "x"}).status_code == 404
    assert client.delete("/api/conversations/nope").status_code == 404


def test_invalid_input_is_rejected(client):
    assert client.post("/api/conversations", json={"title": ""}).status_code == 422
    assert client.post("/api/conversations", json={"title": "   "}).status_code == 422
    assert client.post("/api/conversations", json={"title": "x" * 101}).status_code == 422
    assert client.get("/api/conversations/search", params={"q": ""}).status_code == 422


def test_search_finds_title_and_message_text(client):
    python_chat = make(client, "Python basics")
    cooking_chat = make(client, "Cooking ideas")
    service.add_message(cooking_chat["id"], "user", "I want to learn about pasta")

    by_title = client.get("/api/conversations/search", params={"q": "python"}).json()
    assert [c["id"] for c in by_title] == [python_chat["id"]]

    by_message = client.get("/api/conversations/search", params={"q": "pasta"}).json()
    assert [c["id"] for c in by_message] == [cooking_chat["id"]]

    assert client.get("/api/conversations/search", params={"q": "zebra"}).json() == []


def test_search_treats_percent_as_plain_text(client):
    make(client, "Alpha")
    make(client, "Beta")
    assert client.get("/api/conversations/search", params={"q": "%"}).json() == []


def test_conversation_survives_restart(client):
    conv = make(client)
    # A second client starts the app again on the same database file.
    with TestClient(app) as restarted:
        assert restarted.get(f"/api/conversations/{conv['id']}").status_code == 200