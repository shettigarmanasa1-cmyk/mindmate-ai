from types import SimpleNamespace

from app import llm_service
from app.config import settings


def test_prompt_has_consistency_and_honesty_rules():
    text = llm_service.SYSTEM_PROMPT.lower()
    assert "same names" in text
    assert "never state that something was verified" in text
    assert "transition table" in text
    assert "ask one short clarifying question" in text


def test_system_prompt_is_sent_first(monkeypatch):
    calls = []

    def create(model, messages):
        calls.append(messages)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="ok"))])

    fake_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(llm_service, "_client", lambda: fake_client)
    monkeypatch.setattr(settings, "openai_api_key", "test-key")

    reply = llm_service.generate_reply([{"role": "user", "content": "hi"}])

    assert reply == "ok"
    assert calls[0][0] == {"role": "system", "content": llm_service.SYSTEM_PROMPT}
    assert calls[0][1] == {"role": "user", "content": "hi"}
