> Current Phase 2 implementation: see [native integration design](PHASE-2-NATIVE-INTEGRATION.md). The Phase 1/1.1 material below is historical where superseded.

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

The backend imports no persistence or provider modules and creates no user-data files. There are no candle endpoints, synthetic datasets or candle series. Lightweight Charts creates an empty canvas. Phase 1.1 retains required TradingView/Lightweight Charts attribution as the visible status-bar text link; the optional logo widget is disabled because it injects inline CSS blocked by the existing CSP. Profile paths are independently named and never inspect or migrate existing profiles. macOS preview paths are project owned. Windows uses inherited per-user AppData permissions only; robust NTFS DACL enforcement, reparse-point review and multi-user threat tests remain Phase 2 work.

The packaged target is Windows x64 only. Native Windows PyInstaller `onedir` freezing avoids a one-file extraction subprocess design. electron-builder creates a directory package and a per-user NSIS installer, with elevation disallowed, no desktop shortcut, no update feed and publish=never. Existing packaging output directories cause a clear failure rather than automatic removal. This is an unsigned development candidate and does not establish Windows 11 interactive installation, signing, SmartScreen reputation or production readiness.

## Phase 1.1 terminal workspace

The renderer uses a compact desktop grid: 32px application header, 48px main toolbar, flexible workspace and 24px status bar. The workspace has a permanent 44px drawing rail, an expanding chart and an optional right watchlist (320px by default, bounded to 280–420px). The watchlist automatically collapses below 1100px unless explicitly opened in the current session. The separator supports pointer capture and keyboard arrows/Home/End. The drawing rail scrolls when the minimum window cannot contain all tools vertically.

Candle interval, grid, cursor and watchlist visibility/width are React session state. Reloading resets them. There are no preference, watchlist, layout, quote or drawing persistence APIs in the renderer. No market data is fetched, provided or seeded. Chromium/Electron may still create incidental profile/cache and operating-system files; this is not a zero-file-write claim.

ChartWorkspace creates Lightweight Charts without any data series. A ResizeObserver schedules explicit canvas resizing through requestAnimationFrame; unmount disconnects it, cancels pending work and removes the chart. Empty axis/provenance labels contain no fabricated prices, exchange identity or timestamps. Presentation contracts distinguish empty/loading/offline, backend failure and future provider failure. Only backend loading/failure and provider-offline states are wired today; provider-error rendering is tested as a presentation contract and cannot claim a connected provider.

Enabled controls have local view or existing authenticated-status actions. Planned data, study, drawing, watchlist, range, scaling, export, replay and alert controls are disabled with explanatory labels. Native operating-system window chrome is retained. The renderer fullscreen entry is disabled because its permission/IPC operation is not available. This phase introduces no main/preload/backend/permission/CSP changes and no new IPC capability.
