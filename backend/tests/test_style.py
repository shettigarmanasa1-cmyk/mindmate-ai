import pytest

from app import llm_service


@pytest.fixture
def fake_llm(monkeypatch):
    calls = []

    def fake_generate_reply(history):
        calls.append(history)
        return "Mock reply"

    monkeypatch.setattr(llm_service, "generate_reply", fake_generate_reply)
    return calls


def system_texts(call):
    return [m["content"] for m in call if m["role"] == "system"]


def test_default_settings_add_no_style_message(client, fake_llm):
    client.post("/api/chat", json={"message": "Hello"})
    assert system_texts(fake_llm[0]) == []


def test_chosen_style_is_sent_to_the_ai(client, fake_llm):
    client.patch(
        "/api/settings",
        json={"response_style": "professional", "answer_length": "short", "beginner_friendly": True},
    )
    client.post("/api/chat", json={"message": "Hello"})
    texts = system_texts(fake_llm[0])
    assert len(texts) == 1
    lowered = texts[0].lower()
    assert "professional" in lowered
    assert "short" in lowered
    assert "beginner" in lowered


def test_style_still_applies_when_memory_is_off(client, fake_llm):
    client.patch("/api/settings", json={"memory_enabled": False, "answer_length": "detailed"})
    client.post("/api/chat", json={"message": "Hello"})
    assert len(system_texts(fake_llm[0])) == 1