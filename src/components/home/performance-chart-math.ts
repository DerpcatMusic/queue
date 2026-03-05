export type Timeframe = "weekly" | "monthly" | "yearly";
export type MetricMode = "earnings" | "lessons";
export type AxisTick = { index: number; label: string };

export type TimeframeData = {
  bucketStarts: number[];
  bucketEnds: number[];
  bucketLabels: string[];
  axisTicks: AxisTick[];
  frameStart: number;
};

type Point = { x: number; y: number };
type SeparatorSegment = { x: number; yStart: number; yEnd: number };

const timeframeOrder: Timeframe[] = ["weekly", "monthly", "yearly"];

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function toShortMonth(ts: number, locale: string) {
  return new Date(ts).toLocaleDateString(locale, { month: "short" });
}

function toShortWeekday(ts: number, locale: string) {
  return new Date(ts).toLocaleDateString(locale, { weekday: "short" });
}

function pickTickIndexes(length: number, targetCount: number) {
  if (length <= 0) return [] as number[];
  if (length <= targetCount) return Array.from({ length }, (_, idx) => idx);

  const safeCount = Math.max(2, targetCount);
  const step = (length - 1) / (safeCount - 1);
  const indexes = Array.from({ length: safeCount }, (_, idx) => Math.round(idx * step));
  return Array.from(new Set([0, ...indexes, length - 1])).sort((a, b) => a - b);
}

function buildAxisTicks(labels: string[], targetCount: number) {
  return pickTickIndexes(labels.length, targetCount).map((index) => ({
    index,
    label: labels[index] ?? "",
  }));
}

export function getAdjacentTimeframe(current: Timeframe, direction: "inc" | "dec"): Timeframe {
  const index = timeframeOrder.indexOf(current);
  if (direction === "inc") return timeframeOrder[Math.min(index + 1, timeframeOrder.length - 1)]!;
  return timeframeOrder[Math.max(index - 1, 0)]!;
}

export function getTimeframeData(timeframe: Timeframe, now: number, locale: string): TimeframeData {
  const today = startOfDay(now);

  if (timeframe === "weekly") {
    const bucketStarts = Array.from(
      { length: 7 },
      (_, idx) => today - (6 - idx) * 24 * 60 * 60 * 1000,
    );
    const bucketEnds = bucketStarts.map((_s, idx) =>
      idx === bucketStarts.length - 1 ? now + 1 : bucketStarts[idx + 1]!,
    );
    const bucketLabels = bucketStarts.map((s) => toShortWeekday(s, locale));
    return {
      bucketStarts,
      bucketEnds,
      bucketLabels,
      axisTicks: buildAxisTicks(bucketLabels, 7),
      frameStart: bucketStarts[0]!,
    };
  }

  if (timeframe === "monthly") {
    const bucketStarts = Array.from(
      { length: 30 },
      (_, idx) => today - (29 - idx) * 24 * 60 * 60 * 1000,
    );
    const bucketEnds = bucketStarts.map((_s, idx) =>
      idx === bucketStarts.length - 1 ? now + 1 : bucketStarts[idx + 1]!,
    );
    const bucketLabels = bucketStarts.map((s, idx) => {
      const date = new Date(s);
      const shouldShowMonth = idx === 0 || date.getDate() === 1;
      return date.toLocaleDateString(
        locale,
        shouldShowMonth ? { month: "short", day: "numeric" } : { day: "numeric" },
      );
    });
    return {
      bucketStarts,
      bucketEnds,
      bucketLabels,
      axisTicks: buildAxisTicks(bucketLabels, 6),
      frameStart: bucketStarts[0]!,
    };
  }

  const bucketStarts = Array.from({ length: 12 }, (_, idx) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - (11 - idx), 1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  const bucketEnds = bucketStarts.map((_s, idx) =>
    idx === bucketStarts.length - 1 ? now + 1 : bucketStarts[idx + 1]!,
  );
  const bucketLabels = bucketStarts.map((s) => toShortMonth(s, locale));
  return {
    bucketStarts,
    bucketEnds,
    bucketLabels,
    axisTicks: buildAxisTicks(bucketLabels, 6),
    frameStart: bucketStarts[0]!,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resampleValues(values: number[], targetCount: number) {
  const safeCount = Math.max(2, targetCount);
  if (values.length === 0) return Array.from({ length: safeCount }, () => 0);
  if (values.length === 1) return Array.from({ length: safeCount }, () => values[0]!);

  return Array.from({ length: safeCount }, (_unused, idx) => {
    const position = (idx / (safeCount - 1)) * (values.length - 1);
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(values.length - 1, Math.ceil(position));
    if (leftIndex === rightIndex) {
      return values[leftIndex] ?? 0;
    }
    const t = position - leftIndex;
    const left = values[leftIndex] ?? 0;
    const right = values[rightIndex] ?? left;
    return left + (right - left) * t;
  });
}

export function interpolateSeries(fromValues: number[], toValues: number[], progress: number) {
  const t = clamp(progress, 0, 1);
  if (t <= 0) return fromValues;
  if (t >= 1) return toValues;

  const fromLength = Math.max(2, fromValues.length || 2);
  const toLength = Math.max(2, toValues.length || 2);
  const count = Math.max(2, Math.round(fromLength + (toLength - fromLength) * t));
  const fromResampled = resampleValues(fromValues, count);
  const toResampled = resampleValues(toValues, count);

  return fromResampled.map((value, idx) => {
    const target = toResampled[idx] ?? value;
    return value + (target - value) * t;
  });
}

export function mapTickIndex(index: number, sourceLength: number, targetLength: number) {
  if (targetLength <= 1 || sourceLength <= 1) return 0;
  const ratio = index / (sourceLength - 1);
  return clamp(Math.round(ratio * (targetLength - 1)), 0, targetLength - 1);
}

function toChartPoints(values: number[], width: number, height: number, padding: number): Point[] {
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);
  const maxValue = Math.max(...values, 1);
  const allZero = values.every((v) => v === 0);

  return values.map((value, idx) => {
    const x = padding + (idx / Math.max(1, values.length - 1)) * usableWidth;
    const ratio = allZero ? 0.68 : 1 - value / maxValue;
    const y = padding + ratio * usableHeight;
    return { x, y };
  });
}

function smoothQuadraticPath(points: Point[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  if (points.length === 2)
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;

  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const midX = (points[i]!.x + points[i + 1]!.x) / 2;
    const midY = (points[i]!.y + points[i + 1]!.y) / 2;
    d += ` Q ${points[i]!.x} ${points[i]!.y}, ${midX} ${midY}`;
  }

  const penultimate = points[points.length - 2]!;
  const last = points[points.length - 1]!;
  d += ` Q ${penultimate.x} ${penultimate.y}, ${last.x} ${last.y}`;

  return d;
}

export function buildSplinePaths(values: number[], width: number, height: number, padding: number) {
  if (values.length === 0 || width <= 1 || height <= 1) {
    return {
      linePath: "",
      areaPath: "",
      separators: [] as SeparatorSegment[],
      pointXs: [] as number[],
      hasActivity: false,
    };
  }

  const points = toChartPoints(values, width, height, padding);
  const linePath = smoothQuadraticPath(points);
  const hasActivity = values.some((v) => v > 0);

  const bottom = height - padding * 0.35;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const areaPath = `${linePath} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`;

  const separators = hasActivity
    ? points.map((point) => ({ x: point.x, yStart: point.y + 1, yEnd: bottom }))
    : ([] as SeparatorSegment[]);

  const pointXs = points.map((point) => point.x);

  return { linePath, areaPath, separators, pointXs, hasActivity };
}
