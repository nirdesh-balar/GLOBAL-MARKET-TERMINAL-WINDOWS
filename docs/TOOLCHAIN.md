# Pinned toolchain

Verified registry metadata on 2026-10-20; actual local runtime and test results are recorded in PHASE-1-REPORT.md. All direct npm versions are exact and the npm v3 lock includes transitive integrity hashes. Python's universal lock pins dependencies and wheel hashes, with platform markers for Windows/macOS packages. Installation uses `--require-hashes --only-binary=:all:`. No Mac native application dependencies are copied.

| Component | Version |
|---|---|
| Node | 22.23.3 |
| npm | 10.9.9 |
| Python | 3.11.17 |
| uv (provisioning / lock generation) | 0.13.3 |
| Electron | 44.9.1 |
| React / React DOM | 19.3.1 |
| TypeScript | 7.0.2 |
| Vite | 8.3.4 |
| @vitejs/plugin-react | 6.1.2 |
| Tailwind / @tailwindcss/vite | 4.3.3 |
| Lightweight Charts | 5.2.1 |
| Lucide React | 1.60.0 |
| esbuild | 0.28.2 |
| electron-builder | 26.15.3 |
| Playwright | 1.64.1 |
| @types/node | 22.19.0 |
| @types/react / @types/react-dom | 19.3.0 |
| FastAPI | 0.135.2 |
| Uvicorn | 0.41.0 |
| PyInstaller | 6.19.0 |
| pytest | 9.0.2 |
| httpx | 0.28.1 |

Node 22.19.0 was the evaluation starting point. The official [Node release index](https://nodejs.org/dist/index.json) lists later Node 22 security updates, including 22.23.2; 22.23.3 is the selected patched Node 22 version. Its macOS arm64 tarball was verified against the official SHA-256 list before execution. Node 22.23.3 meets Vite/plugin-react's >=22.12.0 requirement. The host's unrelated Node 24/Python 3.14 were not selected for this project. The Node runtime bundled in Electron is controlled by Electron, separately from the Node build runtime.

Python stays on 3.11. The [actions/python-versions manifest](https://github.com/actions/python-versions/blob/main/versions-manifest.json) has no Windows artifact for 3.11.17. Therefore a SHA-pinned `astral-sh/setup-uv` action provisions uv 0.13.3, followed by explicit managed Python 3.11.17 installation and pointer-width verification. This avoids silently selecting the old final official 3.11 Windows installer. Runtime downloads are normal public upstream artifacts with uv integrity verification; no paid services or application credentials are used.

Actions are pinned to immutable upstream tag SHAs: checkout v6, setup-node v6, setup-uv v10.3.0 and upload-artifact v6. Their internal Node runtime is separate from the project's pinned Node. Runner label is windows-2022; GitHub owns its changing image version, recorded for every run. An image label is not evidence of Windows 11 testing.

Installed transitive versions/notices: `THIRD_PARTY_NOTICES/*-inventory.json` and backend/requirements.lock. The notices generator inventories the build environment as well as runtime packages; presence there does not imply every build/test package is frozen into the backend.

Security review: npm audit initially returned eight moderate affected paths, all tracing to the single sprintf-js denial-of-service advisory [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) via electron-builder's logging/download dependencies. The registry has no patched sprintf-js release. No forced upgrade, unverified major override or audit suppression was applied. Runtime-only npm audit returned zero findings on this date. These results do not certify the entire dependency supply chain. Resolve or explicitly review the packaging-tool advisory before public binary approval. Deprecation warnings for transitive inflight, rimraf, glob and boolean are retained as maintenance findings. Starlette emits a testclient/httpx deprecation warning; current tests pass, and future migration needs a separately validated lock update.
