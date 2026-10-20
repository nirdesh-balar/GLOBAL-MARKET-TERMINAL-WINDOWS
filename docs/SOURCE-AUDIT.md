# Pinned Mac source baseline audit

Reference: [nirdesh-balar/GLOBAL-MARKET-TERMINAL](https://github.com/nirdesh-balar/GLOBAL-MARKET-TERMINAL/tree/2c6714489aa08dfdab60c007765b404efd6edb3d), exact commit `2c6714489aa08dfdab60c007765b404efd6edb3d`. Inspected on 2026-10-20 using read-only GitHub file fetches with that SHA as the explicit ref. No local Mac checkout was opened. File retrieval used actual source, not the GitHub landing page (which failed to load through web browsing). Reference snapshots remain outside the independent Windows repository and are not distributed with it.

## Confirmed source behavior

| Inspected file | Confirmed findings at the pinned SHA |
|---|---|
| package.json | Mac-only darwin/arm64 identity, version 1.0.0, Electron/Vite/React stack, native notification build, electron-updater, Mac package/public package scripts and GitHub publication configuration. These scripts/configuration were not copied. |
| desktop/electron/main.ts | Explicit Darwin/arm64 launch guard; separate stable/preview/development identities; preview migration/seed path selection; random main-process token; shell=false child spawn; dynamic loopback health handshake; main-frame/webContents checks; a large API route allowlist and multiple file/export/update/notification IPC capabilities. BrowserWindow isolation/sandbox/webSecurity enabled; popups/navigation and permissions denied. Some external links are allowlisted. Shutdown tracks owned backend. |
| desktop/electron/preload.ts | Broad typed bridge includes API requests, file imports/exports, window controls, updates, streams, alerts and permitted external links. Token is not exposed in that preload. Phase 1 Windows replaces it with three fixed operations. |
| desktop/electron/backendLifecycle.ts | Writes authenticated JSON shutdown to the exact child's stdin, waits seven seconds, then SIGTERM on the owned handle and waits two seconds. Never looks up a process by executable name. This control pattern informed a newly written Windows implementation. |
| desktop/electron/platform.ts | POSIX backend executable paths, Command+Control fullscreen accelerator, containment/export helpers and Mac test lease paths. Requires Windows executable/path/shortcut replacements. |
| desktop/src/App.tsx | Workspace, provider, watchlist, quote/stream, alert, screener, settings and drawing integration; polls health/workspace and saves workspace through the API. Not used as the Phase 1 Windows UI. |
| desktop/src/charts/ChartPane.tsx | Lightweight Charts creation with attributionLogo=true; provider/history request state and cancellation; drawing/indicator/replay integration; live/incremental merges; actual chart series population from returned rows. The Windows workspace creates no data series. |
| desktop/src/types.ts | Instrument/provider identity, OHLCV, workspace, drawings, indicator, update, stream, health and API contracts. Future portable schema candidates; not the small Phase 1 Windows health schema. |
| backend/app/main.py | Requires token of at least 32 characters; constant-time Bearer middleware on HTTP requests; disabled API docs; trusted hosts; body-size check; profile/database setup; service routes and startup catalogue refresh; graceful resource close in lifespan. |
| backend/launcher.py | Socket binds 127.0.0.1:0; readiness is printed before server.run; optional preview seed import; parent-lifetime watcher imported. Windows instead announces readiness after actual server startup and omits all seed logic. |
| backend/app/history.py | History/router/provider imports; memory caches, in-flight deduplication, request budgets, retry/cooldown, cancellation generations and ephemeral import behavior; provider failures are surfaced. No Windows provider implementation is imported. |
| backend/app/database.py | SQLite tables for settings, watchlists and instrument metadata. Drops legacy candle/cache tables, uses secure_delete, checkpoints/vacuums on detected historical legacy table, applies POSIX file chmod. These destructive migrations are never executed against existing user data by this project. |
| backend/app/profile_paths.py | Defaults to ~/Library/Application Support/GLOBAL MARKET TERMINAL. Never reused. |
| backend/app/profile_security.py | mkdir mode 0700 and chmod 0700; POSIX-only evidence, insufficient for Windows NTFS ACLs. |
| docs/BUILD.md | Apple Silicon Node 22.19.0/Python 3.11; native notification bridge; DMG/ZIP packaging, signing/notarization gates, separate candidate output and profile guards. |
| docs/TESTING.md | Large Mac feature/packaged suites; isolated temporary profiles; interactive live data, notification, signing/update gates remain separate from fixtures. Those claims are not treated as Windows evidence. |
| docs/LICENSE-AUDIT.md | Owner/source-manifest approval pending, third-party notice review, data rights separate from code licenses, public source excludes provider snapshots/user data; exact-version notice review remains a release gate. |
| LICENSE / NOTICE | Upstream MIT text credits Nirdesh Balar; NOTICE names TradingView Lightweight Charts and additional provider/calendar dependencies. MIT reference text is preserved separately; unused provider dependencies/notices were not represented as Windows runtime dependencies. |

## Portable logic candidates

Process ownership, constant-time authentication, sender/frame validation, ephemeral history cache concepts, cancellation and provider error contracts, chart lifecycle cleanup and data schemas can inform later work. This is a conceptual shortlist, not proof that all imported helpers are portable or audited. Indicators, drawing algorithms, providers, native bridges, parent_lifetime internals, updater validation and test guards were not comprehensively reviewed. No feature migration or wholesale source copying occurred.

## macOS replacements and security boundaries

Replace Darwin/arm64 startup guards with Windows-x64 packaged guards; POSIX interpreter/executable paths with Scripts/python.exe and a frozen .exe; Mac profile roots with a uniquely named AppData root; Command accelerators/titlebar/native notifications/Info.plist/plutil/DMG signing with separately designed Windows behavior. Omit preview profile migration, native Mac modules, updater feeds and provider code entirely in Phase 1. Electron owns credentials/processes, renderer has only explicit capabilities, backend is an authenticated local child. Windows inherited AppData permissions are a baseline only; NTFS DACL/reparse-point security is a Phase 2 requirement.

## Data flow and persistence

Reference renderer → preload → validated main API bridge → authenticated loopback FastAPI → read-only providers/history services → chart rows. Reference SQLite persists workspace/settings/watchlists/instrument metadata; inspected database code actively removes legacy history tables. Inspected history service uses bounded temporary memory caches rather than disk candle persistence. This is a finding about inspected code paths, not a forensic assertion about every possible profile, imported provider or external library. Windows Phase 1 has no provider layer, no database and no historical data at all; backend protocol and UI tests verify that baseline.

## Release blockers and recommendations

No upstream release permission, market-data redistribution permission, trust/signing result or Windows evidence transfers to this project. Confirm original-source rights and new-source licensing, maintain TradingView attribution and exact dependency notices, resolve/review supply-chain findings, run native Windows x64 CI, and separately perform Windows 11 interactive/security/installer acceptance. Keep the first workflow least privilege and development-artifact only. Never copy existing Mac profiles or run its database migration as part of Windows setup.

## Unverified findings

No whole-repository audit, Mac app execution, Windows execution, provider entitlement verification, native notification behavior, signing/SmartScreen acceptance, updater security validation or Windows DACL enforcement is claimed. Imported helpers not explicitly listed above were not invented or assumed accessible. The exact pinned ref was supplied to every file fetch; retrieved Git blob IDs are recorded in SOURCE-MANIFEST.json. There was no attempt to fetch a floating default branch or copy upstream Git history.
