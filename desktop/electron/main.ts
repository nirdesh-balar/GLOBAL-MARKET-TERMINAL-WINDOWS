import { app, BrowserWindow, ipcMain, Menu, dialog, shell } from "electron";
import { mkdirSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { Backend } from "./backend";
import { backendExecutable, profilePath } from "./platform";
import {
  CHANNEL,
  assertSender,
  packagedCSP,
  validateOperation,
} from "./security";

const root = path.join(__dirname, "..");
const dev = !app.isPackaged && process.env.GMT_WINDOWS_DEV === "1";
if (
  (app.isPackaged &&
    (process.platform !== "win32" || process.arch !== "x64")) ||
  (!app.isPackaged && !["win32", "darwin"].includes(process.platform))
)
  throw Error(
    "Windows x64 application; macOS is a development preview host only",
  );
app.setName("GLOBAL MARKET TERMINAL");
const smokeArg = process.argv.find((a) => a.startsWith("--gmt-smoke-root="));
let profile: string;
if (smokeArg) {
  const candidate = realpathSync(smokeArg.slice("--gmt-smoke-root=".length));
  const relative = path.relative(realpathSync(os.tmpdir()), candidate);
  if (
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !path.basename(candidate).startsWith("gmt-win-smoke-") ||
    readdirSync(candidate).length
  )
    throw Error("Smoke profile must be a new empty temporary test directory");
  profile = path.join(candidate, "profile");
} else profile = profilePath(process.platform, app.getPath("appData"), root);
mkdirSync(profile, { recursive: true });
app.setPath("userData", profile);
app.setPath("sessionData", path.join(profile, "session"));
// No cookies/cache/history are needed for this offline shell.
app.commandLine.appendSwitch("disable-http-cache");
let window: BrowserWindow | undefined;
let backend: Backend | undefined;
let quitting = false;
let finished = false;
let timer: ReturnType<typeof setInterval> | undefined;
const expectedURL = dev
  ? "http://127.0.0.1:5173/"
  : pathToFileURL(path.join(root, "dist", "index.html")).href;

async function openWindow() {
  const win = (window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 820,
    minHeight: 620,
    title: "GLOBAL MARKET TERMINAL",
    backgroundColor: "#0b1017",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      spellcheck: false,
      partition: "gmt-windows-memory",
    },
  }));
  const session = win.webContents.session;
  session.setPermissionRequestHandler((_w, _p, cb) => cb(false));
  session.setPermissionCheckHandler(() => false);
  session.on("will-download", (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.webContents.on("will-redirect", (event) => event.preventDefault());
  win.webContents.on("will-attach-webview", (event) => event.preventDefault());
  session.webRequest.onBeforeRequest((details, cb) => {
    const url = details.url;
    const permitted = dev
      ? url.startsWith("http://127.0.0.1:5173/") ||
        url.startsWith("ws://127.0.0.1:5173/")
      : url.startsWith(pathToFileURL(path.join(root, "dist") + path.sep).href);
    cb({ cancel: !permitted });
  });
  if (!dev)
    session.webRequest.onHeadersReceived((details, cb) =>
      cb({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [packagedCSP],
        },
      }),
    );
  ipcMain.handle(CHANNEL, async (event, ...args: unknown[]) => {
    assertSender(
      event,
      win.webContents,
      expectedURL,
      event.senderFrame?.url ?? "",
    );
    const operation = validateOperation(args);
    if (operation === "attribution") {
      await shell.openExternal("https://www.tradingview.com/");
      return;
    }
    if (!backend) throw Error("Local service unavailable");
    return operation === "status" ? backend.status() : backend.health();
  });
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => {
    window = undefined;
  });
  if (dev) await win.loadURL(expectedURL);
  else await win.loadFile(path.join(root, "dist", "index.html"));
}
app
  .whenReady()
  .then(async () => {
    Menu.setApplicationMenu(null);
    const command = backendExecutable(
      app.isPackaged ? process.resourcesPath : root,
      app.isPackaged,
    );
    backend = new Backend(
      command,
      app.isPackaged ? [] : [path.join(root, "backend", "launcher.py")],
      profile,
    );
    // The shell remains visible on startup failure, displaying a truthful failed status.
    const startup = backend.start().catch(() => {});
    await openWindow();
    await startup;
    timer = setInterval(() => {
      if (backend?.status().state === "ready")
        void backend.health().catch(() => {});
    }, 4000);
  })
  .catch(() => {
    dialog.showErrorBox(
      "GLOBAL MARKET TERMINAL",
      "Application startup failed. Run setup and build, then restart.",
    );
    app.quit();
  });
app.on("window-all-closed", () => app.quit());
app.on("before-quit", (event) => {
  if (finished) return;
  event.preventDefault();
  if (quitting) return;
  quitting = true;
  clearInterval(timer);
  void (backend?.stop() ?? Promise.resolve())
    .catch(() => {
      dialog.showErrorBox(
        "GLOBAL MARKET TERMINAL",
        "The owned local service did not confirm shutdown within the deadline.",
      );
      process.exitCode = 1;
    })
    .finally(() => {
      finished = true;
      app.quit();
    });
});
