import http.client
import json
import os
from pathlib import Path
import queue
import secrets
import subprocess
import sys
import threading
import time
import pytest
from launcher import bind_loopback, is_shutdown

ROOT = Path(__file__).resolve().parents[2]


def test_socket_binds_only_loopback():
    with bind_loopback() as sock:
        assert sock.getsockname()[0] == "127.0.0.1"
        assert sock.getsockname()[1] > 0


@pytest.mark.parametrize("line", ['{}', 'invalid', '{"command":"shutdown","token":"wrong"}', '{"command":"shutdown","token":"ü"}'])
def test_invalid_shutdown(line):
    assert not is_shutdown(line, "0" * 64)


def launch(tmp_path):
    token = secrets.token_hex(32)
    executable = os.environ.get("GMT_FROZEN_BACKEND")
    command = [str((ROOT / executable).resolve())] if executable else [sys.executable, str(ROOT / "backend/launcher.py")]
    env = {k: os.environ[k] for k in ("PATH", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "TMPDIR") if k in os.environ}
    env.update(PYTHONDONTWRITEBYTECODE="1", PYTHONUNBUFFERED="1")
    child = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=tmp_path, env=env)
    child.stdin.write((json.dumps({"token": token}) + "\n").encode());child.stdin.flush()
    lines = queue.Queue()
    threading.Thread(target=lambda: lines.put(child.stdout.readline()), daemon=True).start()
    try:
        ready = json.loads(lines.get(timeout=20))
        assert ready["ready"] is True and ready["host"] == "127.0.0.1"
        assert token not in json.dumps(ready)
        return child, token, ready["port"]
    except BaseException:
        child.kill();child.wait(timeout=5)
        raise


def health(port, token=None):
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=3)
    try:
        conn.request("GET", "/health", headers={} if token is None else {"Authorization": "Bearer " + token})
        response = conn.getresponse()
        return response.status, response.read()
    finally:
        conn.close()


def test_process_auth_readiness_shutdown_no_history(tmp_path):
    child, token, port = launch(tmp_path)
    try:
        assert health(port)[0] == 401
        assert health(port, "wrong")[0] == 401
        status, payload = health(port, token)
        assert status == 200 and json.loads(payload)["marketHistoryStorage"] == "none"
        child.stdin.write(b'{"command":"shutdown","token":"wrong"}\n');child.stdin.flush()
        assert health(port, token)[0] == 200
        child.stdin.write((json.dumps({"command": "shutdown", "token": token}) + "\n").encode());child.stdin.flush()
        assert child.wait(timeout=8) == 0
        with pytest.raises(OSError):
            health(port, token)
        assert list(tmp_path.iterdir()) == []
        assert token.encode() not in child.stderr.read()
    finally:
        if child.poll() is None:
            child.kill();child.wait(timeout=5)


def test_parent_pipe_eof_exits(tmp_path):
    child, token, port = launch(tmp_path)
    try:
        child.stdin.close()
        assert child.wait(timeout=8) == 0
    finally:
        if child.poll() is None:
            child.kill();child.wait(timeout=5)


def test_invalid_bootstrap_fails_without_secret_log(tmp_path):
    executable = os.environ.get("GMT_FROZEN_BACKEND")
    command = [str((ROOT / executable).resolve())] if executable else [sys.executable, str(ROOT / "backend/launcher.py")]
    r = subprocess.run(command, input=b'{"token":"do-not-log"}\n', capture_output=True, cwd=tmp_path, timeout=20)
    assert r.returncode != 0
    assert b"do-not-log" not in r.stdout + r.stderr


def test_abrupt_parent_death_exits_even_with_inherited_stdin_writer(tmp_path):
    """A separate sleeper retains the write pipe: EOF alone cannot pass this test."""
    executable = os.environ.get("GMT_FROZEN_BACKEND")
    command = [str((ROOT / executable).resolve())] if executable else [sys.executable, str(ROOT / "backend/launcher.py")]
    wrapper = r'''
import json,os,secrets,subprocess,sys,time
command=json.loads(sys.argv[1])
child=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
token=secrets.token_hex(32)
child.stdin.write((json.dumps({'token':token,'parentPid':os.getpid()})+'\n').encode());child.stdin.flush()
ready=json.loads(child.stdout.readline())
os.set_inheritable(child.stdin.fileno(),True)
holder=subprocess.Popen([sys.executable,'-c','import time;time.sleep(12)'],close_fds=False,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
print(json.dumps({'port':ready['port'],'backend':child.pid,'holder':holder.pid}),flush=True)
time.sleep(30)
'''
    parent=subprocess.Popen([sys.executable,"-c",wrapper,json.dumps(command)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,cwd=tmp_path)
    try:
        lines=queue.Queue();threading.Thread(target=lambda:lines.put(parent.stdout.readline()),daemon=True).start()
        ready=json.loads(lines.get(timeout=25))
        assert health(ready['port'])[0]==401
        parent.kill();parent.wait(timeout=5)
        deadline=time.monotonic()+8
        while time.monotonic()<deadline:
            try:health(ready['port'])
            except OSError:break
            time.sleep(.1)
        else:pytest.fail("Owned backend socket survived abrupt parent death")
        # The unrelated holder is neither killed nor needed for cleanup; it
        # exits on its own bounded timer. Its continued life proves no tree kill.
        if os.name=='nt':
            import ctypes
            from ctypes import wintypes
            k=ctypes.WinDLL('kernel32',use_last_error=True)
            k.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD];k.OpenProcess.restype=wintypes.HANDLE
            k.WaitForSingleObject.argtypes=[wintypes.HANDLE,wintypes.DWORD];k.WaitForSingleObject.restype=wintypes.DWORD
            k.CloseHandle.argtypes=[wintypes.HANDLE]
            for pid,expected in [(ready['backend'],0),(ready['holder'],258)]:
                handle=k.OpenProcess(0x100000,False,pid)
                if not handle:assert expected==0
                else:
                    try:assert k.WaitForSingleObject(handle,2000 if expected==0 else 0)==expected
                    finally:k.CloseHandle(handle)
        assert list(tmp_path.iterdir())==[]
    finally:
        if parent.poll() is None:parent.kill();parent.wait(timeout=5)
