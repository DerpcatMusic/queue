import { type Href, Link } from "expo-router";
import type { TFunction } from "i18next";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInUp, useAnimatedRef, useScrollViewOffset } from "react-native-reanimated";
import {
  getHomeHeaderScrollTopPadding,
  HomeHeaderSheet,
} from "@/components/home/home-header-sheet";
import { getRelativeTimeLabel } from "@/components/home/home-shared";
import {
  getAdjacentTimeframe,
  getTimeframeData,
  type MetricMode,
  type Timeframe,
} from "@/components/home/performance-chart-math";
import {
  PerformanceHeroCard,
  type PerformanceTimeframeSeries,
} from "@/components/home/performance-hero-card";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { AppSymbol } from "@/components/ui/app-symbol";
import { KitPressable } from "@/components/ui/kit";
import type { BrandPalette } from "@/constants/brand";
import { BrandSpacing } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { toSportLabel } from "@/convex/constants";
import { useAppInsets } from "@/hooks/use-app-insets";
import { formatDateTime } from "@/lib/jobs-utils";

type UpcomingSession = {
  applicationId: string;
  sport: string;
  studioName: string;
  zone: string;
  startTime: number;
  pay: number;
};

type InstructorPaymentRow = {
  timestamp: number;
  amountAgorot: number;
};

type InstructorApplicationRow = {
  endTime: number;
};

type InstructorHomeContentProps = {
  displayName: string;
  profileImageUrl?: string | null | undefined;
  isVerified?: boolean;
  locale: string;
  openMatches: number;
  pendingApplications: number;
  totalEarningsAgorot: number;
  palette: BrandPalette;
  currencyFormatter: Intl.NumberFormat;
  t: TFunction;
  earningsEvents: InstructorPaymentRow[];
  lessonEvents: InstructorApplicationRow[];
  upcomingSessions: UpcomingSession[];
  sports: string[] | undefined;
  onOpenJobs: () => void;
  onOpenProfile: () => void;
};

type MetricTileProps = {
  label: string;
  value: number;
  palette: BrandPalette;
  href: Href;
  onPress: () => void;
  accentIcon: string;
  accentColor: string;
};

function MetricTile({
  label,
  value,
  palette,
  href,
  onPress,
  accentIcon,
  accentColor,
}: MetricTileProps) {
  return (
    <Link href={href} asChild>
      <Link.Trigger>
        <KitPressable
          accessibilityRole="link"
          accessibilityLabel={`${label}: ${String(value)}`}
          accessibilityValue={{ text: String(value) }}
          haptic="selection"
          className="active:opacity-80 flex-1 rounded-[32px] p-6 justify-between gap-6"
          style={{
            backgroundColor: palette.surfaceAlt as string,
            borderCurve: "continuous",
          }}
        >
          <View className="flex-row items-start justify-between">
            <Text
              className="font-heading text-5xl"
              style={{
                color: palette.text as string,
                fontVariant: ["tabular-nums"],
              }}
            >
              {value}
            </Text>
            <View
              className="h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: palette.surface as string }}
            >
              <AppSymbol name={accentIcon} size={20} tintColor={accentColor} />
            </View>
          </View>
          <Text
            className="font-bodyStrong text-sm opacity-80"
            style={{ color: palette.text as string }}
          >
            {label}
          </Text>
        </KitPressable>
      </Link.Trigger>
      <Link.Menu>
        <Link.MenuAction title="Open" icon="arrow.up.forward.app" onPress={onPress} />
      </Link.Menu>
    </Link>
  );
}

export function InstructorHomeContent({
  displayName,
  profileImageUrl,
  isVerified = false,
  locale,
  openMatches,
  pendingApplications,
  totalEarningsAgorot,
  palette,
  currencyFormatter,
  t,
  earningsEvents,
  lessonEvents,
  upcomingSessions,
  sports,
  onOpenJobs,
  onOpenProfile,
}: InstructorHomeContentProps) {
  void totalEarningsAgorot;
  const now = useMemo(() => Date.now(), []);
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const { safeTop } = useAppInsets();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef);
  const [timeframe, setTimeframe] = useState<Timeframe>("weekly");
  const [metricMode, setMetricMode] = useState<MetricMode>("earnings");

  const timeframeSeries = useMemo(() => {
    const frames = {} as Record<Timeframe, PerformanceTimeframeSeries>;

    (["weekly", "monthly", "yearly"] as const).forEach((frame) => {
      const frameData = getTimeframeData(frame, now, locale);
      const values = frameData.bucketStarts.map((bucketStart, idx) => {
        const bucketEnd = frameData.bucketEnds[idx]!;
        if (metricMode === "earnings") {
          return earningsEvents
            .filter((row) => row.timestamp >= bucketStart && row.timestamp < bucketEnd)
            .reduce((sum, row) => sum + row.amountAgorot, 0);
        }
        return lessonEvents.filter((row) => row.endTime >= bucketStart && row.endTime < bucketEnd)
          .length;
      });

      frames[frame] = {
        values,
        axisTicks: frameData.axisTicks,
      };
    });

    return frames;
  }, [earningsEvents, lessonEvents, metricMode, locale, now]);

  const activeSeries = timeframeSeries[timeframe];
  const frameTotal = activeSeries.values.reduce((sum, value) => sum + value, 0);
  const timeframeLabel = t(`home.performance.${timeframe}`);
  const summaryValue =
    metricMode === "earnings"
      ? currencyFormatter.format(frameTotal / 100)
      : `${String(frameTotal)} ${t("home.performance.lessons")}`;

  return (
    <View collapsable={false} style={{ flex: 1, backgroundColor: palette.appBg }}>
      <HomeHeaderSheet
        displayName={displayName}
        profileImageUrl={profileImageUrl}
        scrollY={scrollY}
        palette={palette}
        statsLabel={t("home.instructor.stats.matchesLabel")}
        statsValue={String(openMatches)}
        extraStatsLabel={t("home.instructor.stats.pendingLabel")}
        extraStatsValue={String(pendingApplications)}
        isVerified={isVerified}
        sports={sports}
        onPressAvatar={onOpenProfile}
      />
      <TabScreenScrollView
        animatedRef={scrollRef}
        routeKey="instructor/index"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: BrandSpacing.xxl,
          gap: 0,
          paddingTop: getHomeHeaderScrollTopPadding(safeTop),
        }}
      >
        {/* Content starts below sheet — header section removed (handled by HomeHeaderSheet) */}
        <View className="px-6 gap-8">
          <Animated.View entering={FadeInUp.delay(100).duration(450).springify().damping(20)}>
            <PerformanceHeroCard
              palette={palette}
              timeframe={timeframe}
              metricMode={metricMode}
              timeframeLabel={timeframeLabel}
              totalLabel={summaryValue}
              metricLabel={t(`home.performance.${metricMode}`)}
              seriesByTimeframe={timeframeSeries}
              onToggleMetric={() =>
                setMetricMode((prev) => (prev === "earnings" ? "lessons" : "earnings"))
              }
              onSwipeTimeframe={(direction) => {
                setTimeframe((prev) => getAdjacentTimeframe(prev, direction));
              }}
            />
          </Animated.View>

          {/* 3. Layered Metric Tiles */}
          <Animated.View entering={FadeInUp.delay(150).duration(450)} className="gap-3">
            <View className="flex-row gap-4">
              <MetricTile
                label={t("home.instructor.stats.matchesLabel")}
                value={openMatches}
                palette={palette}
                href="/instructor/jobs"
                onPress={onOpenJobs}
                accentIcon="flame.fill"
                accentColor={palette.primary as string}
              />
              <MetricTile
                label={t("home.instructor.stats.pendingLabel")}
                value={pendingApplications}
                palette={palette}
                href="/instructor/jobs"
                onPress={onOpenJobs}
                accentIcon="clock.fill"
                accentColor={palette.warning as string}
              />
            </View>
          </Animated.View>

          {/* 4. Bold Upcoming Sessions List */}
          <Animated.View entering={FadeInUp.delay(200).duration(450)} className="gap-5 pb-10 pt-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-heading text-3xl" style={{ color: palette.text as string }}>
                {t("home.instructor.nextTitle")}
              </Text>
              {upcomingSessions.length > 0 && (
                <AppSymbol
                  name="calendar.badge.clock"
                  size={24}
                  tintColor={palette.textMuted as string}
                />
              )}
            </View>

            {upcomingSessions.length === 0 ? (
              <View
                className="items-center gap-4 rounded-[32px] p-10 border-2 border-dashed"
                style={{
                  backgroundColor: palette.surface as string,
                  borderColor: palette.border as string,
                  borderCurve: "continuous",
                }}
              >
                <View
                  className="h-20 w-20 items-center justify-center rounded-full"
                  style={{ backgroundColor: palette.surfaceAlt as string }}
                >
                  <AppSymbol
                    name="gym.bag.fill"
                    size={36}
                    tintColor={palette.textMuted as string}
                  />
                </View>
                <Text
                  className="font-title text-xl text-center"
                  style={{ color: palette.text as string }}
                >
                  {t("home.instructor.noUpcoming")}
                </Text>
                <Text
                  className="font-body text-base text-center"
                  style={{ color: palette.textMuted as string }}
                >
                  {t("home.actions.jobsSubtitle", { count: openMatches })}
                </Text>
              </View>
            ) : (
              <View className="gap-6">
                {upcomingSessions.map((session, index) => (
                  <Animated.View
                    key={session.applicationId}
                    entering={FadeInUp.delay(250 + index * 50)
                      .duration(400)
                      .springify()
                      .damping(18)}
                  >
                    <View
                      className="rounded-[32px] p-6 border-l-8"
                      style={{
                        backgroundColor: palette.surface as string,
                        borderCurve: "continuous",
                        borderLeftColor: palette.primary as string,
                      }}
                    >
                      <View className="mb-4">
                        <Text
                          className="font-heading text-4xl mb-1"
                          style={{ color: palette.text as string }}
                        >
                          {toSportLabel(session.sport as never)}
                        </Text>
                        <View className="flex-row items-center gap-2">
                          <AppSymbol
                            name="building.2.fill"
                            size={14}
                            tintColor={palette.textMuted as string}
                          />
                          <Text
                            className="font-bodyStrong text-base"
                            style={{ color: palette.textMuted as string }}
                          >
                            {session.studioName}
                          </Text>
                        </View>
                      </View>

                      <View className="mb-5 flex-row flex-wrap gap-3">
                        <View
                          className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
                          style={{
                            backgroundColor: palette.surfaceAlt as string,
                          }}
                        >
                          <AppSymbol
                            name="clock.fill"
                            size={12}
                            tintColor={palette.text as string}
                          />
                          <Text
                            className="font-title text-sm"
                            style={{ color: palette.text as string }}
                          >
                            {formatDateTime(session.startTime, locale)}
                          </Text>
                        </View>
                        <View
                          className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
                          style={{
                            backgroundColor: palette.surfaceAlt as string,
                          }}
                        >
                          <AppSymbol
                            name="mappin.and.ellipse"
                            size={12}
                            tintColor={palette.text as string}
                          />
                          <Text
                            className="font-title text-sm"
                            style={{ color: palette.text as string }}
                          >
                            {getZoneLabel(session.zone, zoneLanguage)}
                          </Text>
                        </View>
                      </View>

                      <View
                        className="flex-row items-end justify-between border-t border-dashed pt-5"
                        style={{ borderColor: palette.borderStrong as string }}
                      >
                        <Text
                          className="font-heading text-5xl"
                          style={{
                            color: palette.text as string,
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {currencyFormatter.format(session.pay)}
                        </Text>
                        <View
                          className="rounded-2xl px-4 py-2"
                          style={{
                            backgroundColor: palette.primarySubtle as string,
                            borderCurve: "continuous",
                          }}
                        >
                          <Text
                            className="font-title text-sm"
                            style={{ color: palette.primary as string }}
                          >
                            {getRelativeTimeLabel(session.startTime, now, locale)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                ))}
              </View>
            )}
          </Animated.View>
        </View>
      </TabScreenScrollView>
    </View>
  );
}
