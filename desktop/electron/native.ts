import type { EventEmitter } from "node:events";
import { app, type BrowserWindow } from "electron";
import type { WindowAction, WindowState } from "../shared/contracts";
export const NATIVE_CHANNEL = "gmt:native";
export const WINDOW_EVENT = "gmt:window-state";
const transitions = new WeakSet<BrowserWindow>();
const actions = ["state", "minimize", "maximize", "restore", "toggleMaximize", "enterFullscreen", "exitFullscreen", "toggleFullscreen", "focus"] as const;
export function validateNative(args: unknown[]): WindowAction | "previewCsv" {
  if (args.length !== 1 || typeof args[0] !== "string" || args[0].length > 32 ||
      ![...actions, "previewCsv"].includes(args[0] as WindowAction)) throw Error("Operation not permitted");
  return args[0] as WindowAction | "previewCsv";
}
export function windowState(win: BrowserWindow): WindowState {
  const [width,height] = win.getContentSize();
  return { transitioning: transitions.has(win), minimized: win.isMinimized(), maximized: win.isMaximized(), fullscreen: win.isFullScreen(), focused: win.isFocused(), width, height };
}
export async function operateWindow(win: BrowserWindow, action: WindowAction) {
  if (!actions.includes(action)) throw Error("Operation not permitted");
  if (action === "minimize") win.minimize();
  else if (action === "maximize") win.maximize();
  else if (action === "restore") { if(win.isMinimized()) win.restore(); if(win.isMaximized()) win.unmaximize(); }
  else if (action === "toggleMaximize") win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (["enterFullscreen","exitFullscreen","toggleFullscreen"].includes(action)) {
    const target=action === "enterFullscreen" || (action === "toggleFullscreen" && !win.isFullScreen());
    if(win.isFullScreen() !== target) {
      transitions.add(win);
      try { await new Promise<void>((resolve,reject) => {
      const events=win as EventEmitter;
      const event=target ? "enter-full-screen" : "leave-full-screen";
      const done=() => { clearTimeout(timer); events.removeListener(event,done); resolve(); };
      const timer=setTimeout(() => {events.removeListener(event,done);reject(Error("Window transition timed out"));},5000);
      events.once(event,done);
      try {win.setFullScreen(target);} catch {clearTimeout(timer);events.removeListener(event,done);reject(Error("Window transition failed"));}
    }); } finally { transitions.delete(win); }
    }
  }
  else if (action === "focus") { if(win.isMinimized()) win.restore(); win.show(); win.moveTop(); if(process.platform === "darwin") app.focus({steal:true}); win.focus(); win.webContents.focus(); }
  return windowState(win);
}
