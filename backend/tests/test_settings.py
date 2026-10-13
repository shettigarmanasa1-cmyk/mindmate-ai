from fastapi.testclient import TestClient

from app.main import app


def test_memory_is_enabled_by_default(client):
    assert client.get("/api/settings").json() == {"memory_enabled": True}


def test_setting_persists_after_restart(client):
    response = client.patch("/api/settings", json={"memory_enabled": False})
    assert response.status_code == 200
    assert response.json() == {"memory_enabled": False}
    with TestClient(app) as restarted:
        assert restarted.get("/api/settings").json() == {"memory_enabled": False}


def test_invalid_value_is_rejected(client):
    assert client.patch("/api/settings", json={"memory_enabled": "maybe"}).status_code == 422


def test_empty_update_changes_nothing(client):
    assert client.patch("/api/settings", json={}).json() == {"memory_enabled": True}