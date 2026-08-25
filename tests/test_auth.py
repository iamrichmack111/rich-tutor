
def login(client, username="admin", password="admin"):
    return client.post(
        "/login",
        data={"username": username, "password": password},
        follow_redirects=False,
    )

def test_admin_login(client):
    r = login(client)
    assert r.status_code in (302, 303)
    assert "/admin" in r.headers["Location"]

def test_bad_login(client):
    r = client.post(
        "/login",
        data={"username": "admin", "password": "wrong"},
        follow_redirects=True,
    )
    assert r.status_code == 200
    assert b"Invalid username or password" in r.data

def test_private_curriculum_requires_login(client):
    r = client.get("/curriculum", follow_redirects=False)
    assert r.status_code in (302, 303)
    assert "/login" in r.headers["Location"]

def test_admin_route_requires_admin(client):
    r = client.get("/admin", follow_redirects=False)
    assert r.status_code in (302, 303)
    assert "/login" in r.headers["Location"]
