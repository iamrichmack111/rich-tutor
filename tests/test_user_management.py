
import sqlite3
from werkzeug.security import check_password_hash

def test_admin_created_user_requires_password_change(client):
    client.post("/login", data={"username": "admin", "password": "admin"})

    r = client.post(
        "/admin/users/create",
        data={
            "role": "student",
            "display_name": "Test Student",
            "username": "teststudent",
            "password": "temporary123",
            "parent_id": "",
        },
        follow_redirects=False,
    )
    assert r.status_code in (302, 303)

    # Log out admin
    client.get("/logout")

    r = client.post(
        "/login",
        data={"username": "teststudent", "password": "temporary123"},
        follow_redirects=False,
    )

    assert r.status_code in (302, 303)
    assert "/account/change-password" in r.headers["Location"]

def test_admin_password_reset_forces_change(client, app):
    client.post("/login", data={"username": "admin", "password": "admin"})

    client.post(
        "/admin/users/create",
        data={
            "role": "student",
            "display_name": "Reset Student",
            "username": "resetstudent",
            "password": "firstpass123",
            "parent_id": "",
        },
    )

    import app as app_module
    conn = sqlite3.connect(app_module.DB)
    row = conn.execute("SELECT id FROM users WHERE username='resetstudent'").fetchone()
    conn.close()
    assert row is not None

    uid = row[0]

    r = client.post(
        f"/admin/user/{uid}/reset-password",
        data={"new_password": "secondpass123"},
        follow_redirects=False,
    )
    assert r.status_code in (302, 303)

    client.get("/logout")
    r = client.post(
        "/login",
        data={"username": "resetstudent", "password": "secondpass123"},
        follow_redirects=False,
    )
    assert "/account/change-password" in r.headers["Location"]
