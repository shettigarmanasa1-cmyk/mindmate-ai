import pytest

from app import llm_service
from app.config import settings


@pytest.fixture
def fake_llm(monkeypatch):
    """Replace the real AI with a fake one that records what it was sent."""
    calls = []

    def fake_generate_reply(history):
        calls.append(history)
        return "Mock reply"

    monkeypatch.setattr(llm_service, "generate_reply", fake_generate_reply)
    return calls


def test_chat_starts_new_conversation_and_saves_messages(client, fake_llm):
    response = client.post("/api/chat", json={"message": "Hello there"})
    assert response.status_code == 200
    data = response.json()
    assert data["assistant_message"]["content"] == "Mock reply"
    assert data["title"] == "Hello there"

    saved = client.get(f"/api/conversations/{data['conversation_id']}").json()
    assert [m["role"] for m in saved["messages"]] == ["user", "assistant"]
    assert [m["content"] for m in saved["messages"]] == ["Hello there", "Mock reply"]


def test_follow_up_sends_earlier_messages_to_the_ai(client, fake_llm):
    first = client.post("/api/chat", json={"message": "My name is Asha"}).json()
    client.post(
        "/api/chat",
        json={"message": "What is my name?", "conversation_id": first["conversation_id"]},
    )
    second_call = fake_llm[1]
    assert [m["content"] for m in second_call] == [
        "My name is Asha",
        "Mock reply",
        "What is my name?",
    ]


def test_only_latest_messages_are_sent(client, fake_llm):
    conv_id = None
    for i in range(15):
        body = {"message": f"message {i}"}
        if conv_id:
            body["conversation_id"] = conv_id
        conv_id = client.post("/api/chat", json=body).json()["conversation_id"]
    assert len(fake_llm[-1]) == 20


def test_unknown_conversation_returns_404(client, fake_llm):
    response = client.post("/api/chat", json={"message": "Hi", "conversation_id": "nope"})
    assert response.status_code == 404
    assert fake_llm == []


def test_empty_message_is_rejected(client, fake_llm):
    assert client.post("/api/chat", json={"message": ""}).status_code == 422
    assert client.post("/api/chat", json={"message": "   "}).status_code == 422
    assert client.post("/api/chat", json={"message": "x" * 4001}).status_code == 422


def test_ai_failure_returns_safe_error_and_keeps_user_message(client, monkeypatch):
    def failing(history):
        raise llm_service.LLMError("The AI is busy right now. Please try again shortly.", 429)

    monkeypatch.setattr(llm_service, "generate_reply", failing)
    response = client.post("/api/chat", json={"message": "Hello"})
    assert response.status_code == 429
    assert response.json()["detail"] == "The AI is busy right now. Please try again shortly."

    conversations = client.get("/api/conversations").json()
    saved = client.get(f"/api/conversations/{conversations[0]['id']}").json()
    assert [m["role"] for m in saved["messages"]] == ["user"]


def test_missing_api_key_gives_clear_error(client, monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "")
    response = client.post("/api/chat", json={"message": "Hello"})
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]