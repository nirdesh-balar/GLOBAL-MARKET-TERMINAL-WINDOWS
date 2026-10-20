"""No providers, user profiles, databases or market-history storage in Phase 1."""
import hmac
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


def create_app(token: str) -> FastAPI:
    if len(token) != 64 or any(c not in "0123456789abcdef" for c in token):
        raise ValueError("A 256-bit runtime token is required")
    app = FastAPI(title="GLOBAL MARKET TERMINAL Windows", docs_url=None, redoc_url=None, openapi_url=None)

    @app.middleware("http")
    async def authenticate(request: Request, call_next):
        supplied = request.headers.get("authorization", "").encode("utf-8")
        if not hmac.compare_digest(supplied, ("Bearer " + token).encode("ascii")):
            return JSONResponse({"detail": "Authentication required"}, status_code=401, headers={"WWW-Authenticate": "Bearer"})
        if request.headers.get("origin"):
            return JSONResponse({"detail": "Browser origins are not permitted"}, status_code=403)
        if request.url.hostname != "127.0.0.1":
            return JSONResponse({"detail": "Loopback host required"}, status_code=400)
        return await call_next(request)

    @app.get("/health")
    async def health():
        return {"status": "ok", "application": "GLOBAL MARKET TERMINAL", "version": "0.1.0", "phase": 1,
                "mode": "read-only", "providersConnected": False, "marketHistoryStorage": "none"}

    return app
