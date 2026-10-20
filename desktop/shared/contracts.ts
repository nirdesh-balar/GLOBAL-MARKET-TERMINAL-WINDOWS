export interface Health {
  status: "ok";
  application: "GLOBAL MARKET TERMINAL";
  version: "0.1.0";
  phase: 1;
  mode: "read-only";
  providersConnected: false;
  marketHistoryStorage: "none";
}
export interface ServiceStatus {
  state: "starting" | "ready" | "failed" | "stopped";
  message: string;
}
export interface TerminalBridge {
  status: () => Promise<ServiceStatus>;
  health: () => Promise<Health>;
  openAttribution: () => Promise<void>;
  window: (action: WindowAction) => Promise<WindowState>;
  onWindowState: (listener: (state: WindowState) => void) => () => void;
  previewCsv: () => Promise<CsvPreview>;
}
declare global {
  interface Window {
    terminal: TerminalBridge;
  }
}

export type WindowAction = "state" | "minimize" | "maximize" | "restore" | "toggleMaximize" | "enterFullscreen" | "exitFullscreen" | "toggleFullscreen" | "focus";
export interface WindowState { transitioning: boolean; minimized: boolean; maximized: boolean; fullscreen: boolean; focused: boolean; width: number; height: number }
export interface CsvPreview { cancelled: boolean; rows?: number; columns?: number; bytes?: number }
