import {_electron as electron} from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import {root} from "./common.mjs";
const packaged=process.argv.includes("--packaged");
if(packaged && process.platform !== "win32") throw Error("Native Windows packaged test required");
const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"gmt-win-smoke-")));
const fixture=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"gmt-native-fixture-")));
const valid=path.join(fixture,"selected.csv"), invalid=path.join(fixture,"bad.csv");
fs.writeFileSync(valid,"first,second\nalpha,beta\n");fs.writeFileSync(invalid,"first,second\n=CMD(),beta\n");
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.GMT_WINDOWS_DEV;
const config={args:[...(packaged?[]:[root]),"--gmt-smoke-root="+temporary],env,timeout:30000};
if(packaged) config.executablePath=path.join(root,"release/win-unpacked/GlobalMarketTerminalWindows.exe");
const checks=[];let app;let stage="launch";
const reportPath=path.join(root,"reports",packaged?"native-packaged.json":"native-development.json");
try {
  app=await electron.launch(config);const page=await app.firstWindow();
  await app.evaluate(({BrowserWindow})=>{globalThis.__keys=[];BrowserWindow.getAllWindows()[0].webContents.on("before-input-event",(_e,i)=>{if(i.type==="keyDown")globalThis.__keys.push({key:i.key,repeat:i.isAutoRepeat});});});
  await page.locator('[data-testid="service-status"][data-state="ready"]').waitFor({timeout:25000});
  const action=(op)=>page.evaluate(op=>window.terminal.window(op),op);
  const wait=async(key,value)=>{
    for(let i=0;i<100;i++) {const state=await action("state");if(state[key]===value && !state.transitioning)return state;await page.waitForTimeout(100);}
    throw Error("Window transition deadline: "+key);
  };
  stage="native controls";
  await page.evaluate(()=>{window.__events=[];window.__unsubscribe=window.terminal.onWindowState(state=>window.__events.push(state));});
  await action("minimize");await wait("minimized",true);
  await action("restore");await wait("minimized",false);
  await action("maximize");await wait("maximized",true);
  await action("toggleMaximize");await wait("maximized",false);
  await action("maximize");await wait("maximized",true);
  await action("restore");await wait("maximized",false);
  await action("focus");await wait("focused",true);
  checks.push("Actual BrowserWindow minimize, restore, maximize, toggle, focus and observed state events");
  await action("enterFullscreen");await wait("fullscreen",true);
  await action("exitFullscreen");await wait("fullscreen",false);
  await action("toggleFullscreen");await wait("fullscreen",true);
  await action("focus");await wait("focused",true);
  stage="Escape after repeated fullscreen transitions";
  await app.evaluate(({BrowserWindow})=>{const wc=BrowserWindow.getAllWindows()[0].webContents;wc.sendInputEvent({type:"keyDown",keyCode:"Escape"});wc.sendInputEvent({type:"keyUp",keyCode:"Escape"});});await wait("fullscreen",false);
  await app.evaluate(({BrowserWindow})=>{const wc=BrowserWindow.getAllWindows()[0].webContents;wc.sendInputEvent({type:"keyDown",keyCode:"F11"});wc.sendInputEvent({type:"keyUp",keyCode:"F11"});});await wait("fullscreen",true);
  await page.keyboard.press("F11");await wait("fullscreen",false);
  checks.push("Explicit fullscreen enter/exit/toggle plus F11 and Escape transitions");
  await page.setViewportSize({width:1366,height:768});
  await page.waitForFunction(()=>{const el=document.querySelector('[data-testid="empty-chart"]');return Number(el.dataset.chartWidth)===el.clientWidth && Number(el.dataset.chartHeight)===el.clientHeight;});
  const state=await action("state");assert.ok(state.width>0 && state.height>0);
  assert.ok((await page.evaluate(()=>window.__events.length))>0);
  await page.evaluate(()=>window.__unsubscribe());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  checks.push("Renderer layout and real canvas recover after native window transitions and resizing");
  await assert.rejects(page.evaluate(()=>window.terminal.window("loadURL")));
  stage="native IPC sender rejection";
  const rejected=await app.evaluate(async({BrowserWindow,app})=>{
    const w=new BrowserWindow({show:false,webPreferences:{preload:app.getAppPath()+"/dist-electron/preload.cjs",contextIsolation:true,sandbox:true,nodeIntegration:false}});
    try {await w.loadURL("data:text/html,<html>untrusted</html>");return await w.webContents.executeJavaScript("Promise.all([window.terminal.window('maximize').then(()=>false,()=>true),window.terminal.previewCsv().then(()=>false,()=>true)])");}
    finally {w.destroy();}
  });assert.deepEqual(rejected,[true,true]);
  checks.push("Untrusted renderer cannot control owning window or open native dialogs; arbitrary action rejected");
  stage="dialog API boundary and actual selected-file validation";
  await action("focus");await wait("focused",true);
  // API injection tests the main-side options, selected file, cancellation and
  // privacy boundary. Native picker interaction itself remains NOT VERIFIED.
  await app.evaluate(({dialog},file)=>{globalThis.__originalDialog=dialog.showOpenDialog;globalThis.__dialogCalls=[];dialog.showOpenDialog=async(owner,options)=>{globalThis.__dialogCalls.push({hasOwner:!!owner,options});return {canceled:false,filePaths:[file]};};},valid);
  const preview=await page.evaluate(()=>window.terminal.previewCsv());
  assert.deepEqual(preview,{cancelled:false,rows:2,columns:2,bytes:fs.statSync(valid).size});
  assert.ok(!JSON.stringify(preview).includes(fixture));assert.ok(!JSON.stringify(preview).includes("alpha"));
  const options=await app.evaluate(()=>globalThis.__dialogCalls[0]);
  assert.equal(options.hasOwner,true);assert.deepEqual(options.options.filters[0].extensions,["csv"]);assert.deepEqual(options.options.properties,["openFile","dontAddToRecent"]);
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},invalid);
  await assert.rejects(page.evaluate(()=>window.terminal.previewCsv()),error=>!String(error).includes(fixture));
  await app.evaluate(({dialog})=>{dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});});
  assert.deepEqual(await page.evaluate(()=>window.terminal.previewCsv()),{cancelled:true});
  await app.evaluate(({dialog})=>{dialog.showOpenDialog=globalThis.__originalDialog;});
  assert.equal(fs.readFileSync(valid,"utf8"),"first,second\nalpha,beta\n");
  checks.push("Owned native dialog API configured narrowly; real file preview returns counts only; cancellation/formula rejection; original dialog restored");
  const storage=await page.evaluate(async()=>({local:localStorage.length,session:sessionStorage.length,databases:(await indexedDB.databases()).length}));
  assert.deepEqual(storage,{local:0,session:0,databases:0});
  checks.push("No saved application state after native actions and CSV preview; no file content or path returned");
  await app.close();app=undefined;
  // Reopen with a fresh smoke profile; default bounds/session state must return.
  const next=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"gmt-win-smoke-")));
  config.args=[...(packaged?[]:[root]),"--gmt-smoke-root="+next];app=await electron.launch(config);const reopened=await app.firstWindow();
  await reopened.locator('[data-testid="service-status"][data-state="ready"]').waitFor({timeout:25000});
  const initial=await reopened.evaluate(()=>window.terminal.window("state"));assert.equal(initial.fullscreen,false);assert.equal(initial.maximized,false);
  await app.close();app=undefined;
  checks.push("Close and reopen starts a clean native window and authenticated owned backend; normal shutdown succeeds");
  if(process.platform === "win32") {
    // Use the real new stable Windows profile twice, without a smoke override.
    // The ephemeral CI user owns it; do not remove/migrate any existing profile.
    config.args=packaged?[]:[root];
    for(let attempt=0;attempt<2;attempt++) {
      app=await electron.launch(config);const normal=await app.firstWindow();
      await normal.locator('[data-testid="service-status"][data-state="ready"]').waitFor({timeout:25000});
      const s=await normal.evaluate(()=>window.terminal.window("state"));
      assert.equal(s.fullscreen,false);assert.equal(s.maximized,false);
      assert.deepEqual(await normal.evaluate(async()=>({local:localStorage.length,session:sessionStorage.length,databases:(await indexedDB.databases()).length})),{local:0,session:0,databases:0});
      await app.close();app=undefined;
    }
    checks.push("Actual stable Windows profile reopens after Chromium incidental files; native ACL revalidation and default memory-only state pass");
  }
  fs.writeFileSync(reportPath,JSON.stringify({result:"PASS",platform:process.platform,arch:process.arch,packaged,checks,checkCount:checks.length,nativePickerInteraction:"NOT VERIFIED: dialog API injected; filesystem validation real",interactiveWindows11:"NOT VERIFIED"},null,2));
  console.log({result:"PASS",checkCount:checks.length,platform:process.platform,packaged});
} catch(error) { const diagnostic=app ? await app.evaluate(({BrowserWindow})=>({keys:globalThis.__keys,fullscreen:BrowserWindow.getAllWindows()[0]?.isFullScreen(),focused:BrowserWindow.getAllWindows()[0]?.isFocused(),visible:BrowserWindow.getAllWindows()[0]?.isVisible(),minimized:BrowserWindow.getAllWindows()[0]?.isMinimized(),bounds:BrowserWindow.getAllWindows()[0]?.getBounds()})).catch(()=>null) : null;fs.writeFileSync(reportPath,JSON.stringify({result:"FAIL",stage,error:String(error),checks,diagnostic},null,2));throw error;}
finally {if(app)await app.close();}
