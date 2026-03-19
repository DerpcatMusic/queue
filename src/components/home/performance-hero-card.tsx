import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { type LayoutChangeEvent, PanResponder, Pressable, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useHomeDashboardLayout } from "@/components/home/home-dashboard-layout";
import type { AxisTick, MetricMode, Timeframe } from "@/components/home/performance-chart-math";
import { buildSplinePaths, getAdjacentTimeframe } from "@/components/home/performance-chart-math";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { alphaColor } from "@/components/ui/kit/color-utils";
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
  insightLabel: string;
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

const METRIC_ICONS: Record<MetricMode, "creditcard.fill" | "calendar.badge.clock"> = {
  earnings: "creditcard.fill",
  lessons: "calendar.badge.clock",
};

export function PerformanceHeroCard({
  palette,
  timeframe,
  metricMode,
  timeframeLabel,
  insightLabel,
  totalLabel,
  metricOptions,
  timeframeOptions,
  seriesByTimeframe,
  onSelectMetric,
  onSelectTimeframe,
  onSwipeTimeframe,
}: PerformanceHeroCardProps) {
  const { t } = useTranslation();
  const layout = useHomeDashboardLayout();
  const chartHeight = layout.isWideWeb ? 220 : 176;
  const chartPadding = 12;
  const [chartWidth, setChartWidth] = useState(0);
  const gradientId = `hero-fill-${useId()}`;

  const currentSeries = seriesByTimeframe[timeframe];
  const currentMetricOption = metricOptions.find((option) => option.value === metricMode);
  const currentMetricLabel = currentMetricOption?.label ?? t(`home.performance.${metricMode}`);
  const softPrimaryFill = alphaColor(palette.onPrimary, 0.12, "rgba(255,255,255,0.12)");
  const softerPrimaryFill = alphaColor(palette.onPrimary, 0.08, "rgba(255,255,255,0.08)");
  const mediumPrimaryFill = alphaColor(palette.onPrimary, 0.14, "rgba(255,255,255,0.14)");
  const linePrimaryFill = alphaColor(palette.onPrimary, 0.16, "rgba(255,255,255,0.16)");
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
          alignItems: layout.isWideWeb ? "center" : "stretch",
          gap: 14,
        }}
      >
        <View style={{ flex: 1, gap: 10 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                borderRadius: BrandRadius.pill,
                backgroundColor: softPrimaryFill,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <IconSymbol
                name={METRIC_ICONS[metricMode]}
                size={14}
                color={palette.onPrimary as string}
              />
              <Text
                style={{
                  ...BrandType.micro,
                  color: palette.onPrimary as string,
                  opacity: 0.88,
                }}
              >
                {currentMetricLabel}
              </Text>
            </View>
            <Text
              style={{
                ...BrandType.micro,
                color: palette.onPrimary as string,
                opacity: 0.72,
              }}
            >
              {timeframeLabel}
            </Text>
          </View>
          <Text
            accessibilityRole="header"
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <IconSymbol name="sparkles" size={14} color={palette.onPrimary as string} />
            <Text
              style={{
                ...BrandType.micro,
                color: palette.onPrimary as string,
                opacity: 0.76,
                flex: 1,
              }}
              numberOfLines={2}
            >
              {insightLabel}
            </Text>
          </View>
        </View>
        <View
          accessibilityLabel={t("home.performance.metricSelector")}
          style={{
            width: layout.isWideWeb ? 232 : "100%",
            borderRadius: BrandRadius.pill,
            backgroundColor: mediumPrimaryFill,
            flexDirection: "row",
            gap: 4,
            padding: 4,
          }}
        >
          {metricOptions.map((option) => {
            const selected = option.value === metricMode;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={t("home.performance.showMetric", {
                  metric: option.label,
                })}
                onPress={() => onSelectMetric(option.value)}
                style={({ pressed }) => ({
                  minHeight: 36,
                  minWidth: 82,
                  flex: layout.isWideWeb ? undefined : 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  borderRadius: BrandRadius.pill,
                  paddingHorizontal: 12,
                  backgroundColor: selected ? (palette.onPrimary as string) : softerPrimaryFill,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                <IconSymbol
                  name={METRIC_ICONS[option.value]}
                  size={14}
                  color={selected ? (palette.primary as string) : (palette.onPrimary as string)}
                />
                <Text
                  style={{
                    ...BrandType.micro,
                    color: selected ? (palette.primary as string) : (palette.onPrimary as string),
                    opacity: selected ? 1 : 0.76,
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        {...panResponder.panHandlers}
        onLayout={onChartLayout}
        accessibilityLabel={t("home.performance.chartSummary", {
          metric: currentMetricLabel,
          timeframe: timeframeLabel,
          total: totalLabel,
          insight: insightLabel,
        })}
        accessibilityHint={t("home.performance.chartSwipeHint")}
        accessible
        style={{
          height: chartHeight,
          overflow: "hidden",
          borderRadius: BrandRadius.card,
          borderCurve: "continuous",
          backgroundColor: softerPrimaryFill,
          paddingHorizontal: 8,
          paddingTop: 10,
        }}
      >
        <View style={{ flex: 1 }} importantForAccessibility="no-hide-descendants">
          {separators.map((x, idx) => (
            <View
              key={`separator-${String(idx)}`}
              style={{
                position: "absolute",
                left: x.x,
                top: x.yStart,
                bottom: chartHeight - x.yEnd,
                width: 1,
                backgroundColor: linePrimaryFill,
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

      <View
        style={{ marginTop: 2, height: 16, position: "relative" }}
        importantForAccessibility="no-hide-descendants"
      >
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
        accessibilityLabel={t("home.performance.timeframeSelector")}
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
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelectTimeframe(option.value)}
                style={({ pressed }) => ({
                  minHeight: 34,
                  borderRadius: BrandRadius.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 12,
                  backgroundColor: selected ? (palette.onPrimary as string) : softPrimaryFill,
                  opacity: pressed ? 0.9 : 1,
                })}
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
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
