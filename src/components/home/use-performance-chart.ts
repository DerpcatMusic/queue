import { useMemo, useState } from "react";
import type { TFunction } from "i18next";
import {
  getAdjacentTimeframe,
  type AxisTick,
  type MetricMode,
  type Timeframe,
} from "@/components/home/performance-chart-math";
import type {
  PerformanceMetricOption,
  PerformanceTimeframeOption,
  PerformanceTimeframeSeries,
} from "@/components/home/performance-hero-card";

type UsePerformanceChartOptions = {
  computeSeries: (mode: MetricMode) => Record<Timeframe, PerformanceTimeframeSeries>;
  currencyFormatter: Intl.NumberFormat;
  metricLabels: { earnings: string; lessons: string };
  t: TFunction;
};

/**
 * Shared hook that manages performance chart state (timeframe, metric mode, swipe)
 * and derives formatted labels from the caller-provided series data.
 *
 * The caller provides a `computeSeries` callback that takes the current `MetricMode`
 * and computes the series. This allows the hook to own the `metricMode` state without
 * crashing from circular dependencies.
 */
export function usePerformanceChart({
  computeSeries,
  currencyFormatter,
  metricLabels,
  t,
}: UsePerformanceChartOptions) {
  const [timeframe, setTimeframe] = useState<Timeframe>("weekly");
  const [metricMode, setMetricMode] = useState<MetricMode>("earnings");

  const seriesByTimeframe = useMemo(
    () => computeSeries(metricMode),
    [computeSeries, metricMode],
  );

  const currentSeries = seriesByTimeframe[timeframe];
  const frameTotal = currentSeries.values.reduce((sum, value) => sum + value, 0);

  const timeframeLabel = t(`home.performance.${timeframe}`);

  const insightLabel = useMemo(() => {
    const values = currentSeries.values;
    if (values.length === 0 || values.every((value) => value === 0)) {
      return t("home.performance.noActivity", { defaultValue: "No activity yet" });
    }

    let peakIndex = 0;
    let peakValue = values[0] ?? 0;
    values.forEach((value, index) => {
      if (value > peakValue) {
        peakValue = value;
        peakIndex = index;
      }
    });

    const peakTick =
      currentSeries.axisTicks.reduce<AxisTick | null>((closest, tick) => {
        if (closest === null) return tick;
        return Math.abs(tick.index - peakIndex) < Math.abs(closest.index - peakIndex)
          ? tick
          : closest;
      }, null) ?? null;

    const activePoints = values.filter((value) => value > 0).length;
    const peakStr = peakTick?.label ?? `#${String(peakIndex + 1)}`;
    
    return t("home.performance.peakActivity", {
      peak: peakStr,
      active: activePoints,
      defaultValue: `Peak ${peakStr}  ·  ${String(activePoints)} active`,
    });
  }, [currentSeries.axisTicks, currentSeries.values, t]);

  const summaryValue =
    metricMode === "earnings"
      ? currencyFormatter.format(frameTotal / 100)
      : `${String(frameTotal)} ${t("home.performance.lessons")}`;

  const timeframeOptions = useMemo<PerformanceTimeframeOption[]>(
    () => [
      { value: "weekly", label: t("home.performance.weekly") },
      { value: "monthly", label: t("home.performance.monthly") },
      { value: "yearly", label: t("home.performance.yearly") },
    ],
    [t],
  );

  const metricOptions = useMemo<PerformanceMetricOption[]>(
    () => [
      { value: "earnings", label: metricLabels.earnings },
      { value: "lessons", label: metricLabels.lessons },
    ],
    [metricLabels.earnings, metricLabels.lessons],
  );

  const handleSwipeTimeframe = useMemo(
    () => (direction: "inc" | "dec") => {
      setTimeframe((prev) => getAdjacentTimeframe(prev, direction));
    },
    [],
  );

  return {
    timeframe,
    setTimeframe,
    metricMode,
    setMetricMode,
    seriesByTimeframe,
    frameTotal,
    timeframeLabel,
    insightLabel,
    summaryValue,
    timeframeOptions,
    metricOptions,
    handleSwipeTimeframe,
  };
}
