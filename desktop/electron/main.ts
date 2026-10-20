import { app, BrowserWindow, ipcMain, Menu, dialog, shell } from "electron";
import { readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { Backend } from "./backend";
import { prepareProfile } from "./profile";
import { NATIVE_CHANNEL, WINDOW_EVENT, operateWindow, validateNative, windowState } from "./native";
import { validateCsvPath } from "./csv";
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
let profileBase = app.getPath("appData");
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
  profileBase = candidate;
  profile = path.join(candidate, "profile");
} else profile = profilePath(process.platform, app.getPath("appData"), root);
const backendCommand = backendExecutable(app.isPackaged ? process.resourcesPath : root, app.isPackaged);
const backendArgs = app.isPackaged ? [] : [path.join(root, "backend", "launcher.py")];
try { prepareProfile(backendCommand, backendArgs, profile, profileBase); }
catch {
  dialog.showErrorBox("GLOBAL MARKET TERMINAL", "Profile security validation failed. No profile was opened. Review the independent Windows profile permissions before restarting.");
  app.exit(1);
  throw Error("Profile security validation failed");
}
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
  let dialogPending = false;
  let windowPending = false;
  const performWindow = async (operation: Parameters<typeof operateWindow>[1]) => {
    if(operation === "state") return windowState(win);
    if(windowPending) throw Error("Window transition in progress");
    windowPending=true;
    try {return await operateWindow(win,operation);} finally {windowPending=false;publishState();}
  };
  let requestCount = 0, requestEpoch = Date.now();
  ipcMain.handle(NATIVE_CHANNEL, async (event, ...args: unknown[]) => {
    try {
      assertSender(event, win.webContents, expectedURL, event.senderFrame?.url ?? "");
      const operation = validateNative(args);
      if (Date.now() - requestEpoch >= 1000) { requestEpoch=Date.now(); requestCount=0; }
      if (++requestCount > 60) throw Error("Request limit");
      if (operation !== "previewCsv") return {ok:true,value:await performWindow(operation)};
      if (dialogPending || !win.isFocused() || !win.isVisible() || win.isMinimized()) throw Error("Dialog unavailable");
      dialogPending = true;
      try {
        const result = await dialog.showOpenDialog(win, {
          title:"Validate CSV structure — preview only; no import",
          properties:["openFile", "dontAddToRecent"], filters:[{name:"CSV (UTF-8, plain cells; maximum 64 KiB)",extensions:["csv"]}],
        });
        if (result.canceled) return {ok:true,value:{cancelled:true}};
        if (result.filePaths.length !== 1) throw Error("Invalid selection");
        let deadline: ReturnType<typeof setTimeout> | undefined;
        try {
          const value = await Promise.race([validateCsvPath(result.filePaths[0],{command:backendCommand,args:backendArgs}), new Promise<never>((_,reject) => { deadline=setTimeout(() => reject(Error("Selection timed out")),3000); })]);
          return {ok:true,value};
        } finally { clearTimeout(deadline); }
      } finally { dialogPending=false; }
    } catch { return {ok:false,error:"Native operation unavailable or selection rejected"}; }
  });
  const publishState = () => { if (!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(WINDOW_EVENT,windowState(win)); };
  win.on("minimize",publishState).on("restore",publishState).on("maximize",publishState).on("unmaximize",publishState).on("enter-full-screen",publishState).on("leave-full-screen",publishState).on("focus",publishState).on("blur",publishState).on("resize",publishState);
  win.webContents.on("before-input-event", (event,input) => {
    if (input.type !== "keyDown" || input.isAutoRepeat) return;
    if (input.key === "F11") { event.preventDefault(); void performWindow("toggleFullscreen").catch(() => {}); }
    else if (input.key === "Escape" && win.isFullScreen()) { event.preventDefault(); void performWindow("exitFullscreen").catch(() => {}); }
  });
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => {
    ipcMain.removeHandler(CHANNEL);
    ipcMain.removeHandler(NATIVE_CHANNEL);
    window = undefined;
  });
  if (dev) await win.loadURL(expectedURL);
  else await win.loadFile(path.join(root, "dist", "index.html"));
}
app
  .whenReady()
  .then(async () => {
    Menu.setApplicationMenu(null);
    backend = new Backend(backendCommand, backendArgs, profile);
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
