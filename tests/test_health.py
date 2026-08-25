
def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.get_json() == {"app": "Rich Tutor", "status": "ok"}
