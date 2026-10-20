"""Parent-owned protocol: bounded JSON bootstrap/shutdown on stdin; no token in env/argv."""
import asyncio
import hmac
import json
import socket
import sys
import threading
import uvicorn
from app.main import create_app


def bind_loopback():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    # Keep the socket open through server startup; no bind-close-rebind port race.
    sock.bind(("127.0.0.1", 0))
    sock.listen(32)
    return sock


def is_shutdown(line, token):
    try:
        value = json.loads(line)
        return (isinstance(value, dict) and set(value) == {"command", "token"}
                and value["command"] == "shutdown" and isinstance(value["token"], str)
                and hmac.compare_digest(value["token"].encode("utf-8"), token.encode("ascii")))
    except (ValueError, TypeError):
        return False


def main():
    line = sys.stdin.buffer.readline(4097)
    if len(line) > 4096 or not line.endswith(b"\n"):
        raise ValueError("Invalid bootstrap protocol")
    value = json.loads(line)
    if not isinstance(value, dict) or set(value) != {"token"} or not isinstance(value["token"], str):
        raise ValueError("Invalid bootstrap protocol")
    token = value["token"]
    app = create_app(token)
    sock = bind_loopback()

    class ParentServer(uvicorn.Server):
        async def startup(self, sockets=None):
            await super().startup(sockets=sockets)
            if self.started:
                print(json.dumps({"ready": True, "host": "127.0.0.1", "port": sock.getsockname()[1]}), flush=True)

    server = ParentServer(uvicorn.Config(app, host="127.0.0.1", log_level="critical", access_log=False,
                                        timeout_graceful_shutdown=2, limit_concurrency=16, http="h11", ws="none"))

    async def serve():
        loop = asyncio.get_running_loop()

        def watch_parent():
            while True:
                command = sys.stdin.buffer.readline(4097)
                if not command or len(command) > 4096 or not command.endswith(b"\n") or is_shutdown(command, token):
                    loop.call_soon_threadsafe(setattr, server, "should_exit", True)
                    return

        threading.Thread(target=watch_parent, daemon=True, name="parent-pipe").start()
        await server.serve(sockets=[sock])

    try:
        asyncio.run(serve())
    finally:
        sock.close()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Never print bootstrap contents, environment, raw exception or credentials.
        print("Backend startup failed", file=sys.stderr)
        sys.exit(1)
