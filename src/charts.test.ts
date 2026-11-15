import { areaPath, chartMode, linePath, nearestIndex, orderMetrics } from "./charts.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const stored = [
  { measured_at_utc: "2026-11-15T12:00:00Z", value: 70 },
  { measured_at_utc: "2026-11-14T12:00:00Z", value: 60 },
  { measured_at_utc: "2026-11-16T12:00:00Z", value: null },
];

assert(chartMode(0) === "empty", "no records stay empty");
assert(chartMode(1) === "single", "one record does not invent a line");
assert(chartMode(2) === "line", "two records draw a line");

const ordered = orderMetrics(stored);
assert(ordered.length === 2, "a null reading is left off the line");
assert(ordered[0]?.value === 60 && ordered[1]?.value === 70, "points follow time, oldest first");

const first = linePath([60, 70], 100, 30, 0.08);
const longer = linePath([60, 70, 80], 100, 30, 0.08);
assert(first.startsWith("M") && first.includes("L"), "a line has a start and a second point");
assert(first !== longer, "another saved value changes the line");

const ys = first.match(/ [\d.]+/g)?.map((item) => Number(item)) ?? [];
assert(ys.length === 2 && ys[1]! < ys[0]!, "a higher reading sits higher on the chart");

const filled = areaPath(first, 100, 30);
assert(filled.endsWith("Z") && filled.includes("L100.00 30.00"), "the area closes under the line");
assert(nearestIndex(0, 4) === 0, "the left edge is the first record");
assert(nearestIndex(1, 4) === 3, "the right edge is the last record");
assert(nearestIndex(0.5, 3) === 1, "the middle selects the middle record");

console.log("chart tests passed");
