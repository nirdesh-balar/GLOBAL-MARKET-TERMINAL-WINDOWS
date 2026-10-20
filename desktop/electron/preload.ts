import { contextBridge, ipcRenderer } from "electron";
import type { TerminalBridge } from "../shared/contracts";
const bridge: TerminalBridge = Object.freeze({
  status: () => ipcRenderer.invoke("gmt:read", "status"),
  health: () => ipcRenderer.invoke("gmt:read", "health"),
  openAttribution: () => ipcRenderer.invoke("gmt:read", "attribution"),
});
contextBridge.exposeInMainWorld("terminal", bridge);
