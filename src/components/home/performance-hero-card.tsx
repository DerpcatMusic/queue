import { useMemo, useState } from "react";
import { type LayoutChangeEvent, PanResponder, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useHomeDashboardLayout } from "@/components/home/home-dashboard-layout";
import type { AxisTick, MetricMode, Timeframe } from "@/components/home/performance-chart-math";
import { buildSplinePaths, getAdjacentTimeframe } from "@/components/home/performance-chart-math";
import { KitPressable } from "@/components/ui/kit";
import { type BrandPalette, BrandRadius, BrandType } from "@/constants/brand";

export type PerformanceTimeframeSeries = {
  values: number[];
  axisTicks: AxisTick[];
};

export type PerformanceTimeframeOption = {
  value: Timeframe;
  label: string;
};

export type PerformanceMetricOption = {
  value: MetricMode;
  label: string;
};

type PerformanceHeroCardProps = {
  palette: BrandPalette;
  timeframe: Timeframe;
  metricMode: MetricMode;
  timeframeLabel: string;
  totalLabel: string;
  metricOptions: readonly PerformanceMetricOption[];
  timeframeOptions: readonly PerformanceTimeframeOption[];
  seriesByTimeframe: Record<Timeframe, PerformanceTimeframeSeries>;
  onSelectMetric: (value: MetricMode) => void;
  onSelectTimeframe: (value: Timeframe) => void;
  onSwipeTimeframe: (direction: "inc" | "dec") => void;
};

type AxisLabelEntry = {
  key: string;
  label: string;
  x: number;
};

export function PerformanceHeroCard({
  palette,
  timeframe,
  metricMode,
  timeframeLabel,
  totalLabel,
  metricOptions,
  timeframeOptions,
  seriesByTimeframe,
  onSelectMetric,
  onSelectTimeframe,
  onSwipeTimeframe,
}: PerformanceHeroCardProps) {
  const layout = useHomeDashboardLayout();
  const chartHeight = layout.isWideWeb ? 220 : 176;
  const chartPadding = 12;
  const [chartWidth, setChartWidth] = useState(0);
  const gradientId = useMemo(() => `hero-fill-${Math.random().toString(36).slice(2)}`, []);

  const currentSeries = seriesByTimeframe[timeframe];
  const currentMetricLabel =
    metricOptions.find((option) => option.value === metricMode)?.label ?? timeframeLabel;
  const { linePath, areaPath, separators, pointXs, hasActivity } = useMemo(
    () => buildSplinePaths(currentSeries.values, chartWidth, chartHeight, chartPadding),
    [chartHeight, chartWidth, currentSeries.values],
  );

  const axisLabels = useMemo(() => {
    if (pointXs.length === 0 || chartWidth <= 1) return [] as AxisLabelEntry[];

    const labels: AxisLabelEntry[] = [];
    const maxLabelWidth = 56;
    const maxLeft = Math.max(0, chartWidth - maxLabelWidth);
    currentSeries.axisTicks.forEach((tick, idx) => {
      const x = pointXs[tick.index];
      if (x === undefined) return;
      labels.push({
        key: `current-${String(idx)}-${tick.label}`,
        label: tick.label,
        x: Math.min(maxLeft, Math.max(0, x - maxLabelWidth / 2)),
      });
    });

    return labels;
  }, [chartWidth, currentSeries.axisTicks, pointXs]);

  const insightLabel = useMemo(() => {
    const values = currentSeries.values;
    if (values.length === 0 || values.every((value) => value === 0)) {
      return "No activity yet";
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
        if (closest === null) {
          return tick;
        }
        return Math.abs(tick.index - peakIndex) < Math.abs(closest.index - peakIndex)
          ? tick
          : closest;
      }, null) ?? null;

    const activePoints = values.filter((value) => value > 0).length;
    return `Peak ${peakTick?.label ?? `#${String(peakIndex + 1)}`}  ·  ${String(activePoints)} active`;
  }, [currentSeries.axisTicks, currentSeries.values]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) =>
          Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderRelease: (_evt, gestureState) => {
          const absDx = Math.abs(gestureState.dx);
          if (absDx >= 44) {
            const direction = gestureState.dx > 0 ? "inc" : "dec";
            if (getAdjacentTimeframe(timeframe, direction) !== timeframe) {
              onSwipeTimeframe(direction);
            }
          }
        },
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
      style={{
        padding: layout.isWideWeb ? 28 : 24,
        backgroundColor: palette.primary as string,
        borderRadius: BrandRadius.card,
        borderCurve: "continuous",
        gap: 16,
      }}
    >
      <View
        style={{
          flexDirection: layout.isWideWeb ? "row" : "column",
          alignItems: layout.isWideWeb ? "flex-start" : "stretch",
          gap: 14,
        }}
      >
        <View style={{ flex: 1, gap: 6 }}>
          <Text
            style={{
              ...BrandType.micro,
              color: palette.onPrimary as string,
              opacity: 0.72,
              letterSpacing: 0.8,
            }}
          >
            {currentMetricLabel}
          </Text>
          <Text
            style={{
              ...BrandType.display,
              fontSize: layout.isWideWeb ? 40 : 34,
              lineHeight: layout.isWideWeb ? 42 : 36,
              color: palette.onPrimary as string,
              fontVariant: ["tabular-nums"],
            }}
          >
            {totalLabel}
          </Text>
          <Text
            style={{
              ...BrandType.micro,
              color: palette.onPrimary as string,
              opacity: 0.76,
            }}
          >
            {timeframeLabel} · {insightLabel}
          </Text>
        </View>
        <View
          style={{
            width: layout.isWideWeb ? 232 : "100%",
            borderRadius: BrandRadius.pill,
            backgroundColor: "rgba(255,255,255,0.14)",
            flexDirection: "row",
            gap: 4,
            padding: 4,
          }}
        >
          {metricOptions.map((option) => {
            const selected = option.value === metricMode;
            return (
              <KitPressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Show ${option.label}`}
                onPress={() => onSelectMetric(option.value)}
                nativeFeedback={false}
                pressStyle={{ opacity: 0.9, transform: [{ scale: 0.98 }] }}
                style={{
                  minHeight: 36,
                  minWidth: 82,
                  flex: layout.isWideWeb ? undefined : 1,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: BrandRadius.pill,
                  paddingHorizontal: 12,
                  backgroundColor: selected
                    ? (palette.onPrimary as string)
                    : "rgba(255,255,255,0.08)",
                }}
              >
                <Text
                  style={{
                    ...BrandType.micro,
                    color: selected ? (palette.primary as string) : (palette.onPrimary as string),
                    opacity: selected ? 1 : 0.76,
                  }}
                >
                  {option.label}
                </Text>
              </KitPressable>
            );
          })}
        </View>
      </View>

      <View
        {...panResponder.panHandlers}
        onLayout={onChartLayout}
        style={{
          height: chartHeight,
          overflow: "hidden",
          borderRadius: BrandRadius.card,
          borderCurve: "continuous",
          backgroundColor: "rgba(255,255,255,0.08)",
          paddingHorizontal: 8,
          paddingTop: 10,
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
                backgroundColor: "rgba(255,255,255,0.16)",
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
                <Stop offset="0%" stopColor={palette.onPrimary as string} stopOpacity={0.34} />
                <Stop offset="100%" stopColor={palette.onPrimary as string} stopOpacity={0.04} />
              </LinearGradient>
            </Defs>
            {hasActivity && areaPath ? <Path d={areaPath} fill={`url(#${gradientId})`} /> : null}
            {linePath ? (
              <Path d={linePath} stroke={palette.onPrimary as string} strokeWidth={3} fill="none" />
            ) : null}
          </Svg>
        </View>
      </View>

      <View style={{ marginTop: 2, height: 16, position: "relative" }}>
        {axisLabels.map((entry) => (
          <Text
            key={entry.key}
            style={{
              ...BrandType.micro,
              fontSize: 11,
              color: palette.onPrimary as string,
              opacity: 0.72,
              position: "absolute",
              left: entry.x,
              width: 56,
              textAlign: "center",
            }}
          >
            {entry.label}
          </Text>
        ))}
      </View>

      <View
        style={{
          marginTop: 4,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <View style={{ flexDirection: "row", gap: 8, flex: 1, flexWrap: "wrap" }}>
          {timeframeOptions.map((option) => {
            const selected = option.value === timeframe;
            return (
              <KitPressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelectTimeframe(option.value)}
                nativeFeedback={false}
                style={{
                  minHeight: 34,
                  borderRadius: BrandRadius.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 12,
                  backgroundColor: selected
                    ? (palette.onPrimary as string)
                    : "rgba(255,255,255,0.12)",
                }}
              >
                <Text
                  style={{
                    ...BrandType.micro,
                    color: selected ? (palette.primary as string) : (palette.onPrimary as string),
                    opacity: selected ? 1 : 0.76,
                  }}
                >
                  {option.label}
                </Text>
              </KitPressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
