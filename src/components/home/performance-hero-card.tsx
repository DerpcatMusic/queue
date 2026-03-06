import { useMemo, useState } from "react";
import { type LayoutChangeEvent, PanResponder, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import type { AxisTick, MetricMode, Timeframe } from "@/components/home/performance-chart-math";
import {
  buildSplinePaths,
  getAdjacentTimeframe,
  interpolateSeries,
  mapTickIndex,
} from "@/components/home/performance-chart-math";
import { KitPressable } from "@/components/ui/kit";
import type { BrandPalette } from "@/constants/brand";

export type PerformanceTimeframeSeries = {
  values: number[];
  axisTicks: AxisTick[];
};

export type PerformanceTimeframeOption = {
  value: Timeframe;
  label: string;
};

type PerformanceHeroCardProps = {
  palette: BrandPalette;
  timeframe: Timeframe;
  metricMode: MetricMode;
  timeframeLabel: string;
  totalLabel: string;
  metricLabel: string;
  nextMetricLabel: string;
  timeframeOptions: readonly PerformanceTimeframeOption[];
  seriesByTimeframe: Record<Timeframe, PerformanceTimeframeSeries>;
  onToggleMetric: () => void;
  onSelectTimeframe: (value: Timeframe) => void;
  onSwipeTimeframe: (direction: "inc" | "dec") => void;
};

type AxisLabelEntry = {
  key: string;
  label: string;
  x: number;
  opacity: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function PerformanceHeroCard({
  palette,
  timeframe,
  metricMode,
  timeframeLabel,
  totalLabel,
  metricLabel,
  nextMetricLabel,
  timeframeOptions,
  seriesByTimeframe,
  onToggleMetric,
  onSelectTimeframe,
  onSwipeTimeframe,
}: PerformanceHeroCardProps) {
  const swipeDistance = 120;
  const chartHeight = 162;
  const chartPadding = 12;
  const [chartWidth, setChartWidth] = useState(0);
  const [dragDx, setDragDx] = useState(0);
  const gradientId = useMemo(() => `hero-fill-${Math.random().toString(36).slice(2)}`, []);

  const currentSeries = seriesByTimeframe[timeframe];
  const dragDirection = dragDx === 0 ? null : dragDx > 0 ? "inc" : "dec";
  const adjacentTimeframe = dragDirection
    ? getAdjacentTimeframe(timeframe, dragDirection)
    : timeframe;
  const adjacentSeries = seriesByTimeframe[adjacentTimeframe] ?? currentSeries;
  const transitionProgress = clamp(Math.abs(dragDx) / swipeDistance, 0, 1);

  const displayValues = useMemo(() => {
    if (!dragDirection || adjacentTimeframe === timeframe) {
      return currentSeries.values;
    }
    return interpolateSeries(currentSeries.values, adjacentSeries.values, transitionProgress);
  }, [
    dragDirection,
    adjacentTimeframe,
    timeframe,
    currentSeries.values,
    adjacentSeries.values,
    transitionProgress,
  ]);

  const { linePath, areaPath, separators, pointXs, hasActivity } = useMemo(
    () => buildSplinePaths(displayValues, chartWidth, chartHeight, chartPadding),
    [displayValues, chartWidth],
  );

  const axisLabels = useMemo(() => {
    if (pointXs.length === 0 || chartWidth <= 1) return [] as AxisLabelEntry[];

    const labels: AxisLabelEntry[] = [];
    const displayCount = displayValues.length;
    const maxLabelWidth = 56;
    const maxLeft = Math.max(0, chartWidth - maxLabelWidth);
    const showBlend = Boolean(
      dragDirection && adjacentTimeframe !== timeframe && transitionProgress > 0,
    );

    const addTickSet = (
      ticks: AxisTick[],
      sourceCount: number,
      opacity: number,
      prefix: "current" | "adjacent",
    ) => {
      if (opacity <= 0.02) return;
      ticks.forEach((tick, idx) => {
        const mappedIndex = mapTickIndex(tick.index, sourceCount, displayCount);
        const x = pointXs[mappedIndex];
        if (x === undefined) return;
        labels.push({
          key: `${prefix}-${String(idx)}-${tick.label}`,
          label: tick.label,
          x: clamp(x - maxLabelWidth / 2, 0, maxLeft),
          opacity,
        });
      });
    };

    addTickSet(
      currentSeries.axisTicks,
      currentSeries.values.length,
      showBlend ? 1 - transitionProgress : 1,
      "current",
    );
    if (showBlend) {
      addTickSet(
        adjacentSeries.axisTicks,
        adjacentSeries.values.length,
        transitionProgress,
        "adjacent",
      );
    }

    return labels;
  }, [
    pointXs,
    chartWidth,
    displayValues.length,
    dragDirection,
    adjacentTimeframe,
    timeframe,
    transitionProgress,
    currentSeries.axisTicks,
    currentSeries.values.length,
    adjacentSeries.axisTicks,
    adjacentSeries.values.length,
  ]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) =>
          Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_evt, gestureState) => {
          if (Math.abs(gestureState.dx) <= Math.abs(gestureState.dy)) return;
          setDragDx(clamp(gestureState.dx, -swipeDistance, swipeDistance));
        },
        onPanResponderRelease: (_evt, gestureState) => {
          const absDx = Math.abs(gestureState.dx);
          if (absDx >= 44) {
            const direction = gestureState.dx > 0 ? "inc" : "dec";
            if (getAdjacentTimeframe(timeframe, direction) !== timeframe) {
              onSwipeTimeframe(direction);
            }
          }
          setDragDx(0);
        },
        onPanResponderTerminate: () => setDragDx(0),
      }),
    [onSwipeTimeframe, timeframe],
  );

  const onChartLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 100) {
      setChartWidth(width);
    }
  };

  return (
    <View
      className="p-6"
      style={{
        backgroundColor: palette.primary as string,
        borderRadius: 36,
        borderCurve: "continuous",
      }}
    >
      <View className="mb-3 flex-row items-center justify-between">
        <View>
          <Text className="font-title text-sm" style={{ color: "rgba(255,255,255,0.88)" }}>
            {timeframeLabel}
          </Text>
          <Text className="font-bodyStrong text-xl" style={{ color: "rgba(255,255,255,0.98)" }}>
            {totalLabel}
          </Text>
        </View>
        <KitPressable
          accessibilityRole="button"
          accessibilityLabel={
            metricMode === "earnings" ? "Switch to lessons" : "Switch to earnings"
          }
          onPress={() => {
            onToggleMetric();
          }}
          className="min-h-12 items-center justify-center rounded-full active:opacity-85"
          nativeFeedback={false}
          pressStyle={{ opacity: 0.85, transform: [{ scale: 0.97 }] }}
          style={{ backgroundColor: "rgba(0,0,0,0.18)", paddingHorizontal: 14 }}
        >
          <Text className="font-title text-sm" style={{ color: "rgba(255,255,255,0.98)" }}>
            {nextMetricLabel}
          </Text>
        </KitPressable>
      </View>

      <View
        {...panResponder.panHandlers}
        onLayout={onChartLayout}
        style={{
          height: chartHeight,
          overflow: "hidden",
        }}
      >
        <View style={{ flex: 1 }}>
          {separators.map((x, idx) => (
            <View
              key={`separator-${String(idx)}`}
              style={{
                position: "absolute",
                left: x.x,
                top: x.yStart,
                bottom: chartHeight - x.yEnd,
                width: 1,
                backgroundColor: "rgba(255,255,255,0.18)",
              }}
            />
          ))}

          <Svg
            width="100%"
            height={chartHeight}
            viewBox={`0 0 ${Math.max(1, chartWidth)} ${chartHeight}`}
          >
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="white" stopOpacity={0.32} />
                <Stop offset="100%" stopColor="white" stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            {hasActivity && areaPath ? <Path d={areaPath} fill={`url(#${gradientId})`} /> : null}
            {linePath ? (
              <Path d={linePath} stroke="rgba(255,255,255,0.92)" strokeWidth={2.25} fill="none" />
            ) : null}
          </Svg>
        </View>
      </View>

      <View className="mt-2 gap-1">
        <Text className="font-title text-xs" style={{ color: "rgba(255,255,255,0.88)" }}>
          {metricLabel}
        </Text>
        <View style={{ height: 16, position: "relative" }}>
          {axisLabels.map((entry) => (
            <Text
              key={entry.key}
              className="font-title text-[11px]"
              style={{
                color: "rgba(255,255,255,0.9)",
                position: "absolute",
                left: entry.x,
                width: 56,
                textAlign: "center",
                opacity: entry.opacity,
              }}
            >
              {entry.label}
            </Text>
          ))}
        </View>
      </View>

      <View className="mt-4 flex-row items-center justify-between gap-3">
        <View className="flex-row gap-2">
          {timeframeOptions.map((option) => {
            const selected = option.value === timeframe;
            return (
              <KitPressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelectTimeframe(option.value)}
                className="rounded-full px-3 py-2"
                nativeFeedback={false}
                style={{
                  backgroundColor: selected ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)",
                }}
              >
                <Text
                  className="font-title text-xs"
                  style={{
                    color: "rgba(255,255,255,0.96)",
                    opacity: selected ? 1 : 0.74,
                  }}
                >
                  {option.label}
                </Text>
              </KitPressable>
            );
          })}
        </View>
        <Text className="font-title text-[11px]" style={{ color: "rgba(255,255,255,0.78)" }}>
          Swipe
        </Text>
      </View>
    </View>
  );
}
