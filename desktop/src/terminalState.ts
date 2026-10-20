import type { ServiceStatus } from "../shared/contracts";
export const INTERVALS = [
  "1m",
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
  "1D",
  "1W",
  "1M",
] as const;
export type Interval = (typeof INTERVALS)[number];
export const intervalDescription: Record<Interval, string> = {
  "1m": "one-minute candles",
  "5m": "five-minute candles",
  "15m": "fifteen-minute candles",
  "30m": "thirty-minute candles",
  "1h": "one-hour candles",
  "4h": "four-hour candles",
  "1D": "daily candles",
  "1W": "weekly candles",
  "1M": "monthly candles",
};
export type ChartState =
  | { kind: "empty" | "loading" | "offline" }
  | { kind: "error"; source: "backend" | "provider" };
export function marketState(service: ServiceStatus): ChartState {
  if (service.state === "starting") return { kind: "loading" };
  if (service.state === "failed" || service.state === "stopped")
    return { kind: "error", source: "backend" };
  return { kind: "offline" };
}
export function stateDescription(state: ChartState) {
  switch (state.kind) {
    case "loading":
      return {
        title: "Starting local service",
        detail:
          "Establishing an authenticated loopback connection. Market providers remain disconnected.",
      };
    case "empty":
      return {
        title: "No instrument selected",
        detail:
          "The chart is empty. A permitted market provider and a genuine instrument are required before data can be displayed.",
      };
    case "error":
      return state.source === "backend"
        ? {
            title: "Local service unavailable",
            detail:
              "Check the local service status, then restart the application. No market data is being displayed.",
          }
        : {
            title: "Market provider unavailable",
            detail:
              "The provider could not supply verified data. No substitute or demonstration prices are displayed.",
          };
    case "offline":
      return {
        title: "Market data is not connected",
        detail: "Live market providers are not connected in Phase 1.",
      };
  }
}
export function sidebarWidth(value: number) {
  return Math.max(280, Math.min(420, Math.round(value)));
}
