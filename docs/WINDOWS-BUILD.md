# Windows builds and remote setup

Use Node 22.23.3/npm 10.9.9 and native Python 3.11.17 x64. On a fresh Windows checkout, set `GMT_PYTHON` to that exact Python executable and run:

```powershell
npm run setup
npm run test
npm run build
node scripts/notices.mjs
npm run package:windows
npm run test:packaged
```

`package:windows` rejects macOS, Linux and Windows ARM64 before changing output. It also rejects an existing release/backend dist/build directory. Preserve previous outputs and use a fresh independent checkout for another candidate; never delete an existing directory as a build workaround. It freezes the local service with PyInstaller, tests the actual frozen exe, builds both the Electron directory package and NSIS, verifies expected files and writes SHA-256 hashes. No release is published. No signing credentials are requested. The EXE is an unsigned development candidate; standard Windows security remains enabled.

Expected outputs (not evidence that they have been generated):

- `release/GMT-Windows-0.1.0-dev-x64-Setup.exe`
- `release/win-unpacked/GlobalMarketTerminalWindows.exe`
- `release/win-unpacked/resources/backend/gmt-windows-backend.exe`
- `release/SHA256SUMS.txt`
- `reports/artifacts.json`, frozen-backend.xml and packaged-smoke.json

NSIS uses a distinct app ID `io.github.nirdeshbalar.globalmarketterminal.windows.phase1`, assisted install, perMachine=false, allowElevation=false and a per-user installation. It preserves AppData on uninstall. Actual installer wizard, install-path permissions, uninstall behavior and downloaded-file security prompts need Windows 11 interactive acceptance. Never bypass Defender, SmartScreen or code-signing checks.

## Independent GitHub repository

The owner approved this exact public repository creation/push operation in chat on 2026-10-20:

```sh
cd ~/Documents/Codex/GLOBAL-MARKET-TERMINAL-WINDOWS
gh repo create nirdesh-balar/GLOBAL-MARKET-TERMINAL-WINDOWS --public --source=. --remote=origin --push
```

First inspect `git status`, `git log --oneline --max-count=3`, `git remote -v`, and `git ls-files`. Confirm this is the Windows repository and no read-only source snapshot, credentials, user profile, node_modules or build output is tracked. Never run these write operations from the original Mac checkout. Use only an already authenticated, owner-approved GitHub session; do not request, paste or print credentials. GitHub CLI was initially absent. Official CLI 2.102.0 was subsequently installed only in the chat scratch directory and verified against its official checksum. Its authentication check reported no authenticated hosts; the available browser also required sign-in. Owner approval is recorded, but successful local authentication is still required before the approved operation can run. After the owner confirmed sign-in, the exact approved creation/push command was attempted with prompts disabled and failed with exit 4 (GitHub CLI requires authentication). No remote was created or pushed. Local authentication in another session cannot be assumed to transfer to this task. Do not share a token; run the command from an already authenticated owner session.

A public independent repository is preferred for standard hosted-runner free usage. Preserve the account owner's repository write permissions and any organization policies. Check current Actions billing/quotas before using private repository minutes. Do not enable paid services.

After authorized creation/push, open Actions → Windows Phase 1 development candidate, or:

```sh
gh run list --repo nirdesh-balar/GLOBAL-MARKET-TERMINAL-WINDOWS --workflow windows-ci.yml
gh run view RUN_ID --repo nirdesh-balar/GLOBAL-MARKET-TERMINAL-WINDOWS
gh run download RUN_ID --repo nirdesh-balar/GLOBAL-MARKET-TERMINAL-WINDOWS --dir ./work/windows-run-RUN_ID
```

Record the real run URL, commit SHA, conclusion, installer byte size and digest from reports/artifacts.json. Expected artifact names are `gmt-windows-phase1-reports-SHA` and `gmt-windows-phase1-unsigned-x64-SHA`; they have seven-day retention. A failed required step fails the job; reports upload with always(), while installer upload requires success. There is no continue-on-error or fake success for GUI failures. If hosted GUI automation fails, document its exact failing stage and mark it NOT VERIFIED; do not reinterpret it as a pass. Installer execution and Windows 11 interactive acceptance are always explicitly marked NOT VERIFIED until directly observed.
