import { useEffect, useRef } from "react";
import { createChart, ColorType, type IChartApi } from "lightweight-charts";
import {
  Unplug,
  LoaderCircle,
  TriangleAlert,
  ChartNoAxesCombined,
} from "lucide-react";
import { stateDescription, type ChartState } from "./terminalState";
export function ChartWorkspace({
  state = { kind: "offline" },
  showGrid = true,
  cursor = "pointer",
}: {
  state?: ChartState;
  showGrid?: boolean;
  cursor?: "pointer" | "crosshair";
}) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const api = (chart.current = createChart(element, {
      width: Math.max(1, element.clientWidth),
      height: Math.max(1, element.clientHeight),
      autoSize: false,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#92a5be",
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
      handleScale: false,
      handleScroll: false,
    }));
    // Required attribution is a visible approved text link in the status bar.
    // The optional logo widget injects inline CSS blocked by our existing CSP.
    // Empty foundation only: no series, candles, prices or dates are supplied.
    let pending = 0;
    let updates = 0;
    const resize = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        const width = Math.floor(element.clientWidth),
          height = Math.floor(element.clientHeight);
        if (width > 0 && height > 0) {
          // Repaint within this coalesced frame so the canvas never trails the layout.
          api.resize(width, height, true);
          element.dataset.chartWidth = String(width);
          element.dataset.chartHeight = String(height);
          element.dataset.resizeCount = String(++updates);
          element.dataset.chartReady = "true";
        }
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(pending);
      chart.current = null;
      api.remove();
    };
  }, []);
  const description = stateDescription(state);
  return (
    <section
      className={`chart-space ${showGrid ? "with-grid" : ""} ${cursor === "crosshair" ? "crosshair-cursor" : ""}`}
      aria-label="Empty chart workspace"
      data-view-state={state.kind}
    >
      <div className="plot-area">
        <div
          ref={container}
          className="chart-canvas"
          data-testid="empty-chart"
        />
        <div
          className="chart-state"
          role={state.kind === "error" ? "alert" : "status"}
        >
          <div className={`state-icon ${state.kind}`}>
            {state.kind === "loading" ? (
              <LoaderCircle size={22} />
            ) : state.kind === "error" ? (
              <TriangleAlert size={22} />
            ) : state.kind === "empty" ? (
              <ChartNoAxesCombined size={22} />
            ) : (
              <Unplug size={22} />
            )}
          </div>
          <h2>{description.title}</h2>
          <p>{description.detail}</p>
          <small>No demonstration candles · no stored market history</small>
        </div>
        <div className="data-provenance">
          No provider · no bars retrieved · freshness unavailable
        </div>
      </div>
      <div className="price-axis" aria-label="Price axis awaiting genuine data">
        <span>PRICE</span>
        <span>—</span>
      </div>
      <div className="time-axis" aria-label="Time axis awaiting genuine data">
        <span>No market timestamps available</span>
      </div>
      <div className="axis-corner" />
    </section>
  );
}
