import { useId, useState, type MouseEvent } from "react";
import { areaPath, chartMode, linePath, nearestIndex, orderMetrics } from "./charts";
import type { MetricRow } from "./types";

export function TrendChart({ points, label, stroke, unit, tall = false }: {
  points: MetricRow[];
  label: string;
  stroke: string;
  unit: string;
  tall?: boolean;
}) {
  const ordered = orderMetrics(points);
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = `trend${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (ordered.length === 0) return null;

  const mode = chartMode(ordered.length);
  const shown = hover != null ? ordered[hover] ?? ordered[ordered.length - 1] : ordered[ordered.length - 1];
  const width = 100;
  const height = tall ? 100 : 30;
  const values = ordered.map((point) => point.value);
  const line = mode === "line" ? linePath(values, width, height, tall ? 0.15 : 0.08) : "";
  const area = areaPath(line, width, height);

  function follow(event: MouseEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) return;
    setHover(nearestIndex((event.clientX - bounds.left) / bounds.width, ordered.length));
  }

  return (
    <article className="trend-card">
      <header>
        <div>
          <h3>{label}</h3>
          <p className="muted">{shown?.at ?? ""}</p>
        </div>
        <p className="trend-value">{shown?.value}<span> {unit}</span></p>
      </header>
      {mode === "single" ? (
        <p className="muted">One saved value. The line appears after the next record.</p>
      ) : (
        <div className={tall ? "trend-plot-wrap" : undefined}>
          <svg
            className={tall ? "trend-plot" : "trend-spark"}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={label}
            onMouseMove={tall ? follow : undefined}
            onMouseLeave={tall ? () => setHover(null) : undefined}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity="0.4" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gradientId})`} />
            <path d={line} fill="none" stroke={stroke} strokeWidth={tall ? 1.8 : 1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            {tall && hover != null && (
              <line
                x1={(hover / (ordered.length - 1)) * width}
                x2={(hover / (ordered.length - 1)) * width}
                y1="0"
                y2={height}
                stroke="#e2e8f0"
                strokeOpacity="0.35"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        </div>
      )}
    </article>
  );
}
