
import re

def test_admin_can_open_invites(client):
    client.post("/login", data={"username": "admin", "password": "admin"})
    r = client.get("/admin/invites")
    assert r.status_code == 200
    assert b"Invite" in r.data

def test_admin_can_create_student_invite(client):
    client.post("/login", data={"username": "admin", "password": "admin"})
    r = client.post(
        "/admin/invites/create",
        data={"role": "student", "days": "7"},
        follow_redirects=True,
    )
    assert r.status_code == 200
    assert b"/invite/" in r.data
