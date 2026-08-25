
import os
import pytest

@pytest.fixture()
def app(tmp_path, monkeypatch):
    monkeypatch.setenv("RICH_TUTOR_SECRET", "test-secret")
    monkeypatch.setenv("ADMIN_USERNAME", "admin")
    monkeypatch.setenv("ADMIN_PASSWORD", "admin")

    import app as app_module

    app_module.DB = tmp_path / "rich_tutor_test.db"
    app_module.app.config.update(TESTING=True, SECRET_KEY="test-secret")
    app_module.init_db()

    yield app_module.app

@pytest.fixture()
def client(app):
    return app.test_client()
