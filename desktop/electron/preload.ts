import { contextBridge, ipcRenderer } from "electron";
import type { TerminalBridge, WindowState, WindowAction, CsvPreview } from "../shared/contracts";
// Keep this module self-contained: sandboxed preload cannot require local bundles.
const actions = ["state", "minimize", "maximize", "restore", "toggleMaximize", "enterFullscreen", "exitFullscreen", "toggleFullscreen", "focus"];
function isState(value: unknown): value is WindowState {
  if (!value || typeof value !== "object") return false;
  const s = value as WindowState;
  return Object.keys(s).length === 7 && [s.transitioning,s.minimized,s.maximized,s.fullscreen,s.focused].every(v => typeof v === "boolean") && [s.width,s.height].every(v => Number.isInteger(v) && v >= 0 && v <= 65536);
}
async function request<T>(operation: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      ipcRenderer.invoke("gmt:native", operation),
      new Promise<never>((_,reject) => { timer = setTimeout(() => reject(Error("Native operation timed out; dismiss any open file dialog.")), operation === "previewCsv" ? 120000 : 7000); }),
    ]);
    if (!result || result.ok !== true) throw Error("Native operation unavailable or selection rejected.");
    return result.value;
  } catch { throw Error("Native operation unavailable or selection rejected. Dismiss any open dialog and retry."); }
  finally { clearTimeout(timer); }
}
async function read(operation: "status" | "health" | "attribution"): Promise<any> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([ipcRenderer.invoke("gmt:read",operation),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error("Local operation timed out")),5000);})]); }
  catch { throw Error("Local operation unavailable. Restart the application if the service has failed."); }
  finally { clearTimeout(timer); }
}
const bridge: TerminalBridge = Object.freeze({
  status: () => read("status"),
  health: () => read("health"),
  openAttribution: () => read("attribution"),
  window: async (action: WindowAction) => {
    if (typeof action !== "string" || !actions.includes(action)) throw Error("Operation not permitted");
    const state = await request<WindowState>(action);
    if (!isState(state)) throw Error("Invalid window state");
    return state;
  },
  onWindowState: (listener: (state: WindowState) => void) => {
    if (typeof listener !== "function") throw Error("Invalid listener");
    const callback = (_event: unknown, value: unknown) => { if (isState(value)) listener({...value}); };
    ipcRenderer.on("gmt:window-state", callback);
    return () => ipcRenderer.removeListener("gmt:window-state", callback);
  },
  previewCsv: async () => {
    const value = await request<CsvPreview>("previewCsv");
    if (!value || typeof value.cancelled !== "boolean" || Object.keys(value).some(k => !["cancelled","rows","columns","bytes"].includes(k)) ||
      (!value.cancelled && ![value.rows,value.columns,value.bytes].every(n => Number.isInteger(n) && n! >= 0 && n! <= 65536))) throw Error("Invalid selection result");
    return value;
  },
});
contextBridge.exposeInMainWorld("terminal", bridge);
