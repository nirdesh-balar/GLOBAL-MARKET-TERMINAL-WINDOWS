import { useEffect, useRef } from "react";
import { createChart, ColorType } from "lightweight-charts";
import { ChartNoAxesCombined, Unplug } from "lucide-react";
export function ChartWorkspace() {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const chart = createChart(container.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#0c121b" },
        textColor: "#64748b",
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: "#16202e" },
        horzLines: { color: "#16202e" },
      },
      rightPriceScale: { borderColor: "#223043" },
      timeScale: { borderColor: "#223043" },
      handleScroll: false,
      handleScale: false,
    });
    // Intentionally no series or data: providers are not connected in Phase 1.
    container.current.dataset.chartReady = "true";
    return () => chart.remove();
  }, []);
  return (
    <section className="chart-space" aria-label="Empty chart workspace">
      <div ref={container} className="chart-canvas" data-testid="empty-chart" />
      <div className="empty-overlay">
        <div className="chart-symbol">
          <ChartNoAxesCombined size={32} />
        </div>
        <span className="eyebrow">YOUR ANALYSIS STARTS HERE</span>
        <h2>A clear view. When data is connected.</h2>
        <p>
          Live market providers are not connected in Phase 1.
          <br />
          This workspace is intentionally empty.
        </p>
        <div className="offline-pill">
          <Unplug size={14} /> Market data offline
        </div>
        <p className="quiet-note">
          No demo candles. No market-history storage.
        </p>
      </div>
    </section>
  );
}
