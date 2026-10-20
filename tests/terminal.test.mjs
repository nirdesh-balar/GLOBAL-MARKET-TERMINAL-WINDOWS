import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFileSync, readdirSync } from "node:fs";
const result = await build({
  entryPoints: ["desktop/src/terminalState.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const {
  marketState,
  stateDescription,
  intervalDescription,
  INTERVALS,
  sidebarWidth,
} = await import(
  "data:text/javascript;base64," +
    Buffer.from(result.outputFiles[0].text).toString("base64")
);
test("chart state distinguishes local startup/failure from offline market providers", () => {
  assert.equal(marketState({ state: "starting" }).kind, "loading");
  assert.equal(marketState({ state: "ready" }).kind, "offline");
  for (const state of ["failed", "stopped"])
    assert.deepEqual(marketState({ state }), {
      kind: "error",
      source: "backend",
    });
  assert.match(
    stateDescription({ kind: "error", source: "backend" }).title,
    /Local service/,
  );
  assert.match(
    stateDescription({ kind: "error", source: "provider" }).title,
    /Market provider/,
  );
  assert.match(stateDescription({ kind: "empty" }).detail, /empty/);
});
test("candle interval semantics preserve lowercase minutes and uppercase months", () => {
  assert.equal(INTERVALS.length, 9);
  assert.equal(intervalDescription["1m"], "one-minute candles");
  assert.equal(intervalDescription["1M"], "monthly candles");
  assert.equal(intervalDescription["1D"], "daily candles");
});
test("watchlist resize remains bounded after drag and keyboard extremes", () => {
  assert.equal(sidebarWidth(-1000), 280);
  assert.equal(sidebarWidth(9000), 420);
  assert.equal(sidebarWidth(339.6), 340);
});
test("renderer contains no permanent financial or preference persistence APIs", () => {
  for (const file of readdirSync("desktop/src").filter((name) =>
    /\.(tsx?|css)$/.test(name),
  ))
    assert.ok(
      !/localStorage|sessionStorage|indexedDB|sqlite|\.setData\(|\.addSeries\(/.test(
        readFileSync("desktop/src/" + file, "utf8"),
      ),
      file,
    );
});

import { mkdirSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { pathToFileURL } from "node:url";
import path from "node:path";
mkdirSync("work/phase11", { recursive: true });
await build({
  entryPoints: ["desktop/src/ChartWorkspace.tsx"],
  bundle: true,
  outfile: "work/phase11/chart-state.mjs",
  format: "esm",
  platform: "node",
  external: [
    "react",
    "react/jsx-runtime",
    "lightweight-charts",
    "lucide-react",
  ],
});
const { ChartWorkspace } = await import(
  pathToFileURL(path.resolve("work/phase11/chart-state.mjs")).href
);
test("chart renders honest empty/loading/offline and separate backend/provider error presentations", () => {
  for (const state of [
    { kind: "empty" },
    { kind: "loading" },
    { kind: "offline" },
    { kind: "error", source: "backend" },
    { kind: "error", source: "provider" },
  ]) {
    const html = renderToStaticMarkup(createElement(ChartWorkspace, { state }));
    const description = stateDescription(state);
    assert.ok(html.includes(description.title));
    assert.ok(
      html.includes(state.kind === "error" ? 'role="alert"' : 'role="status"'),
    );
    assert.ok(html.includes("No market timestamps available"));
    assert.ok(!/BTC|Yahoo|NSE|36\.14/.test(html));
  }
});
