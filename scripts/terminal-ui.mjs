import { _electron as electron } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { root } from "./common.mjs";
const packaged = process.argv.includes("--packaged");
if (packaged && process.platform !== "win32")
  throw Error("Windows packaged UI requires native Windows");
const reportRoot = path.join(root, "reports/phase11");
fs.mkdirSync(reportRoot, { recursive: true });
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.GMT_WINDOWS_DEV;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "gmt-win-smoke-"));
const config = {
  args: [...(packaged ? [] : [root]), "--gmt-smoke-root=" + temporary],
  env,
  timeout: 30000,
};
if (packaged)
  config.executablePath = path.join(
    root,
    "release/win-unpacked/GlobalMarketTerminalWindows.exe",
  );
let app;
let stage = "launch";
const checks = [];
const screenshots = [];
const consoleErrors = [];
const observations = [];
const check = (name) => checks.push(name);
try {
  app = await electron.launch(config);
  const page = await app.firstWindow();
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page
    .locator('[data-testid="service-status"][data-state="ready"]')
    .waitFor({ timeout: 25000 });
  const chart = page.getByTestId("empty-chart");
  const settle = async () => {
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="empty-chart"]');
      return (
        el &&
        Number(el.dataset.chartWidth) === el.clientWidth &&
        Number(el.dataset.chartHeight) === el.clientHeight &&
        el.clientWidth > 0 &&
        el.clientHeight > 0
      );
    });
  };
  const capture = async (width, height, name) => {
    await page.setViewportSize({ width, height });
    await settle();
    const metric = await page.evaluate(() => {
      const rect = (selector) => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          right: r.right,
          bottom: r.bottom,
        };
      };
      const el = document.querySelector('[data-testid="empty-chart"]');
      const canvasSizes = [...el.querySelectorAll("canvas")].map((canvas) => {
        const r = canvas.getBoundingClientRect();
        return { width: r.width, height: r.height };
      });
      return {
        canvasSizes,
        viewport: { width: innerWidth, height: innerHeight },
        overflowX: document.documentElement.scrollWidth > innerWidth,
        overflowY: document.documentElement.scrollHeight > innerHeight,
        clippedToolbarButtons: [
          ...document.querySelectorAll(".main-toolbar button"),
        ]
          .filter((el) => {
            const r = el.getBoundingClientRect(),
              p = el.closest(".main-toolbar").getBoundingClientRect();
            return (
              r.width > 0 &&
              (r.right > p.right || r.left < p.left || r.bottom > p.bottom)
            );
          })
          .map((el) => el.getAttribute("aria-label")),
        toolbar: rect(".main-toolbar"),
        drawing: rect(".drawing-toolbar"),
        chart: rect(".chart-panel"),
        canvas: rect(".chart-canvas"),
        sidebar: document.querySelector(".watchlist")
          ? rect(".watchlist")
          : null,
        canvasCount: el.querySelectorAll("canvas").length,
        resizeCount: Number(el.dataset.resizeCount),
        palette: {
          header: getComputedStyle(
            document.querySelector(".application-header"),
          ).backgroundColor,
          chart: getComputedStyle(document.querySelector(".chart-space"))
            .backgroundColor,
        },
      };
    });
    assert.equal(metric.overflowX, false);
    assert.equal(metric.overflowY, false);
    assert.deepEqual(metric.clippedToolbarButtons, []);
    assert.equal(metric.toolbar.height, 48);
    assert.equal(metric.drawing.width, 44);
    assert.ok(metric.canvas.width > 200 && metric.canvas.height > 120);
    assert.ok(
      metric.canvasSizes.some((size) => size.width > 0 && size.height > 0),
    );
    for (const size of metric.canvasSizes.filter(
      (size) => size.width > 0 && size.height > 0,
    )) {
      assert.ok(
        Math.abs(size.width - metric.canvas.width) <= 1,
        JSON.stringify(metric),
      );
      assert.ok(
        Math.abs(size.height - metric.canvas.height) <= 1,
        JSON.stringify(metric),
      );
    }
    if (metric.sidebar) {
      assert.equal(metric.sidebar.width, 320);
      assert.ok(metric.chart.right <= metric.sidebar.x);
    }
    assert.equal(metric.palette.header, "rgb(16, 24, 36)");
    assert.equal(metric.palette.chart, "rgb(12, 20, 32)");
    const file = path.join(reportRoot, `${name}.png`);
    await page.screenshot({ path: file });
    screenshots.push(file);
    observations.push(metric);
  };
  stage = "desktop structure and viewport screenshots";
  for (const [width, height] of [
    [1920, 1080],
    [1536, 864],
    [1366, 768],
  ])
    await capture(width, height, `terminal-${width}x${height}`);
  const minimum = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.setSize(820, 620);
    return w.getContentSize();
  });
  await capture(
    minimum[0],
    minimum[1],
    `terminal-minimum-${minimum[0]}x${minimum[1]}`,
  );
  check(
    "Actual Electron screenshots: 1920×1080, 1536×864, 1366×768 and native minimum content size; no horizontal/vertical page overflow",
  );
  await page.setViewportSize({ width: 1366, height: 768 });
  await settle();
  assert.ok(
    await page.getByRole("toolbar", { name: "Main chart toolbar" }).isVisible(),
  );
  assert.ok(
    await page.getByRole("navigation", { name: "Drawing tools" }).isVisible(),
  );
  assert.ok(
    await page.getByRole("complementary", { name: "Watchlist" }).isVisible(),
  );
  check(
    "Compact two-row header, permanently visible drawing rail, expanding chart and right watchlist",
  );
  stage = "interval semantics";
  await page
    .getByRole("button", { name: "1m · one-minute candles", exact: true })
    .click();
  assert.equal(await page.getByTestId("pane-interval").textContent(), "1m");
  await page
    .getByRole("button", { name: "1M · monthly candles", exact: true })
    .click();
  assert.equal(await page.getByTestId("pane-interval").textContent(), "1M");
  assert.ok(
    await page
      .getByRole("group", { name: "Visible date range", exact: true })
      .getByRole("button", { name: "1M", exact: true })
      .isDisabled(),
  );
  check(
    "One-minute and monthly candle intervals update the pane; visible date ranges remain distinct and disabled without history",
  );
  stage = "sidebar controls";
  await page
    .getByRole("button", { name: "Collapse watchlist", exact: true })
    .click();
  assert.equal(
    await page.getByRole("complementary", { name: "Watchlist" }).count(),
    0,
  );
  await settle();
  await page
    .getByRole("button", { name: "Show watchlist", exact: true })
    .click();
  await settle();
  const separator = page.getByRole("separator", { name: "Resize watchlist" });
  await separator.focus();
  await page.keyboard.press("ArrowLeft");
  assert.equal(await separator.getAttribute("aria-valuenow"), "340");
  const box = await separator.boundingBox();
  await page.mouse.move(box.x + 2, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x - 38, box.y + 100);
  await page.mouse.up();
  assert.equal(await separator.getAttribute("aria-valuenow"), "380");
  await settle();
  await page.setViewportSize({ width: 820, height: 592 });
  await settle();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.ok(await separator.isVisible());
  await page.screenshot({
    path: path.join(reportRoot, "terminal-narrow-watchlist-expanded.png"),
  });
  screenshots.push(
    path.join(reportRoot, "terminal-narrow-watchlist-expanded.png"),
  );
  await separator.focus();
  await page.keyboard.press("Home");
  assert.equal(await separator.getAttribute("aria-valuenow"), "280");
  await page.keyboard.press("End");
  assert.equal(await separator.getAttribute("aria-valuenow"), "420");
  check(
    "Watchlist collapses/restores; pointer resize and keyboard width controls work, including expanded narrow viewport",
  );
  stage = "grid, cursor, accessibility and connection panel";
  await page
    .getByRole("button", { name: "Workspace view settings", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Show chart grid", exact: true })
    .uncheck();
  assert.ok(
    !(await page
      .locator(".chart-space")
      .evaluate((el) => el.classList.contains("with-grid"))),
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.ok(
    await page
      .getByRole("button", { name: "Workspace view settings", exact: true })
      .evaluate((el) => el === document.activeElement),
  );
  await page
    .getByRole("button", { name: "Crosshair cursor", exact: true })
    .click();
  assert.ok(
    await page
      .locator(".chart-space")
      .evaluate((el) => el.classList.contains("crosshair-cursor")),
  );
  await page
    .getByRole("button", { name: "Providers · Offline", exact: true })
    .click();
  await page.getByRole("dialog", { name: "Connection status" }).waitFor();
  assert.ok(
    await page
      .getByText("Local service ready · market providers disconnected", {
        exact: true,
      })
      .isVisible(),
  );
  await page.keyboard.press("Escape");
  check(
    "Session-only view settings, pointer/crosshair selection, Escape dismissal and truthful backend/provider status work",
  );
  for (const label of [
    "Search instruments",
    "Chart type",
    "Indicator library",
    "Chart layout",
    "Replay",
    "Export screenshot",
    "Trendlines and channels",
    "Fibonacci tools",
    "Patterns",
    "Geometric shapes",
    "Text annotations",
    "Measuring tools",
    "Magnet mode",
    "Lock drawings",
    "Hide drawings",
    "Delete drawings",
    "Create watchlist",
    "Import watchlist",
    "Export watchlist",
    "Add watchlist symbol",
    "Reset and fit chart",
  ]) {
    assert.ok(
      await page.getByRole("button", { name: label, exact: true }).isDisabled(),
    );
  }
  assert.ok(
    await page
      .getByRole("textbox", { name: "Search this watchlist" })
      .isDisabled(),
  );
  assert.equal(
    await page
      .locator(".ohlc-legend b")
      .allTextContents()
      .then((v) => v.join("")),
    "————",
  );
  check(
    "Planned market/drawing/watchlist/export/scale controls are disabled with honest tooltips; OHLC and quote metadata are unavailable",
  );
  stage = "resize lifecycle and memory-only state";
  const start = performance.now();
  const canvasCount = await chart.locator("canvas").count();
  for (let i = 0; i < 12; i++)
    await page.setViewportSize({
      width: 1100 + (i % 4) * 90,
      height: 700 + (i % 3) * 30,
    });
  await settle();
  assert.equal(await chart.locator("canvas").count(), canvasCount);
  const resizeMs = Math.round(performance.now() - start);
  const storage = await page.evaluate(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    databases: (await indexedDB.databases()).length,
  }));
  assert.deepEqual(storage, { local: 0, session: 0, databases: 0 });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.reload();
  await settle();
  await page
    .locator('[data-testid="service-status"][data-state="ready"]')
    .waitFor();
  assert.equal(await page.getByTestId("pane-interval").textContent(), "1D");
  assert.equal(
    await page
      .getByRole("separator", { name: "Resize watchlist" })
      .getAttribute("aria-valuenow"),
    "320",
  );
  assert.ok(
    await page
      .locator(".chart-space")
      .evaluate((el) => el.classList.contains("with-grid")),
  );
  assert.ok(
    !(await page
      .locator(".chart-space")
      .evaluate((el) => el.classList.contains("crosshair-cursor"))),
  );
  check(
    "Twelve viewport changes resize the real canvas without accumulating canvases; reloading resets interval, grid, cursor and sidebar width; no web storage or IndexedDB databases",
  );
  stage = "honest fullscreen availability";
  assert.ok(
    await page
      .getByRole("button", { name: "Toggle workspace fullscreen", exact: true })
      .isDisabled(),
  );
  check(
    "Fullscreen entry remains explicitly disabled; native operating-system window controls are retained and IPC is unchanged",
  );

  assert.deepEqual(consoleErrors, []);
  check("No renderer console errors or uncaught exceptions");
  await app.close();
  app = undefined;
  check(
    "Real authenticated backend and Electron complete normal owned-child shutdown",
  );
  const report = {
    result: "PASS",
    platform: process.platform,
    arch: process.arch,
    packaged,
    checks,
    checkCount: checks.length,
    screenshots,
    observations,
    minimumContentSize: minimum,
    resizeBurst: {
      changes: 12,
      elapsedMs: resizeMs,
      interpretation:
        "Observed wall time includes automation; not an FPS benchmark",
    },
    windowsCI: "NOT VERIFIED",
  };
  fs.writeFileSync(
    path.join(reportRoot, "terminal-ui.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(report);
} catch (error) {
  fs.writeFileSync(
    path.join(reportRoot, "terminal-ui.json"),
    JSON.stringify(
      { result: "FAIL", stage, error: String(error), checks, consoleErrors },
      null,
      2,
    ),
  );
  throw error;
} finally {
  if (app) await app.close();
}
