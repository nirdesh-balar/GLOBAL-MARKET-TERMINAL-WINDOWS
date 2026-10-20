# Phase 1 architecture

The renderer is an unprivileged React application. Its typed preload bridge exposes exactly `status()`, `health()`, and `openAttribution()`. The latter opens only the constant `https://www.tradingview.com/` URL in the system browser; arguments supplied by JavaScript are discarded. It cannot open arbitrary links. There is no filesystem, shell, process, HTTP URL, backend port, token, raw ipcRenderer or Node exposure.

Electron main validates the exact owning webContents, the main frame identity, and its expected production document URL (or fixed loopback Vite origin). It accepts a single enum operation with no extra arguments. Health is always GET `/health`; callers cannot select a path, method, headers, body or target. Concurrent health checks share one bounded request. Replies are schema checked and rebuilt from safe fields. Status returns only state and an intentionally generic message.

```text
React → isolated preload → validated main-process IPC → GET authenticated /health
                                                   ↓
                                      owned Python child / 127.0.0.1:dynamic
Electron main → private stdin bootstrap and shutdown protocol → Python
Python → bounded JSON readiness on stdout → Electron main
```

The main process generates a 256-bit token for each child lifetime. It passes the token once over the child's private stdin pipe, never in argv, environment, renderer JavaScript, browser storage or log output. The child environment uses a short OS-runtime allowlist. Python validates token format, binds an IPv4 loopback socket to port 0, keeps that exact socket open, and announces readiness only after Uvicorn has started. Electron then performs authenticated health verification. All HTTP routes, including health, disabled docs and unknown paths, pass the auth middleware before routing. Browser Origin headers and non-loopback Host values are denied. There is no CORS opt-in.

The child accepts only a bounded JSON shutdown command with a constant-time token comparison. Wrong commands do not stop it. Closing the parent pipe also requests shutdown. Electron waits three seconds, then terminates only its own ChildProcess handle and waits another two seconds. There are no name-based process lookups, taskkill, shell commands or process-group kills. Python's graceful timeout is two seconds. A missing executable, timeout, invalid readiness, failed health or unexpected child exit produces a failed service status in the shell; there is no automatic provider fallback or replacement dataset.

BrowserWindow sets contextIsolation=true, nodeIntegration=false, sandbox=true, webSecurity=true and webviewTag=false. New windows, navigation, redirects, downloads, webviews and permission requests/checks are denied. Packaged renderer connections are blocked by CSP and the session request filter. Production allows only self scripts/styles and shipped assets, denies inline scripts/eval/network/frames/forms. Library canvas sizing occurs through DOM properties. Development alone allows the exact local Vite endpoint and HMR websocket. Electron uses an in-memory renderer session with HTTP cache disabled. Browser cache/profile infrastructure may exist; it is not a market-history store.

The backend imports no persistence or provider modules and creates no user-data files. There are no candle endpoints, synthetic datasets or candle series. Lightweight Charts creates an empty canvas with attribution enabled. Profile paths are independently named and never inspect or migrate existing profiles. macOS preview paths are project owned. Windows uses inherited per-user AppData permissions only; robust NTFS DACL enforcement, reparse-point review and multi-user threat tests remain Phase 2 work.

The packaged target is Windows x64 only. Native Windows PyInstaller `onedir` freezing avoids a one-file extraction subprocess design. electron-builder creates a directory package and a per-user NSIS installer, with elevation disallowed, no desktop shortcut, no update feed and publish=never. Existing packaging output directories cause a clear failure rather than automatic removal. This is an unsigned development candidate and does not establish Windows 11 interactive installation, signing, SmartScreen reputation or production readiness.
