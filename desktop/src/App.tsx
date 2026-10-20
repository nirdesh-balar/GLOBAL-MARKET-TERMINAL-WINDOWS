import { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bookmark,
  ChevronRight,
  Database,
  Layers3,
  LayoutDashboard,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import type { ServiceStatus } from "../shared/contracts";
import { ChartWorkspace } from "./ChartWorkspace";
export default function App() {
  const [service, setService] = useState<ServiceStatus>({
    state: "starting",
    message: "Starting authenticated local service",
  });
  const [busy, setBusy] = useState(false);
  async function check() {
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
      setBusy(false);
    }
  }
  useEffect(() => {
    void check();
    const timer = setInterval(() => void check(), 4000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Activity size={23} />
          </div>
          <div>
            <h1>GLOBAL MARKET TERMINAL</h1>
            <span>INDEPENDENT MARKET ANALYSIS</span>
          </div>
        </div>
        <div className="header-meta">
          <span className="read-only">
            <LockKeyhole size={13} /> READ ONLY
          </span>
          <span className="version">WINDOWS · 0.1.0 DEV</span>
        </div>
      </header>
      <div className="body-layout">
        <aside className="sidebar">
          <div className="workspace-label">
            WORKSPACE <span>01</span>
          </div>
          <div className="nav-selected">
            <LayoutDashboard size={16} /> Overview <ChevronRight size={14} />
          </div>
          <div className="side-section">
            <span className="eyebrow">WATCHLISTS</span>
            <span className="future-label">PLANNED</span>
          </div>
          <div className="watchlist-empty">
            <Bookmark size={23} />
            <h3>Your markets, in one place</h3>
            <p>
              Watchlists will arrive in a later phase, after provider
              integration.
            </p>
          </div>
          <div className="sidebar-bottom">
            <ShieldCheck size={18} />
            <div>
              <strong>Analysis only</strong>
              <span>No accounts or trading access</span>
            </div>
          </div>
        </aside>
        <main>
          <div className="page-heading">
            <div>
              <div className="breadcrumb">
                WORKSPACE <ChevronRight size={12} /> OVERVIEW
              </div>
              <h2>
                Market workspace<span className="phase-tag">PHASE 1</span>
              </h2>
              <p>A focused foundation for your global market research.</p>
            </div>
            <div className="foundation-badge">
              <span /> FOUNDATION BUILD
            </div>
          </div>
          <div className="status-strip">
            <div>
              <Unplug size={18} />
              <span>
                <strong>Market providers</strong>
                <small>Not connected</small>
              </span>
              <span className="small-tag">OFFLINE</span>
            </div>
            <div>
              <Database size={18} />
              <span>
                <strong>History storage</strong>
                <small>None · no market data stored</small>
              </span>
            </div>
            <div>
              <ShieldCheck size={18} />
              <span>
                <strong>Local service</strong>
                <small
                  role="status"
                  data-testid="service-status"
                  data-state={service.state}
                >
                  {service.state === "ready"
                    ? "Authenticated & ready"
                    : service.state === "starting"
                      ? "Starting…"
                      : "Unavailable · restart required"}
                </small>
              </span>
              <button
                className="icon-button"
                onClick={() => void check()}
                disabled={busy}
                aria-label="Check local service"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
          <section className="workspace-panel">
            <div className="panel-top">
              <div>
                <Layers3 size={16} />
                <strong>Chart workspace</strong>
                <span className="panel-slash">/</span>
                <span>No instrument selected</span>
              </div>
              <span className="workspace-state">
                <span /> AWAITING DATA CONNECTION
              </span>
            </div>
            <ChartWorkspace />
            <div className="panel-bottom">
              <span>
                <LockKeyhole size={12} /> Read-only analysis environment
              </span>
              <a
                href="https://www.tradingview.com/"
                onClick={(event) => {
                  event.preventDefault();
                  void window.terminal.openAttribution();
                }}
              >
                Charts by TradingView · Lightweight Charts™{" "}
                <ArrowUpRight size={12} />
              </a>
            </div>
          </section>
          {service.state === "failed" && (
            <p role="alert" className="service-error">
              {service.message}
            </p>
          )}
          <div className="foundation-note">
            <div className="note-icon">
              <ShieldCheck size={18} />
            </div>
            <div>
              <strong>Built on a secure foundation</strong>
              <p>
                Isolated desktop processes, an authenticated local service, and
                a chart workspace ready for future integration.
              </p>
            </div>
            <span>DEVELOPMENT PREVIEW</span>
          </div>
        </main>
      </div>
      <footer className="app-footer">
        <span>
          <span
            className={
              service.state === "ready" ? "status-dot ready" : "status-dot"
            }
          />
          {service.state === "ready"
            ? "LOCAL SERVICE READY"
            : service.state === "starting"
              ? "LOCAL SERVICE STARTING"
              : "LOCAL SERVICE UNAVAILABLE"}
        </span>
        <span>
          PROVIDERS OFFLINE <span className="footer-divider">|</span> NO MARKET
          REQUESTS <span className="footer-divider">|</span> UNSIGNED
          DEVELOPMENT BUILD
        </span>
      </footer>
    </div>
  );
}
