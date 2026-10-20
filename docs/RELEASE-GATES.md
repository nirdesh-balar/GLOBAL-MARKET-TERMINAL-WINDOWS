# Release permission blockers

Phase 1 authorizes no official public binary release, auto-update feed or release asset. `publish: null` and builder publish=never remain mandatory.

Before any approved public release:

1. Obtain the owner's approval for the exact independent source manifest, repository visibility, application source license, branding and release candidate. Upstream MIT/third-party obligations remain independent of new source licensing.
2. Complete a real native Windows x64 Actions run, retain source SHA/run URL/reports and verify packaged EXE/NSIS sizes and digests. No Windows results may be inferred from Mac tests.
3. Resolve or explicitly review the packaging tool's moderate npm advisory, update dependency inventories, preserve exact-version licenses/notices (including Electron/Chromium), and review any distribution notices not shipped in package tarballs. In particular fancy-canvas 2.1.0 declares MIT but its tarball/registry metadata omit a full license text and repository provenance; obtain authoritative notice evidence before binary distribution. Lightweight Charts also documents incorporated tslib parts under BSD Zero Clause; review those embedded notices. The exact LWC v5.2.1 NOTICE (2025) and installed distribution header credit (2026) are both retained.
4. On Windows 11 x64 interactively verify per-user install/uninstall without elevation, clean launch/exit, crash/parent-exit behavior, profile isolation, display scaling, keyboard/accessibility and multiple local users. Observe real Defender/SmartScreen behavior without bypasses. Decide code-signing strategy; $0 unsigned development artifacts do not imply production trust/reputation.
5. Phase 2 implements a protected current-user/SYSTEM Windows profile with native owner/DACL and reparse inspection; retain actual native CI evidence and complete alternate-user/interactive Windows 11 acceptance before release. Do not use this as permission to persist application-owned user/market state. POSIX modes are not Windows proof. See PHASE-2-NATIVE-INTEGRATION.md for limits.
6. Before any market-provider integration, verify provider access/distribution permissions, terms, attribution, rate limits and data provenance using authoritative current sources. Yahoo/NSE/Hyperliquid rights from the reference are unresolved and not inherited. No code license grants market-data rights. Keep historical candles ephemeral; do not introduce a persistent history database or bundled demonstration OHLCV.
7. Retain the read-only product boundary: no broker login, accounts, wallets, trading, orders, ads, paid services or provider credentials. Larger capabilities require separately scoped, authorized work.

Phase 2 prerequisites are requirements for future planning, not authorization to start Phase 2. The full Windows product is not complete.
