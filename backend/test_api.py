from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def new_state():
    r = client.post("/api/new")
    assert r.status_code == 200
    return r.json()


def test_new_game_has_24_drops_and_no_centre():
    data = new_state()
    assert data["state"]["phase"] == "drop"
    assert len(data["legal"]) == 24
    assert all(m["to"] != 12 for m in data["legal"])


def test_centre_drop_is_rejected():
    state = new_state()["state"]
    r = client.post("/api/play", json={"state": state, "move": {"type": "drop", "to": 12}})
    assert r.status_code == 400


def test_play_drop_then_ai_returns_tree():
    state = new_state()["state"]
    r = client.post("/api/play", json={"state": state, "move": {"type": "drop", "to": 0}})
    assert r.status_code == 200
    state = r.json()["state"]
    r = client.post("/api/ai", json={"state": state, "depth": 2, "show_depth": 2})
    assert r.status_code == 200
    data = r.json()
    assert data["tree"]["status"] == "root"
    assert any(c["status"] == "best" for c in data["tree"]["children"])
    assert data["stats"]["nodes"] > 1
