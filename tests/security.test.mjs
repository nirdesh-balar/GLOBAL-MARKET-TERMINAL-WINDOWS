import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  validateOperation,
  assertSender,
  packagedCSP,
} = require("../dist-electron/security.cjs");
const {
  backendExecutable,
  profilePath,
  assertWindowsPackaging,
} = require("../dist-electron/platform.cjs");
test("IPC permits fixed health, status and attribution operations", () => {
  assert.equal(validateOperation(["attribution"]), "attribution");
  assert.equal(validateOperation(["health"]), "health");
  assert.equal(validateOperation(["status"]), "status");
});
test("IPC rejects malformed inputs and arbitrary operations", () => {
  for (const a of [
    [],
    ["health", "extra"],
    ["GET", "/health"],
    ["http://example.com"],
    ["shutdown"],
    ["__proto__"],
    [{}],
    [null],
    [["health"]],
    [42],
  ])
    assert.throws(() => validateOperation(a));
});
test("IPC requires the exact owner, main frame and expected document URL", () => {
  const wc = { mainFrame: {} };
  const e = { sender: wc, senderFrame: wc.mainFrame };
  assert.doesNotThrow(() =>
    assertSender(e, wc, "file:///index", "file:///index"),
  );
  for (const v of [
    { ...e, sender: {} },
    { ...e, senderFrame: {} },
    { ...e, senderFrame: null },
  ])
    assert.throws(() => assertSender(v, wc, "a", "a"));
  assert.throws(() => assertSender(e, wc, "a", "b"));
});
test("preload exposes precisely the reviewed fixed operations without Node or token access", async () => {
  let exposed;
  const calls = [];
  const fakeElectron = {
    contextBridge: {
      exposeInMainWorld: (name, value) => {
        assert.equal(name, "terminal");
        exposed = value;
      },
    },
    ipcRenderer: {
      invoke: async (...args) => {
        calls.push(args);
        return {};
      },
    },
  };
  vm.runInNewContext(fs.readFileSync("dist-electron/preload.cjs", "utf8"), {
    setTimeout, clearTimeout,
    require: (name) => {
      assert.equal(name, "electron");
      return fakeElectron;
    },
  });
  assert.deepEqual(Object.keys(exposed).sort(), [
    "health",
    "onWindowState",
    "openAttribution",
    "previewCsv",
    "status",
    "window",
  ]);
  await exposed.health("/arbitrary", "secret");
  await exposed.status();
  await exposed.openAttribution("https://evil.example");
  assert.deepEqual(calls, [
    ["gmt:read", "health"],
    ["gmt:read", "status"],
    ["gmt:read", "attribution"],
  ]);
  assert.ok(Object.isFrozen(exposed));
});
test("production CSP blocks renderer network, frames and inline scripts", () => {
  for (const text of [
    "default-src 'none'",
    "connect-src 'none'",
    "frame-src 'none'",
    "script-src 'self'",
    "frame-ancestors 'none'",
  ])
    assert.ok(packagedCSP.includes(text));
  assert.ok(!packagedCSP.includes("unsafe-eval"));
  assert.ok(!packagedCSP.includes("unsafe-inline"));
});
test("Windows paths resolve .exe and Scripts without POSIX assumptions", () => {
  assert.equal(
    backendExecutable("C:\\app", true, "win32"),
    "C:\\app\\backend\\gmt-windows-backend.exe",
  );
  assert.equal(
    backendExecutable("C:\\repo", false, "win32"),
    "C:\\repo\\backend\\.venv\\Scripts\\python.exe",
  );
});
test("Mac preview paths remain separate from existing Mac profiles", () => {
  assert.equal(
    profilePath("darwin", "/ignored", "/new/repo"),
    "/new/repo/.local-profile/mac-preview",
  );
  assert.equal(
    profilePath("win32", "C:\\Users\\test\\AppData\\Roaming", "unused"),
    "C:\\Users\\test\\AppData\\Roaming\\GlobalMarketTerminalWindows.Native\\Desktop",
  );
  assert.throws(() => profilePath("linux", "x", "y"));
});
test("packaging guards reject macOS, Linux and Windows ARM64", () => {
  for (const [p, a] of [
    ["darwin", "arm64"],
    ["linux", "x64"],
    ["win32", "arm64"],
  ])
    assert.throws(() => assertWindowsPackaging(p, a));
  assert.doesNotThrow(() => assertWindowsPackaging("win32", "x64"));
});

test("native preload validates actions and events, removes listeners, and serializes errors without secrets", async () => {
  let bridge, callback, removed=false;const calls=[];
  const state={transitioning:false,minimized:false,maximized:false,fullscreen:false,focused:true,width:820,height:620};
  const fake={contextBridge:{exposeInMainWorld:(_name,value)=>{bridge=value;}},ipcRenderer:{
    invoke:async(channel,op)=>{calls.push([channel,op]);if(op==='previewCsv')throw Error('private-path-and-token-must-not-escape');return {ok:true,value:state};},
    on:(name,fn)=>{assert.equal(name,'gmt:window-state');callback=fn;},
    removeListener:(name,fn)=>{assert.equal(name,'gmt:window-state');assert.equal(fn,callback);removed=true;},
  }};
  vm.runInNewContext(fs.readFileSync('dist-electron/preload.cjs','utf8'),{require:name=>{assert.equal(name,'electron');return fake;},setTimeout,clearTimeout});
  assert.deepEqual(JSON.parse(JSON.stringify(await bridge.window('state'))),state);
  await assert.rejects(bridge.window('http://localhost'));
  assert.equal(calls.length,1);
  const received=[];const unsubscribe=bridge.onWindowState(value=>received.push(value));
  callback({secret:'never exposed'},{...state,width:NaN});callback({secret:'never exposed'},state);
  assert.equal(received.length,1);assert.deepEqual(JSON.parse(JSON.stringify(received[0])),state);
  unsubscribe();assert.equal(removed,true);
  await assert.rejects(bridge.previewCsv(),error=>!String(error).includes('private-path-and-token'));
});
