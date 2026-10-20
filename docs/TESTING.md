> Current Phase 2 implementation: see [native integration design](PHASE-2-NATIVE-INTEGRATION.md). The Phase 1/1.1 material below is historical where superseded.

# Phase 1 verification

`npm run test` checks TypeScript, builds production assets/main/preload, runs Node tests, runs Python tests, then launches a real Electron production-assets smoke test. No `--no-sandbox`, mock candle data, real provider calls, protected profile access or paid service is used. Socket and GUI permissions are needed on the development host. In a restricted automation environment, rerun the same test under the authorized local-network/GUI execution permission; do not weaken authentication or disable Electron's sandbox.

Node suites:

- `security.test.mjs`: exact IPC enums and arguments; main-frame/sender/document checks; executed preload with an Electron harness proving fixed channels/operations and no arbitrary inputs; restrictive production CSP; platform executable/profile paths; Windows packaging guards.
- `backend.test.mjs`: real authenticated backend start and owned shutdown while an unrelated process survives; missing executable; early exit; startup timeout; malformed readiness; unexpected backend exit state.
- `production.test.mjs`: emitted asset references resolve; offline CSP; no series/data mutation or backend database imports; actual non-Windows packaging command refuses to run.

Python suites:

- `test_app.py`: exact truthful health response; missing, malformed and invalid auth including Unicode bytes; disabled and unknown routes still require auth; allowed requests; Origin/Host rejection; startup token format.
- `test_process.py`: actual socket bind; invalid shutdown payloads; real subprocess readiness/health auth; wrong token cannot stop it; authenticated bounded exit; closed port and no backend file writes; parent EOF; failure redaction.

Electron smoke (`npm run test:ui`, also part of npm test): production HTML/JS/CSS/chart canvas loads, honest provider-offline text, real backend readiness, exact preload shape, no Node/global process or web storage secrets, actual BrowserWindow isolation flags, blocked renderer network/popups/navigation, actual IPC rejection of a second untrusted BrowserWindow, narrow viewport, no renderer errors, and application shutdown. It creates only a new empty `gmt-win-smoke-*` directory under the OS temporary directory. The application rejects non-temporary, nonempty or unrelated test roots, including symlink resolution outside the temporary root. Artifacts are saved to reports/.

Native Windows workflow additionally runs the process tests against the **actual PyInstaller exe**, then runs the same Electron smoke against the **actual win-unpacked exe**. It verifies expected files and hashes both application/backend files and NSIS. These scripts have not established a Windows result until a real Actions run completes. Installer execution is not simulated by checking file existence.

Separate evidence categories must be retained: (1) local macOS development/production-asset checks; (2) native Windows automated unit checks; (3) frozen backend and packaged Electron smoke; (4) Windows 11 interactive installer/application acceptance. A macOS pass proves only category 1. All other categories remain NOT VERIFIED without their own evidence. A Windows Server 2022 hosted-runner pass is not Windows 11 interactive acceptance.

See PHASE-1-REPORT.md for actual final counts, results and errors. There are no intentionally skipped tests or xfail markers. A platform-conditional command guard assertion is exercised on macOS; Windows guard behavior is also tested with explicit platform/architecture inputs.

## Phase 1.1 additions

`npm run test` retains the original Node, Python and 11-assertion Electron smoke suites, and additionally executes tests/terminal.test.mjs plus scripts/terminal-ui.mjs. There are five new Node checks covering view-state distinctions, minute/month semantics, resize bounds, absence of financial/preference storage APIs and server-rendered empty/loading/offline/backend/provider-error presentations. The server rendering test supplies state descriptions only, with no market data or mocked quotes.

The terminal Electron suite checks the compact layout, unclipped main-toolbar buttons, native minimum content size, sidebar collapse/pointer resize/keyboard controls, grid/cursor selection, focus restoration, disabled future controls, repeated canvas resizing, state reset on reload, empty local/session storage and IndexedDB, error-free console, and normal owned-child shutdown. Captures are actual Electron renderer screenshots at 1920×1080, 1536×864, 1366×768, native minimum content size, and narrow width with the watchlist explicitly expanded. Metrics are in reports/phase11/terminal-ui.json; these are viewport screenshots rather than Windows native-titlebar captures.

After `npm run build`, run `node scripts/terminal-ui.mjs` for the new UI suite alone. `node scripts/terminal-ui.mjs --packaged` is available only with a real native Windows unpacked package. No Windows execution is inferred from the Mac run. Renderer resize automation wall time is reported as an observation, not a frame-rate or Windows performance benchmark.
