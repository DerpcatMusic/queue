import type { TFunction } from "i18next";
import { useMemo } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInUp, useAnimatedRef, useScrollViewOffset } from "react-native-reanimated";

import {
  HomeSectionHeading,
  HomeSurface,
  useHomeDashboardLayout,
} from "@/components/home/home-dashboard-layout";
import {
  getHomeHeaderScrollTopPadding,
  HomeHeaderSheet,
} from "@/components/home/home-header-sheet";
import { HomeStatsRow } from "@/components/home/home-stats-row";
import {
  getTimeframeData,
  type MetricMode,
  type Timeframe,
} from "@/components/home/performance-chart-math";
import {
  PerformanceHeroCard,
  type PerformanceTimeframeSeries,
} from "@/components/home/performance-hero-card";
import { usePerformanceChart } from "@/components/home/use-performance-chart";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { KitButton, KitPressable } from "@/components/ui/kit";
import type { BrandPalette } from "@/constants/brand";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { toSportLabel } from "@/convex/constants";
import { useAppInsets } from "@/hooks/use-app-insets";
import { formatDateTime } from "@/lib/jobs-utils";

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
  onOpenJobs: () => void;
  onOpenCalendar: () => void;
  onOpenProfile: () => void;
};

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
  onOpenJobs,
  onOpenCalendar,
  onOpenProfile,
}: StudioHomeContentProps) {
  const { safeTop } = useAppInsets();
  const layout = useHomeDashboardLayout();
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const jobsNeedingReview = recentJobs
    .filter((job) => job.pendingApplicationsCount > 0)
    .slice(0, 4);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef);
  const now = useMemo(() => Date.now(), []);

  const computeSeries = useMemo(() => {
    return (currentMetricMode: MetricMode) => {
      const frames = {} as Record<Timeframe, PerformanceTimeframeSeries>;

      (["weekly", "monthly", "yearly"] as const).forEach((frame) => {
        const frameData = getTimeframeData(frame, now, locale);
        const values = Array.from({ length: frameData.bucketStarts.length }, () => 0);

        for (const row of recentJobs) {
          const metricValue =
            currentMetricMode === "earnings"
              ? row.status === "cancelled"
                ? 0
                : row.pay * 100
              : row.status === "completed"
                ? 1
                : 0;
          if (metricValue === 0) continue;

          const metricTime = currentMetricMode === "earnings" ? row.startTime : row.endTime;
          for (let index = 0; index < frameData.bucketStarts.length; index += 1) {
            const bucketStart = frameData.bucketStarts[index]!;
            const bucketEnd = frameData.bucketEnds[index]!;
            if (metricTime >= bucketStart && metricTime < bucketEnd) {
              values[index] = (values[index] ?? 0) + metricValue;
              break;
            }
          }
        }

        frames[frame] = {
          values,
          axisTicks: frameData.axisTicks,
        };
      });

      return frames;
    };
  }, [recentJobs, locale, now]);

  const chart = usePerformanceChart({
    computeSeries,
    currencyFormatter,
    metricLabels: {
      earnings: t("home.performance.spend", { defaultValue: "Spend" }),
      lessons: t("home.performance.sessions", { defaultValue: "Sessions" }),
    },
    t,
  });

  const heroTitle =
    jobsNeedingReview.length > 0
      ? t("home.studio.heroReview", { defaultValue: "Decisions are waiting" })
      : t("home.studio.heroActive", {
          count: openJobs,
          defaultValue: `${String(openJobs)} active jobs on the board`,
        });

  const heroSecondaryLabel =
    jobsNeedingReview.length > 0
      ? t("home.studio.pendingApplicants", { defaultValue: "Pending applicants" })
      : t("home.studio.recentlyFilled", { defaultValue: "Recently filled" });

  const heroSecondaryValue =
    jobsNeedingReview.length > 0
      ? t("home.studio.waitingCount", {
          count: pendingApplicants,
          defaultValue: `${String(pendingApplicants)} waiting`,
        })
      : t("home.studio.closedCount", {
          count: jobsFilled,
          defaultValue: `${String(jobsFilled)} closed`,
        });

  const visibleRecentJobs = recentJobs.slice(0, layout.isWideWeb ? 6 : 4);

  return (
    <View collapsable={false} style={{ flex: 1, backgroundColor: palette.appBg }}>
      <HomeHeaderSheet
        displayName={displayName}
        subtitle={t("home.studio.role", { defaultValue: "Studio" })}
        profileImageUrl={profileImageUrl}
        scrollY={scrollY}
        palette={palette}
        onPressAvatar={onOpenProfile}
      />
      <TabScreenScrollView
        animatedRef={scrollRef}
        style={{ flex: 1 }}
        topInsetTone="sheet"
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.xl,
          paddingTop: getHomeHeaderScrollTopPadding(safeTop),
          paddingBottom: BrandSpacing.xxl,
          gap: layout.sectionGap,
        }}
      >
        <View
          style={{
            flexDirection: layout.isWideWeb ? "row" : "column",
            alignItems: "stretch",
            gap: layout.topRowGap,
          }}
        >
          <Animated.View
            entering={FadeInUp.delay(80).duration(300)}
            style={{ flex: layout.heroFlex, gap: layout.sectionGap }}
          >
            {/* Collapsed Hero Card */}
            <HomeSurface
              palette={palette}
              style={{
                padding: BrandSpacing.lg,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: BrandSpacing.md,
                minHeight: layout.railMinHeight,
              }}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={{
                    ...BrandType.micro,
                    color: palette.textMuted as string,
                    letterSpacing: 0.8,
                  }}
                >
                  {jobsNeedingReview.length > 0
                    ? t("home.studio.eyebrowReview", { defaultValue: "REVIEW QUEUE" })
                    : t("home.studio.eyebrowOps", { defaultValue: "OPERATIONS" })}
                </Text>
                <Text
                  style={{
                    ...BrandType.heading,
                    fontSize: 20,
                    color: palette.text as string,
                  }}
                  numberOfLines={1}
                >
                  {heroTitle}
                </Text>
              </View>
              <KitButton
                label={
                  jobsNeedingReview.length > 0
                    ? t("home.actions.jobsTitle", { defaultValue: "Open Jobs" })
                    : t("home.actions.calendarTitle", { defaultValue: "Calendar" })
                }
                onPress={jobsNeedingReview.length > 0 ? onOpenJobs : onOpenCalendar}
                size="sm"
              />
            </HomeSurface>

            {/* Inline Stats Row */}
            <View style={{ marginHorizontal: -BrandSpacing.xl }}>
              <HomeStatsRow
                palette={palette}
                stats={[
                  {
                    label: t("jobsTab.title", { defaultValue: "Open jobs" }),
                    value: String(openJobs),
                  },
                  {
                    label: t("jobsTab.pending", { defaultValue: "Pending" }),
                    value: String(pendingApplicants),
                  },
                  {
                    label: heroSecondaryLabel,
                    value: heroSecondaryValue,
                  },
                ]}
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(120).duration(320)}
            style={{ flex: layout.chartFlex }}
          >
            <PerformanceHeroCard
              palette={palette}
              timeframe={chart.timeframe}
              metricMode={chart.metricMode}
              timeframeLabel={chart.timeframeLabel}
              insightLabel={chart.insightLabel}
              totalLabel={chart.summaryValue}
              metricOptions={chart.metricOptions}
              timeframeOptions={chart.timeframeOptions}
              seriesByTimeframe={chart.seriesByTimeframe}
              onSelectMetric={chart.setMetricMode}
              onSelectTimeframe={chart.setTimeframe}
              onSwipeTimeframe={chart.handleSwipeTimeframe}
            />
          </Animated.View>
        </View>

        <View
          style={{
            flexDirection: layout.isWideWeb && jobsNeedingReview.length > 0 ? "row" : "column",
            alignItems: "stretch",
            gap: layout.sectionGap,
          }}
        >
          {jobsNeedingReview.length > 0 ? (
            <Animated.View
              entering={FadeInUp.delay(180).duration(320)}
              style={{ flex: layout.isWideWeb ? 1.08 : undefined, gap: 12 }}
            >
              <HomeSectionHeading
                title={t("home.studio.needsReview", { defaultValue: "Needs review" })}
                eyebrow={t("home.studio.queueEyebrow", { defaultValue: "QUEUE" })}
                palette={palette}
              />
              <View style={{ gap: 10 }}>
                {jobsNeedingReview.map((job, index) => (
                  <Animated.View
                    key={job.jobId}
                    entering={FadeInUp.delay(220 + index * 35)
                      .duration(260)
                      .springify()
                      .damping(18)}
                  >
                    <KitPressable
                      accessibilityRole="button"
                      accessibilityLabel={t("home.actions.jobsTitle")}
                      onPress={onOpenJobs}
                    >
                      <HomeSurface palette={palette} style={{ padding: 16 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <View style={{ flex: 1, gap: 3 }}>
                            <Text style={{ ...BrandType.title, color: palette.text as string }}>
                              {toSportLabel(job.sport as never)}
                            </Text>
                            <Text
                              style={{ ...BrandType.caption, color: palette.textMuted as string }}
                            >
                              {[
                                formatDateTime(job.startTime, locale),
                                getZoneLabel(job.zone, zoneLanguage),
                              ].join("  ·  ")}
                            </Text>
                          </View>
                          <Text
                            selectable
                            style={{
                              ...BrandType.heading,
                              fontSize: 28,
                              lineHeight: 28,
                              color: palette.primary as string,
                              fontVariant: ["tabular-nums"],
                            }}
                          >
                            {String(job.pendingApplicationsCount)}
                          </Text>
                        </View>
                      </HomeSurface>
                    </KitPressable>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          ) : null}

          <Animated.View
            entering={FadeInUp.delay(jobsNeedingReview.length > 0 ? 220 : 180).duration(320)}
            style={{
              flex: layout.isWideWeb && jobsNeedingReview.length > 0 ? 0.92 : undefined,
              gap: 12,
            }}
          >
            <HomeSectionHeading
              title={t("home.studio.recentTitle")}
              eyebrow={t("home.studio.boardEyebrow", { defaultValue: "LIVE BOARD" })}
              palette={palette}
            />
            {recentJobs.length === 0 ? (
              <HomeSurface palette={palette} style={{ padding: 18, gap: 6 }}>
                <Text style={{ ...BrandType.title, color: palette.text as string }}>
                  {t("home.studio.noRecent")}
                </Text>
                <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                  {t("home.studio.emptyBoard", {
                    defaultValue: "Post a shift to start filling your schedule.",
                  })}
                </Text>
              </HomeSurface>
            ) : (
              <View style={{ gap: 10 }}>
                {visibleRecentJobs.map((job, index) => (
                  <Animated.View
                    key={job.jobId}
                    entering={FadeInUp.delay(260 + index * 35)
                      .duration(260)
                      .springify()
                      .damping(18)}
                  >
                    <HomeSurface palette={palette} style={{ padding: 16, gap: 4 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={{ ...BrandType.title, color: palette.text as string }}>
                            {toSportLabel(job.sport as never)}
                          </Text>
                          <Text
                            style={{ ...BrandType.caption, color: palette.textMuted as string }}
                          >
                            {[
                              formatDateTime(job.startTime, locale),
                              getZoneLabel(job.zone, zoneLanguage),
                            ].join("  ·  ")}
                          </Text>
                        </View>
                        <Text
                          selectable
                          style={{
                            ...BrandType.title,
                            color: palette.text as string,
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {currencyFormatter.format(job.pay)}
                        </Text>
                      </View>
                    </HomeSurface>
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
