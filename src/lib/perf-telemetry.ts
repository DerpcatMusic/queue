type PerfMetric = {
  key: string;
  durationMs: number;
  at: number;
  metadata?: Record<string, string | number | boolean>;
};

const MAX_METRICS = 500;
const metricsByKey = new Map<string, PerfMetric[]>();

function toRounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1),
  );
  return sortedValues[index] ?? 0;
}

function addMetric(metric: PerfMetric) {
  const existing = metricsByKey.get(metric.key) ?? [];
  existing.push(metric);
  if (existing.length > MAX_METRICS) {
    existing.splice(0, existing.length - MAX_METRICS);
  }
  metricsByKey.set(metric.key, existing);
}

export function recordPerfMetric(
  key: string,
  durationMs: number,
  metadata?: Record<string, string | number | boolean>,
) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  const metric: PerfMetric = {
    key,
    durationMs,
    at: Date.now(),
    ...(metadata ? { metadata } : {}),
  };
  addMetric(metric);
}

export function createPerfTimer(key: string, metadata?: Record<string, string | number | boolean>) {
  const startedAt = performance.now();
  return () => {
    const durationMs = performance.now() - startedAt;
    recordPerfMetric(key, durationMs, metadata);
  };
}

export function getPerfSummary() {
  const rows: {
    key: string;
    count: number;
    p50Ms: number;
    p95Ms: number;
    avgMs: number;
  }[] = [];

  for (const [key, metrics] of metricsByKey.entries()) {
    if (metrics.length === 0) continue;
    const values = metrics.map((metric) => metric.durationMs).sort((a, b) => a - b);
    const total = values.reduce((sum, value) => sum + value, 0);
    rows.push({
      key,
      count: values.length,
      p50Ms: toRounded(percentile(values, 50)),
      p95Ms: toRounded(percentile(values, 95)),
      avgMs: toRounded(total / values.length),
    });
  }

  return rows.sort((a, b) => a.key.localeCompare(b.key));
}

export function logPerfSummary() {
  const summary = getPerfSummary();
  if (summary.length === 0) {
    return;
  }
}
