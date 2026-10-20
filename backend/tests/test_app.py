import secrets
import pytest
from fastapi.testclient import TestClient
from app.main import create_app

TOKEN = secrets.token_hex(32)

@pytest.fixture
def client():
    with TestClient(create_app(TOKEN), base_url="http://127.0.0.1") as value:
        yield value


def test_health_truthful(client):
    r = client.get("/health", headers={"Authorization": "Bearer " + TOKEN})
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "application": "GLOBAL MARKET TERMINAL", "version": "0.1.0", "phase": 1,
                        "mode": "read-only", "providersConnected": False, "marketHistoryStorage": "none"}
    assert TOKEN not in r.text


@pytest.mark.parametrize("header", [None, "Bearer invalid", "Basic xyz", "Bearer " + "0" * 64, "Bearer ü"])
def test_missing_invalid_auth(client, header):
    headers = {} if header is None else {"Authorization": header}
    # httpx encodes header values as ASCII; Unicode is covered in shutdown protocol tests.
    if header == "Bearer ü":
        headers = {b"Authorization": b"Bearer \xc3\xbc"}
    assert client.get("/health", headers=headers).status_code == 401


@pytest.mark.parametrize("route", ["/docs", "/openapi.json", "/history", "/shutdown", "/unknown"])
def test_every_route_authenticates_before_routing(client, route):
    assert client.get(route).status_code == 401
    assert client.get(route, headers={"Authorization": "Bearer " + TOKEN}).status_code == 404


def test_browser_origin_rejected(client):
    assert client.get("/health", headers={"Authorization": "Bearer " + TOKEN, "Origin": "http://evil.example"}).status_code == 403


def test_non_loopback_host_rejected(client):
    assert client.get("http://evil.example/health", headers={"Authorization": "Bearer " + TOKEN}).status_code == 400


@pytest.mark.parametrize("token", ["", "short", "z" * 64, "0" * 63])
def test_invalid_bootstrap_token(token):
    with pytest.raises(ValueError):
        create_app(token)
