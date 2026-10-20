import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  Activity,
  Search,
  ChevronDown,
  SlidersHorizontal,
  LayoutGrid,
  Undo2,
  Redo2,
  Play,
  Camera,
  PanelRightClose,
  PanelRightOpen,
  Settings2,
  MousePointer2,
  Crosshair,
  TrendingUp,
  AlignLeft,
  Waypoints,
  Shapes,
  Type,
  Ruler,
  Magnet,
  LockKeyhole,
  EyeOff,
  Trash2,
} from "lucide-react";
import { INTERVALS, intervalDescription, type Interval } from "./terminalState";
export function ToolButton({
  label,
  children,
  planned,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
  planned?: string;
}) {
  const explanation = planned ? `${label} — ${planned}` : label;
  return (
    <button
      type="button"
      className="tool-button"
      aria-label={label}
      title={explanation}
      disabled={!!planned}
      {...props}
    >
      {children}
    </button>
  );
}
export function MainToolbar({
  interval,
  onInterval,
  sidebarOpen,
  onSidebar,
  onSettings,
  settingsOpen,
}: {
  interval: Interval;
  onInterval: (value: Interval) => void;
  sidebarOpen: boolean;
  onSidebar: () => void;
  onSettings: () => void;
  settingsOpen: boolean;
}) {
  return (
    <div
      className="main-toolbar"
      role="toolbar"
      aria-label="Main chart toolbar"
    >
      <div className="gmt-brand">
        <Activity size={21} />
        <strong>GMT</strong>
      </div>
      <span className="toolbar-divider" />
      <ToolButton
        label="Search instruments"
        planned="instrument search requires a connected provider"
      >
        <Search size={15} />
        <span className="search-label">Symbol</span>
        <ChevronDown size={12} />
      </ToolButton>
      <span className="provider-caption">No provider</span>
      <span className="toolbar-divider" />
      <div className="intervals" role="group" aria-label="Candle interval">
        {INTERVALS.map((value) => (
          <button
            type="button"
            key={value}
            className={interval === value ? "interval selected" : "interval"}
            aria-label={`${value} · ${intervalDescription[value]}`}
            aria-pressed={interval === value}
            title={`${intervalDescription[value]} · view selection only; no data requested`}
            onClick={() => onInterval(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <ToolButton
        label="Chart type"
        planned="candlestick rendering requires genuine OHLCV"
      >
        <span className="type-label">Candles</span>
        <ChevronDown size={12} />
      </ToolButton>
      <ToolButton
        label="Indicator library"
        planned="studies require genuine market data"
      >
        <SlidersHorizontal size={16} />
        <span className="optional-label">Indicators</span>
      </ToolButton>
      <span className="toolbar-divider optional-divider" />
      <ToolButton
        label="Chart layout"
        planned="1, 2, 4, 6 and 8-chart layouts are planned"
      >
        <LayoutGrid size={16} />
        <span className="optional-label">1</span>
      </ToolButton>
      <span className="wide-tools">
        <ToolButton label="Undo" planned="drawing engine not implemented">
          <Undo2 size={16} />
        </ToolButton>
        <ToolButton label="Redo" planned="drawing engine not implemented">
          <Redo2 size={16} />
        </ToolButton>
        <ToolButton label="Replay" planned="replay requires genuine history">
          <Play size={16} />
          <span>Replay</span>
        </ToolButton>
        <ToolButton label="Create alert" planned="alerts are not implemented">
          Alert
        </ToolButton>
      </span>
      <span className="toolbar-spacer" />
      <ToolButton
        label="Workspace view settings"
        aria-expanded={settingsOpen}
        aria-controls="view-settings"
        onClick={onSettings}
      >
        <Settings2 size={17} />
      </ToolButton>
      <ToolButton
        label="Export screenshot"
        planned="secure screenshot export is not implemented"
      >
        <Camera size={17} />
      </ToolButton>
      <ToolButton
        label={sidebarOpen ? "Collapse watchlist" : "Show watchlist"}
        aria-expanded={sidebarOpen}
        aria-controls="watchlist"
        onClick={onSidebar}
      >
        {sidebarOpen ? (
          <PanelRightClose size={17} />
        ) : (
          <PanelRightOpen size={17} />
        )}
      </ToolButton>
    </div>
  );
}
export function DrawingToolbar({
  cursor,
  onCursor,
}: {
  cursor: "pointer" | "crosshair";
  onCursor: (value: "pointer" | "crosshair") => void;
}) {
  const planned = "drawing engine is planned; no drawings are created";
  return (
    <nav className="drawing-toolbar" aria-label="Drawing tools">
      <ToolButton
        label="Pointer cursor"
        className={`drawing-tool ${cursor === "pointer" ? "selected" : ""}`}
        aria-pressed={cursor === "pointer"}
        onClick={() => onCursor("pointer")}
      >
        <MousePointer2 size={20} />
      </ToolButton>
      <ToolButton
        label="Crosshair cursor"
        className={`drawing-tool ${cursor === "crosshair" ? "selected" : ""}`}
        aria-pressed={cursor === "crosshair"}
        onClick={() => onCursor("crosshair")}
      >
        <Crosshair size={19} />
      </ToolButton>
      <span className="drawing-divider" />
      <ToolButton label="Trendlines and channels" planned={planned}>
        <TrendingUp size={20} />
      </ToolButton>
      <ToolButton label="Fibonacci tools" planned={planned}>
        <AlignLeft size={20} />
      </ToolButton>
      <ToolButton label="Patterns" planned={planned}>
        <Waypoints size={20} />
      </ToolButton>
      <ToolButton label="Geometric shapes" planned={planned}>
        <Shapes size={20} />
      </ToolButton>
      <ToolButton label="Text annotations" planned={planned}>
        <Type size={20} />
      </ToolButton>
      <ToolButton label="Measuring tools" planned={planned}>
        <Ruler size={20} />
      </ToolButton>
      <span className="drawing-divider" />
      <ToolButton label="Magnet mode" planned={planned}>
        <Magnet size={19} />
      </ToolButton>
      <ToolButton label="Lock drawings" planned={planned}>
        <LockKeyhole size={19} />
      </ToolButton>
      <ToolButton label="Hide drawings" planned={planned}>
        <EyeOff size={19} />
      </ToolButton>
      <span className="drawing-spacer" />
      <ToolButton label="Delete drawings" planned={planned}>
        <Trash2 size={19} />
      </ToolButton>
    </nav>
  );
}
