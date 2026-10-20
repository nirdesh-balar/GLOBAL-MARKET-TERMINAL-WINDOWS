> Current Phase 2 implementation: see [native integration design](docs/PHASE-2-NATIVE-INTEGRATION.md). The Phase 1/1.1 material below is historical where superseded.

# GLOBAL MARKET TERMINAL — Windows

Independent Windows 11 x64 desktop application, version **0.1.0**, Phase 1 only.
A compact read-only charting terminal shell with a real authenticated local backend and an intentionally empty Lightweight Charts workspace. Phase 1.1 adds the screenshot-inspired toolbars, drawing rail and resizable right watchlist; enabled view changes last only for the current session. Live providers, instruments, watchlists, trading, updates and market-history storage are absent.

Distribution target: unsigned NSIS **per-user EXE**, built only on native Windows x64. macOS Apple Silicon is a development preview host. No official release is authorized or published.

## Local Mac development

Install Node 22.23.3 (npm 10.9.9) and Python 3.11.17, then:

```sh
cd ~/Documents/Codex/GLOBAL-MARKET-TERMINAL-WINDOWS
nvm install
nvm use
export GMT_PYTHON="$(command -v python3.11)"
npm run setup
npm run dev
```

Close the window to exit Electron and its backend. Renderer edits reload through Vite; restart dev after main/preload edits.

```sh
npm run test
npm run build
npm run package:windows  # intentionally fails on macOS before any packaging
```

`setup` runs `npm ci`, installs/verifies the official Electron runtime, creates a separate Python venv and installs hash-locked wheels. It never removes an existing venv. See [Windows build](docs/WINDOWS-BUILD.md), [architecture](docs/ARCHITECTURE.md), [tests](docs/TESTING.md), [source audit](docs/SOURCE-AUDIT.md), and [release gates](docs/RELEASE-GATES.md).

Windows userData: `%APPDATA%\GlobalMarketTerminalWindows\Phase1`. Mac preview: this project's `.local-profile/mac-preview`. Neither path opens or migrates existing Mac app data. NTFS DACL hardening is a Phase 2 prerequisite; inherited ACLs are not claimed as verified isolation from other local users.

GitHub Actions uploads development artifacts only, with seven-day retention and no release publishing. Public repository creation needs the owner's explicit authorization. A public independent repository is preferred for standard hosted-runner free usage; private account quotas and current account terms must be checked before enabling paid usage. Do not enable paid runners or increase a spending budget.

New application source is `UNLICENSED` pending the owner's licensing decision. Third-party licenses remain in force; see NOTICE and THIRD_PARTY_NOTICES. Market-data distribution permissions remain unresolved and no provider is contacted.
