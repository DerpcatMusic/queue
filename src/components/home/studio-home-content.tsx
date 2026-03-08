import { type Href, Link } from "expo-router";
import type { TFunction } from "i18next";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedRef,
  useScrollViewOffset,
} from "react-native-reanimated";
import {
  getHomeHeaderScrollTopPadding,
  HomeHeaderSheet,
} from "@/components/home/home-header-sheet";
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

type RecentJob = {
  jobId: string;
  sport: string;
  status: "open" | "assigned" | "completed" | "cancelled" | "filled";
  zone: string;
  startTime: number;
  endTime: number;
  pay: number;
  pendingApplicationsCount: number;
};

type StudioHomeContentProps = {
  displayName: string;
  profileImageUrl?: string | null | undefined;
  locale: string;
  openJobs: number;
  pendingApplicants: number;
  jobsFilled: number;
  palette: BrandPalette;
  currencyFormatter: Intl.NumberFormat;
  t: TFunction;
  recentJobs: RecentJob[];
  sports: string[] | undefined;
  onOpenJobs: () => void;
  onOpenCalendar: () => void;
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
          accessibilityLabel={label}
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
        <Link.MenuAction
          title="Open"
          icon="arrow.up.forward.app"
          onPress={onPress}
        />
      </Link.Menu>
    </Link>
  );
}

export function StudioHomeContent({
  displayName,
  profileImageUrl,
  locale,
  openJobs,
  pendingApplicants,
  jobsFilled,
  palette,
  currencyFormatter,
  t,
  recentJobs,
  sports,
  onOpenJobs,
  onOpenCalendar,
  onOpenProfile,
}: StudioHomeContentProps) {
  void jobsFilled;
  const { safeTop } = useAppInsets();
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const jobsNeedingReview = recentJobs
    .filter((job) => job.pendingApplicationsCount > 0)
    .slice(0, 3);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef);
  const now = useMemo(() => Date.now(), []);
  const [timeframe, setTimeframe] = useState<Timeframe>("weekly");
  const [metricMode, setMetricMode] = useState<MetricMode>("earnings");
  const timeframeSeries = useMemo(() => {
    const frames = {} as Record<Timeframe, PerformanceTimeframeSeries>;

    (["weekly", "monthly", "yearly"] as const).forEach((frame) => {
      const frameData = getTimeframeData(frame, now, locale);
      const values = frameData.bucketStarts.map((bucketStart, idx) => {
        const bucketEnd = frameData.bucketEnds[idx]!;
        if (metricMode === "earnings") {
          return recentJobs
            .filter(
              (row) =>
                row.startTime >= bucketStart &&
                row.startTime < bucketEnd &&
                row.status !== "cancelled",
            )
            .reduce((sum, row) => sum + row.pay * 100, 0);
        }
        return recentJobs.filter(
          (row) =>
            row.status === "completed" &&
            row.endTime >= bucketStart &&
            row.endTime < bucketEnd,
        ).length;
      });

      frames[frame] = {
        values,
        axisTicks: frameData.axisTicks,
      };
    });

    return frames;
  }, [metricMode, recentJobs, now, locale]);

  const activeSeries = timeframeSeries[timeframe];
  const frameTotal = activeSeries.values.reduce((sum, value) => sum + value, 0);
  const timeframeLabel = t(`home.performance.${timeframe}`);
  const summaryValue =
    metricMode === "earnings"
      ? currencyFormatter.format(frameTotal / 100)
      : `${String(frameTotal)} ${t("home.performance.lessons")}`;

  return (
    <View
      collapsable={false}
      style={{ flex: 1, backgroundColor: palette.appBg }}
    >
      <HomeHeaderSheet
        displayName={displayName}
        profileImageUrl={profileImageUrl}
        scrollY={scrollY}
        palette={palette}
        statsLabel={t("home.studio.stats.openLabel")}
        statsValue={String(openJobs)}
        extraStatsLabel={t("home.studio.stats.pendingLabel")}
        extraStatsValue={String(pendingApplicants)}
        sports={sports}
        onPressAvatar={onOpenProfile}
      />
      <TabScreenScrollView
        animatedRef={scrollRef}
        routeKey="studio/index"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: BrandSpacing.xxl,
          gap: 0,
          paddingTop: getHomeHeaderScrollTopPadding(safeTop),
        }}
      >
        {/* Content starts below sheet — header section removed (handled by HomeHeaderSheet) */}
        <View className="px-6 gap-8">
          <Animated.View
            entering={FadeInUp.delay(100).duration(450).springify().damping(20)}
          >
            <PerformanceHeroCard
              palette={palette}
              timeframe={timeframe}
              metricMode={metricMode}
              timeframeLabel={timeframeLabel}
              totalLabel={summaryValue}
              metricLabel={t(`home.performance.${metricMode}`)}
              seriesByTimeframe={timeframeSeries}
              onToggleMetric={() =>
                setMetricMode((prev) =>
                  prev === "earnings" ? "lessons" : "earnings",
                )
              }
              onSwipeTimeframe={(direction) => {
                setTimeframe((prev) => getAdjacentTimeframe(prev, direction));
              }}
            />
          </Animated.View>

          {/* 3. Layered Metric Tiles */}
          <Animated.View
            entering={FadeInUp.delay(150).duration(450)}
            className="gap-3"
          >
            <View className="flex-row gap-4">
              <MetricTile
                label={t("home.studio.stats.openLabel")}
                value={openJobs}
                palette={palette}
                href="/studio/calendar"
                onPress={onOpenCalendar}
                accentIcon="briefcase.fill"
                accentColor={palette.primary as string}
              />
              <MetricTile
                label={t("home.studio.stats.pendingLabel")}
                value={pendingApplicants}
                palette={palette}
                href="/studio/jobs"
                onPress={onOpenJobs}
                accentIcon="person.3.sequence.fill"
                accentColor={palette.warning as string}
              />
            </View>
          </Animated.View>

          {/* 4. Attention Required Stack */}
          {jobsNeedingReview.length > 0 && (
            <Animated.View
              entering={FadeInUp.delay(200).duration(450)}
              className="gap-5 pt-4"
            >
              <View className="flex-row items-center justify-between">
                <Text
                  className="font-heading text-3xl"
                  style={{ color: palette.text as string }}
                >
                  {t("jobsTab.studioApplicationsTitle")}
                </Text>
                <AppSymbol
                  name="exclamationmark.circle.fill"
                  size={24}
                  tintColor={palette.warning as string}
                />
              </View>
              <View className="gap-6">
                {jobsNeedingReview.map((job, index) => (
                  <Animated.View
                    key={`review-${job.jobId}`}
                    entering={FadeInUp.delay(250 + index * 50)
                      .duration(400)
                      .springify()
                      .damping(18)}
                  >
                    <KitPressable
                      accessibilityRole="button"
                      accessibilityLabel={t("home.actions.jobsTitle")}
                      onPress={onOpenJobs}
                      className="active:opacity-80 rounded-[32px] p-6 border-l-8"
                      style={[
                        {
                          backgroundColor: palette.surface as string,
                          borderCurve: "continuous",
                          borderLeftColor: palette.primary as string,
                          borderColor: palette.border as string,
                        },
                      ]}
                    >
                      <View className="mb-4">
                        <Text
                          className="font-heading text-4xl mb-1"
                          style={{ color: palette.text as string }}
                        >
                          {toSportLabel(job.sport as never)}
                        </Text>
                      </View>

                      <View className="mb-5 flex-row flex-wrap gap-3">
                        <View
                          className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
                          style={{
                            backgroundColor: palette.surfaceAlt as string,
                          }}
                        >
                          <AppSymbol
                            name="calendar"
                            size={12}
                            tintColor={palette.text as string}
                          />
                          <Text
                            className="font-title text-sm"
                            style={{ color: palette.text as string }}
                          >
                            {new Date(job.startTime).toLocaleDateString(locale)}
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
                            {getZoneLabel(job.zone, zoneLanguage)}
                          </Text>
                        </View>
                      </View>

                      <View
                        className="flex-row items-end justify-between border-t border-dashed pt-5"
                        style={{ borderColor: palette.primarySubtle as string }}
                      >
                        <View className="flex-row items-center gap-3">
                          <AppSymbol
                            name="person.3.sequence.fill"
                            size={28}
                            tintColor={palette.primary as string}
                          />
                          <Text
                            className="font-heading text-5xl"
                            style={{
                              color: palette.primary as string,
                              fontVariant: ["tabular-nums"],
                            }}
                          >
                            {job.pendingApplicationsCount}
                          </Text>
                        </View>
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
                            {t("home.studio.stats.pendingLabel")}
                          </Text>
                        </View>
                      </View>
                    </KitPressable>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* 5. Bold Recent Jobs List */}
          <Animated.View
            entering={FadeInUp.delay(
              jobsNeedingReview.length > 0 ? 300 : 200,
            ).duration(450)}
            className="gap-5 pb-10 pt-4"
          >
            <View className="flex-row items-center justify-between">
              <Text
                className="font-heading text-3xl"
                style={{ color: palette.text as string }}
              >
                {t("home.studio.recentTitle")}
              </Text>
              {recentJobs.length > 0 && (
                <AppSymbol
                  name="bag.badge.plus"
                  size={24}
                  tintColor={palette.textMuted as string}
                />
              )}
            </View>

            {recentJobs.length === 0 ? (
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
                    name="bag.badge.plus"
                    size={36}
                    tintColor={palette.textMuted as string}
                  />
                </View>
                <Text
                  className="font-title text-xl text-center"
                  style={{ color: palette.text as string }}
                >
                  {t("home.studio.noRecent")}
                </Text>
              </View>
            ) : (
              <View className="gap-6">
                {recentJobs.slice(0, 3).map((job, index) => (
                  <Animated.View
                    key={job.jobId}
                    entering={FadeInUp.delay(
                      (jobsNeedingReview.length ? 350 : 250) + index * 50,
                    )
                      .duration(400)
                      .springify()
                      .damping(18)}
                  >
                    <View
                      className="rounded-[32px] p-6 border border-b-4"
                      style={{
                        backgroundColor: palette.surfaceElevated as string,
                        borderColor: palette.border as string,
                        borderCurve: "continuous",
                      }}
                    >
                      <View className="mb-4">
                        <Text
                          className="font-heading text-4xl mb-1"
                          style={{ color: palette.text as string }}
                        >
                          {toSportLabel(job.sport as never)}
                        </Text>
                      </View>

                      <View className="mb-5 flex-row flex-wrap gap-3">
                        <View
                          className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
                          style={{
                            backgroundColor: palette.surfaceAlt as string,
                          }}
                        >
                          <AppSymbol
                            name="calendar"
                            size={12}
                            tintColor={palette.text as string}
                          />
                          <Text
                            className="font-title text-sm"
                            style={{ color: palette.text as string }}
                          >
                            {new Date(job.startTime).toLocaleDateString(locale)}
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
                            {getZoneLabel(job.zone, zoneLanguage)}
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
                          {currencyFormatter.format(job.pay)}
                        </Text>
                        <View
                          className="rounded-2xl px-4 py-2"
                          style={{
                            backgroundColor: palette.surfaceAlt as string,
                            borderCurve: "continuous",
                          }}
                        >
                          <Text
                            className="font-title text-sm"
                            style={{ color: palette.text as string }}
                          >
                            {t(`jobsTab.status.job.${job.status}`)}
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
