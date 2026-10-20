import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
test("production HTML has relative existing assets and offline CSP", () => {
  const html = fs.readFileSync("dist/index.html", "utf8");
  assert.ok(html.includes("connect-src 'none'"));
  assert.ok(!html.includes("unsafe-inline"));
  const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map(
    (m) => m[1],
  );
  assert.ok(assets.length >= 2);
  for (const asset of assets)
    assert.ok(fs.statSync(path.join("dist", asset)).isFile());
});
test("empty chart implementation has no series or demonstration market data", () => {
  const chart = fs.readFileSync("desktop/src/ChartWorkspace.tsx", "utf8");
  assert.ok(chart.includes("createChart("));
  assert.ok(!/\.addSeries|\.setData|\.update\(/.test(chart));
  const app = fs.readFileSync("desktop/src/App.tsx", "utf8");
  assert.ok(app.includes("https://www.tradingview.com/"));
  const backend = fs.readFileSync("backend/app/main.py", "utf8");
  assert.ok(!/sqlite|yfinance|OHLCV|open\(/.test(backend));
  assert.ok(backend.includes('"marketHistoryStorage": "none"'));
});
test(process.platform === "win32" ? "native Windows runner satisfies the x64 packaging precondition" : "non-Windows packaging fails before touching outputs", () => {
  if (process.platform === "win32") { assert.equal(process.arch, "x64"); return; }
  const result = spawnSync(process.execPath, ["scripts/package-windows.mjs"], {
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /native Windows x64 runner/);
  assert.ok(!fs.existsSync("release"));
});
