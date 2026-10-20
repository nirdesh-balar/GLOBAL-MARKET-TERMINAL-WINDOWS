import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ChevronDown,
  SlidersHorizontal,
  RefreshCw,
  Camera,
  Maximize2,
  RotateCcw,
  WifiOff,
  Database,
  ShieldCheck,
  X,
} from "lucide-react";
import type { ServiceStatus } from "../shared/contracts";
import { ChartWorkspace } from "./ChartWorkspace";
import { DrawingToolbar, MainToolbar, ToolButton } from "./TerminalControls";
import { WatchlistSidebar } from "./WatchlistSidebar";
import { marketState, sidebarWidth, type Interval } from "./terminalState";
export default function App() {
  const [service, setService] = useState<ServiceStatus>({
    state: "starting",
    message: "Starting authenticated local service",
  });
  const [busy, setBusy] = useState(false);
  const checking = useRef(false);
  const [interval, setIntervalChoice] = useState<Interval>("1D");
  const [cursor, setCursor] = useState<"pointer" | "crosshair">("pointer");
  const [showGrid, setShowGrid] = useState(true);
  const [panel, setPanel] = useState<"settings" | "connection" | null>(null);
  const [notice, setNotice] = useState("");
  const [width, setWidth] = useState(320);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const [sidebarMode, setSidebarMode] = useState<"auto" | "open" | "closed">(
    "auto",
  );
  const [narrow, setNarrow] = useState(() => window.innerWidth < 1100);
  const panelTrigger = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const visible = sidebarMode === "open" || (sidebarMode === "auto" && !narrow);
  const state = marketState(service);
  async function check() {
    if (checking.current) return;
    checking.current = true;
    setBusy(true);
    try {
      const next = await window.terminal.status();
      if (next.state === "ready") await window.terminal.health();
      setService(next);
    } catch {
      setService({
        state: "failed",
        message:
          "Local service unavailable. Check setup, then restart the application.",
      });
    } finally {
      checking.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    void check();
    const timer = window.setInterval(() => void check(), 4000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const query = window.matchMedia("(max-width:1099px)");
    const changed = () => setNarrow(query.matches);
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    if (panel)
      panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [panel]);
  const closePanel = () => {
    setPanel(null);
    panelTrigger.current?.focus();
  };
  const togglePanel = (kind: "settings" | "connection") => {
    if (panel === kind) {
      closePanel();
      return;
    }
    panelTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setPanel(kind);
  };

  return (
    <div
      className="terminal-app"
      onKeyDown={(event) => {
        if (event.key === "Escape" && panel) {
          event.preventDefault();
          closePanel();
        }
      }}
    >
      <header className="application-header">
        <span className="header-version">WINDOWS · 0.1.0 DEV</span>
        <h1>GLOBAL MARKET TERMINAL</h1>
        <div className="application-nav">
          <button type="button" disabled title="Screener is planned">
            Screener
          </button>
          <button type="button" disabled title="Alerts are planned">
            Alerts
          </button>
          <button
            type="button"
            className="provider-button"
            aria-expanded={panel === "connection"}
            aria-controls="connection-status"
            onClick={() => togglePanel("connection")}
          >
            Providers · Offline
          </button>
          <span className="read-only-identity">
            <span /> READ ONLY
          </span>
        </div>
      </header>
      <MainToolbar
        interval={interval}
        onInterval={setIntervalChoice}
        sidebarOpen={visible}
        onSidebar={() => setSidebarMode(visible ? "closed" : "open")}
        settingsOpen={panel === "settings"}
        onSettings={() => togglePanel("settings")}
      />
      <main
        className={`terminal-workspace ${visible ? "has-watchlist" : ""}`}
        style={{ "--watchlist-width": `${width}px` } as CSSProperties}
      >
        <DrawingToolbar cursor={cursor} onCursor={setCursor} />
        <section
          className="chart-panel"
          aria-label="Chart panel"
          data-layout="single"
        >
          <div className="pane-toolbar">
            <div className="pane-instrument">
              <strong>No symbol</strong>
              <ChevronDown size={12} />
              <span>No provider</span>
              <span className="pane-divider" />
              <span data-testid="pane-interval">{interval}</span>
              <ChevronDown size={12} />
              <span className="pane-divider" />
              <span>Candle</span>
              <ChevronDown size={12} />
            </div>
            <div className="pane-actions">
              <ToolButton
                label="Pane alert"
                planned="alerts require genuine data"
              >
                <span>Alert</span>
              </ToolButton>
              <ToolButton
                label="Pane studies"
                planned="indicator calculations are not connected"
              >
                <SlidersHorizontal size={14} />
              </ToolButton>
              <ToolButton
                label="Check local service"
                onClick={() => void check()}
                disabled={busy}
              >
                <RefreshCw size={14} />
              </ToolButton>
              <ToolButton
                label="Toggle workspace fullscreen"
                planned="use native window controls; a secure fullscreen IPC operation is not exposed"
              >
                <Maximize2 size={14} />
              </ToolButton>
            </div>
          </div>
          <div className="chart-legend">
            <div className="instrument-legend">
              <span className="legend-icon">▥</span>
              <strong>No instrument selected</strong>
              <span>·</span>
              <span>{interval}</span>
              <span className="metadata-placeholder">
                · Exchange unavailable
              </span>
              <span className="provider-tag">No provider</span>
            </div>
            <div className="ohlc-legend" aria-label="OHLC values unavailable">
              <span>
                O <b>—</b>
              </span>
              <span>
                H <b>—</b>
              </span>
              <span>
                L <b>—</b>
              </span>
              <span>
                C <b>—</b>
              </span>
              <span className="legend-note">Awaiting genuine market data</span>
            </div>
            <div className="study-legend">
              <span>Studies</span>
              <span>None applied</span>
              <span className="study-note">No calculated indicators</span>
            </div>
          </div>
          <ChartWorkspace state={state} showGrid={showGrid} cursor={cursor} />
          <div
            className="bottom-chart-toolbar"
            role="toolbar"
            aria-label="Visible date range and price scale"
          >
            <div
              className="date-ranges"
              role="group"
              aria-label="Visible date range"
            >
              {["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "ALL"].map(
                (range) => (
                  <button
                    type="button"
                    disabled
                    key={range}
                    title={`${range} visible date range — genuine history is required`}
                  >
                    {range}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled
                title="Custom date range requires genuine history"
              >
                Custom
              </button>
            </div>
            <span className="toolbar-spacer" />
            <div className="scale-controls">
              <span className="timezone-placeholder">Timezone unavailable</span>
              <button
                type="button"
                disabled
                title="Logarithmic price scale requires prices"
              >
                LOG
              </button>
              <button
                type="button"
                disabled
                title="Automatic price scale requires prices"
              >
                AUTO
              </button>
              <button
                type="button"
                disabled
                aria-label="Percentage price scale"
                title="Percentage scale requires prices"
              >
                %
              </button>
              <ToolButton
                label="Reset and fit chart"
                planned="there are no bars to fit"
              >
                <RotateCcw size={13} />
              </ToolButton>
              <ToolButton
                label="Export chart screenshot"
                planned="secure screenshot export is not implemented"
              >
                <Camera size={14} />
              </ToolButton>
            </div>
          </div>
        </section>
        {visible && (
          <>
            <div
              className="watchlist-resizer"
              role="separator"
              aria-label="Resize watchlist"
              aria-orientation="vertical"
              tabIndex={0}
              aria-valuemin={280}
              aria-valuemax={420}
              aria-valuenow={width}
              onKeyDown={(event) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  setWidth((value) =>
                    event.key === "Home"
                      ? 280
                      : event.key === "End"
                        ? 420
                        : sidebarWidth(
                            value + (event.key === "ArrowLeft" ? 20 : -20),
                          ),
                  );
                }
              }}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                drag.current = { x: event.clientX, width };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (drag.current)
                  setWidth(
                    sidebarWidth(
                      drag.current.width + drag.current.x - event.clientX,
                    ),
                  );
              }}
              onPointerUp={(event) => {
                drag.current = null;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onLostPointerCapture={() => {
                drag.current = null;
              }}
            />
            <WatchlistSidebar />
          </>
        )}
      </main>
      <footer className="terminal-status">
        <div className="status-left">
          <WifiOff size={12} />
          <strong>PROVIDERS OFFLINE</strong>
          <span className="status-divider" />
          <span>No symbol · {interval}</span>
          <span className="status-detail">· 0 bars in memory</span>
        </div>
        <div className="status-right">
          <span className="storage-status">
            <Database size={12} /> Session only
          </span>
          <span
            role="status"
            data-testid="service-status"
            data-state={service.state}
          >
            <ShieldCheck size={12} />
            {service.state === "ready"
              ? "Local backend ready"
              : service.state === "starting"
                ? "Local backend starting"
                : "Local backend unavailable"}
          </span>
          <a
            href="https://www.tradingview.com/"
            onClick={(event) => {
              event.preventDefault();
              void window.terminal
                .openAttribution()
                .catch(() =>
                  setNotice("The attribution link could not be opened."),
                );
            }}
          >
            Charts by TradingView · Lightweight Charts™
          </a>
        </div>
      </footer>
      {panel && (
        <div
          className="workspace-popover"
          id={panel === "settings" ? "view-settings" : "connection-status"}
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label={
            panel === "settings"
              ? "Workspace view settings"
              : "Connection status"
          }
        >
          <div className="popover-heading">
            <strong>
              {panel === "settings" ? "Workspace view" : "Connection status"}
            </strong>
            <button
              type="button"
              className="tool-button"
              aria-label="Close panel"
              onClick={closePanel}
            >
              <X size={15} />
            </button>
          </div>
          {panel === "settings" ? (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(event) => setShowGrid(event.target.checked)}
                />{" "}
                Show chart grid
              </label>
              <p>View choices last for this session only.</p>
            </>
          ) : (
            <>
              <div className={`connection-summary ${service.state}`}>
                <span />
                {service.message}
              </div>
              <p>
                Market providers are not connected. No market requests,
                credentials or saved market history.
              </p>
              <button
                type="button"
                className="connection-check"
                onClick={() => void check()}
                disabled={busy}
              >
                <RefreshCw size={13} />{" "}
                {busy ? "Checking local service…" : "Check local service"}
              </button>
            </>
          )}
        </div>
      )}
      {notice && (
        <div className="workspace-notice" role="alert">
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss notice"
            onClick={() => setNotice("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
