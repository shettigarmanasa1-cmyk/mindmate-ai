from fastapi.testclient import TestClient

from app.main import app

DEFAULT = {
    "memory_enabled": True,
    "response_style": "friendly",
    "answer_length": "balanced",
    "beginner_friendly": False,
}


def test_defaults(client):
    assert client.get("/api/settings").json() == DEFAULT


def test_setting_persists_after_restart(client):
    response = client.patch("/api/settings", json={"memory_enabled": False})
    assert response.status_code == 200
    with TestClient(app) as restarted:
        assert restarted.get("/api/settings").json()["memory_enabled"] is False


def test_all_settings_can_be_changed(client):
    changes = {
        "response_style": "professional",
        "answer_length": "short",
        "beginner_friendly": True,
    }
    response = client.patch("/api/settings", json=changes)
    assert response.json() == {**DEFAULT, **changes}


def test_invalid_values_are_rejected(client):
    assert client.patch("/api/settings", json={"memory_enabled": "maybe"}).status_code == 422
    assert client.patch("/api/settings", json={"response_style": "angry"}).status_code == 422
    assert client.patch("/api/settings", json={"answer_length": "huge"}).status_code == 422


def test_empty_update_changes_nothing(client):
    assert client.patch("/api/settings", json={}).json() == DEFAULT


def test_partial_update_keeps_other_settings(client):
    client.patch("/api/settings", json={"answer_length": "detailed"})
    result = client.patch("/api/settings", json={"beginner_friendly": True}).json()
    assert result["answer_length"] == "detailed"
    assert result["beginner_friendly"] is True