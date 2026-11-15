// PATH MATH FOR SAVED READINGS. A LINE EXISTS ONLY WHEN TWO OR MORE NUMBERS ARE STORED.

export type PlotPoint = {
  at: string;
  value: number;
};

export function chartMode(count: number): "empty" | "single" | "line" {
  if (count <= 0) return "empty";
  if (count === 1) return "single";
  return "line";
}

export function orderMetrics(points: Array<{ measured_at_utc: string; value: number | null }>): PlotPoint[] {
  return points
    .filter((point): point is { measured_at_utc: string; value: number } => point.value != null && Number.isFinite(point.value))
    .map((point) => ({ at: point.measured_at_utc, value: point.value }))
    .sort((left, right) => left.at.localeCompare(right.at));
}

export function linePath(values: number[], width: number, height: number, padRatio: number): string {
  if (values.length === 0) return "";
  const low = Math.min(...values);
  const high = Math.max(...values);
  const pad = (high - low) * padRatio || 1;
  const min = low - pad;
  const max = high + pad;
  const span = max - min;
  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / span) * height;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

export function areaPath(line: string, width: number, height: number): string {
  if (!line) return "";
  return `${line} L${width.toFixed(2)} ${height.toFixed(2)} L0.00 ${height.toFixed(2)} Z`;
}

export function nearestIndex(ratio: number, count: number): number {
  if (count <= 1) return 0;
  const clamped = Math.min(1, Math.max(0, ratio));
  return Math.round(clamped * (count - 1));
}
