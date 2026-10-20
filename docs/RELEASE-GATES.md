# Release permission blockers

Phase 1 authorizes no official public binary release, auto-update feed or release asset. `publish: null` and builder publish=never remain mandatory.

Before any approved public release:

1. Obtain the owner's approval for the exact independent source manifest, repository visibility, application source license, branding and release candidate. Upstream MIT/third-party obligations remain independent of new source licensing.
2. Complete a real native Windows x64 Actions run, retain source SHA/run URL/reports and verify packaged EXE/NSIS sizes and digests. No Windows results may be inferred from Mac tests.
3. Resolve or explicitly review the packaging tool's moderate npm advisory, update dependency inventories, preserve exact-version licenses/notices (including Electron/Chromium), and review any distribution notices not shipped in package tarballs.
4. On Windows 11 x64 interactively verify per-user install/uninstall without elevation, clean launch/exit, crash/parent-exit behavior, profile isolation, display scaling, keyboard/accessibility and multiple local users. Observe real Defender/SmartScreen behavior without bypasses. Decide code-signing strategy; $0 unsigned development artifacts do not imply production trust/reputation.
5. Implement and independently test Windows NTFS DACL enforcement and reparse-point defense before storing any meaningful private user content. POSIX mode bits are not Windows proof. Phase 1 uses only an independently named AppData baseline.
6. Before any market-provider integration, verify provider access/distribution permissions, terms, attribution, rate limits and data provenance using authoritative current sources. Yahoo/NSE/Hyperliquid rights from the reference are unresolved and not inherited. No code license grants market-data rights. Keep historical candles ephemeral; do not introduce a persistent history database or bundled demonstration OHLCV.
7. Retain the read-only product boundary: no broker login, accounts, wallets, trading, orders, ads, paid services or provider credentials. Larger capabilities require separately scoped, authorized work.

Phase 2 prerequisites are requirements for future planning, not authorization to start Phase 2. The full Windows product is not complete.
