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
}
declare global {
  interface Window {
    terminal: TerminalBridge;
  }
}
