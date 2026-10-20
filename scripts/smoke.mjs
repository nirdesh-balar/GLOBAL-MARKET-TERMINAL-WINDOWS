import { _electron as electron } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { root } from "./common.mjs";
const packaged = process.argv.includes("--packaged");
if (packaged && process.platform !== "win32")
  throw Error("Packaged acceptance requires native Windows");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "gmt-win-smoke-"));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.GMT_WINDOWS_DEV;
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
const assertions = [];
let stage = "launch";
const errors = [];
fs.mkdirSync(root + "/reports", { recursive: true });
try {
  app = await electron.launch(config);
  const page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  stage = "assets and empty workspace";
  await page
    .getByRole("heading", { name: "GLOBAL MARKET TERMINAL", exact: true })
    .waitFor();
  await page.locator('[data-chart-ready="true"] canvas').first().waitFor();
  assertions.push("production HTML, JavaScript, CSS and chart canvas load");
  stage = "authenticated local readiness";
  await page
    .locator('[data-testid="service-status"][data-state="ready"]')
    .waitFor({ timeout: 25000 });
  assert.ok(
    await page
      .getByText("Live market providers are not connected in Phase 1.")
      .isVisible(),
  );
  assertions.push("honest offline message");
  const health = await page.evaluate(() => window.terminal.health());
  assert.equal(health.providersConnected, false);
  assert.equal(health.marketHistoryStorage, "none");
  assertions.push(
    "real authenticated backend ready, providers false, no history",
  );
  stage = "renderer isolation";
  const shape = await page.evaluate(() => ({
    bridge: Object.keys(window.terminal).sort(),
    node: typeof window.require,
    process: typeof window.process,
    local: localStorage.length,
    session: sessionStorage.length,
  }));
  assert.deepEqual(shape, {
    bridge: ["health", "onWindowState", "openAttribution", "previewCsv", "status", "window"],
    node: "undefined",
    process: "undefined",
    local: 0,
    session: 0,
  });
  assertions.push(
    "renderer has no Node, runtime token, arbitrary IPC or web-storage secrets",
  );
  const prefs = await app.evaluate(({ BrowserWindow }) => {
    const p =
      BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return {
      contextIsolation: p.contextIsolation,
      nodeIntegration: p.nodeIntegration,
      sandbox: p.sandbox,
      webSecurity: p.webSecurity,
    };
  });
  assert.deepEqual(prefs, {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
  });
  assertions.push("actual Electron isolation preferences");
  stage = "network and popup rejection";
  assert.equal(
    await page.evaluate(async () => {
      try {
        await fetch("https://example.com");
        return false;
      } catch {
        return true;
      }
    }),
    true,
  );
  await page.evaluate(() => window.open("https://example.com"));
  assert.equal((await app.windows()).length, 1);
  assertions.push("renderer network and popups blocked");
  const before = page.url();
  await page.evaluate(() => {
    const a = document.createElement("a");
    a.href = "https://example.com";
    document.body.append(a);
    a.click();
    a.remove();
  });
  await page.waitForTimeout(150);
  assert.equal(page.url(), before);
  assertions.push("external navigation blocked");
  stage = "untrusted sender";
  const rejected = await app.evaluate(async ({ BrowserWindow, app }) => {
    const w = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: app.getAppPath() + "/dist-electron/preload.cjs",
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    try {
      await w.loadURL("data:text/html,<html>Untrusted</html>");
      return await w.webContents.executeJavaScript(
        "window.terminal.status().then(()=>false,()=>true)",
      );
    } finally {
      w.destroy();
    }
  });
  assert.equal(rejected, true);
  assertions.push("real IPC rejects untrusted window");
  stage = "responsive shell";
  await page.setViewportSize({ width: 840, height: 680 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  assertions.push("responsive shell fits narrow window");
  await page.setViewportSize({ width: 1440, height: 920 });
  await page.screenshot({
    path:
      root +
      "/reports/" +
      (packaged ? "windows-packaged" : "local-production") +
      ".png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  assertions.push("no renderer runtime errors");
  stage = "clean application shutdown";
  await app.close();
  app = undefined;
  assertions.push("application exits through owned backend shutdown");
  const report = {
    result: "PASS",
    platform: process.platform,
    arch: process.arch,
    packaged,
    assertions,
    assertionCount: assertions.length,
    interactiveWindows11: "NOT VERIFIED",
    installerExecution: "NOT VERIFIED",
  };
  fs.mkdirSync(root + "/reports", { recursive: true });
  fs.writeFileSync(
    root +
      "/reports/" +
      (packaged ? "packaged-smoke" : "local-smoke") +
      ".json",
    JSON.stringify(report, null, 2),
  );
  console.log(report);
} catch (error) {
  fs.mkdirSync(root + "/reports", { recursive: true });
  fs.writeFileSync(
    root +
      "/reports/" +
      (packaged ? "packaged-smoke" : "local-smoke") +
      ".json",
    JSON.stringify(
      { result: "FAIL", stage, message: String(error), assertions },
      null,
      2,
    ),
  );
  throw error;
} finally {
  if (app) await app.close();
}
