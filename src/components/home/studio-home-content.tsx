import type { TFunction } from "i18next";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInUp, useAnimatedRef } from "react-native-reanimated";

import {
  HomeSectionHeading,
  HomeSurface,
  useHomeDashboardLayout,
} from "@/components/home/home-dashboard-layout";
import {
  getAdjacentTimeframe,
  getTimeframeData,
  type MetricMode,
  type Timeframe,
} from "@/components/home/performance-chart-math";
import {
  PerformanceHeroCard,
  type PerformanceMetricOption,
  type PerformanceTimeframeOption,
  type PerformanceTimeframeSeries,
} from "@/components/home/performance-hero-card";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { KitButton, KitPressable } from "@/components/ui/kit";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
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
  sports: string[] | undefined;
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
  sports,
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
  const now = useMemo(() => Date.now(), []);
  const [timeframe, setTimeframe] = useState<Timeframe>("weekly");
  const [metricMode, setMetricMode] = useState<MetricMode>("earnings");

  const timeframeSeries = useMemo(() => {
    const frames = {} as Record<Timeframe, PerformanceTimeframeSeries>;

    (["weekly", "monthly", "yearly"] as const).forEach((frame) => {
      const frameData = getTimeframeData(frame, now, locale);
      const values = Array.from({ length: frameData.bucketStarts.length }, () => 0);

      for (const row of recentJobs) {
        const metricValue =
          metricMode === "earnings"
            ? row.status === "cancelled"
              ? 0
              : row.pay * 100
            : row.status === "completed"
              ? 1
              : 0;
        if (metricValue === 0) {
          continue;
        }

        const metricTime = metricMode === "earnings" ? row.startTime : row.endTime;
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
  }, [metricMode, recentJobs, now, locale]);

  const frameTotal = timeframeSeries[timeframe].values.reduce((sum, value) => sum + value, 0);
  const timeframeLabel = t(`home.performance.${timeframe}`);
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
      { value: "earnings", label: "Spend" },
      { value: "lessons", label: "Sessions" },
    ],
    [],
  );
  const priorityJob = jobsNeedingReview[0] ?? recentJobs[0] ?? null;
  const heroTitle =
    jobsNeedingReview.length > 0
      ? "Decisions are waiting"
      : `${String(openJobs)} active jobs on the board`;
  const heroSubtitle = priorityJob
    ? [
        toSportLabel(priorityJob.sport as never),
        formatDateTime(priorityJob.startTime, locale),
        getZoneLabel(priorityJob.zone, zoneLanguage),
      ].join("  ·  ")
    : "Hiring, scheduling, and payout flow stay in one lane here.";
  const heroSecondaryLabel =
    jobsNeedingReview.length > 0 ? "Pending applicants" : "Recently filled";
  const heroSecondaryValue =
    jobsNeedingReview.length > 0
      ? `${String(pendingApplicants)} waiting`
      : `${String(jobsFilled)} closed`;
  const visibleRecentJobs = recentJobs.slice(0, layout.isWideWeb ? 6 : 4);

  return (
    <View collapsable={false} style={{ flex: 1, backgroundColor: palette.appBg }}>
      <TabScreenScrollView
        animatedRef={scrollRef}
        routeKey="studio/index"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.xl,
          paddingTop: safeTop + BrandSpacing.md,
          paddingBottom: BrandSpacing.xxl,
          gap: layout.sectionGap,
        }}
      >
        <Animated.View
          entering={FadeInUp.duration(260)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ ...BrandType.micro, color: palette.textMuted as string }}>
              {jobsNeedingReview.length > 0 ? "Needs review now" : "Studio command"}
            </Text>
            <Text
              style={{
                ...BrandType.display,
                fontSize: 42,
                lineHeight: 44,
                color: palette.text as string,
              }}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            {sports && sports.length > 0 ? (
              <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                {sports
                  .slice(0, 3)
                  .map((sport) => toSportLabel(sport as never))
                  .join("  ·  ")}
              </Text>
            ) : null}
          </View>
          <KitPressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={onOpenProfile}
            style={{ borderRadius: BrandRadius.card }}
          >
            <ProfileAvatar
              imageUrl={profileImageUrl}
              fallbackName={displayName}
              palette={palette}
              size={66}
              roundedSquare
            />
          </KitPressable>
        </Animated.View>

        <View
          style={{
            flexDirection: layout.isWideWeb ? "row" : "column",
            alignItems: "stretch",
            gap: layout.topRowGap,
          }}
        >
          <Animated.View
            entering={FadeInUp.delay(80).duration(300)}
            style={{ flex: layout.heroFlex }}
          >
            <HomeSurface
              palette={palette}
              style={{
                minHeight: layout.railMinHeight,
                padding: layout.isWideWeb ? 28 : 22,
                gap: 22,
                justifyContent: "space-between",
              }}
            >
              <View style={{ gap: 18 }}>
                <View style={{ gap: 6 }}>
                  <Text
                    style={{
                      ...BrandType.micro,
                      color: palette.textMuted as string,
                      letterSpacing: 0.8,
                    }}
                  >
                    {jobsNeedingReview.length > 0 ? "REVIEW QUEUE" : "OPERATIONS"}
                  </Text>
                  <Text
                    style={{
                      ...BrandType.heading,
                      fontSize: layout.isWideWeb ? 38 : 34,
                      lineHeight: layout.isWideWeb ? 40 : 36,
                      color: palette.text as string,
                    }}
                  >
                    {heroTitle}
                  </Text>
                  <Text style={{ ...BrandType.body, color: palette.textMuted as string }}>
                    {heroSubtitle}
                  </Text>
                </View>

                <View style={{ gap: 8 }}>
                  <Text style={{ ...BrandType.micro, color: palette.primary as string }}>
                    {heroSecondaryLabel}
                  </Text>
                  <Text
                    style={{
                      ...BrandType.title,
                      fontSize: 28,
                      lineHeight: 30,
                      color: palette.text as string,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {heroSecondaryValue}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: layout.isWideWeb ? "row" : "column",
                  alignItems: layout.isWideWeb ? "flex-end" : "stretch",
                  gap: 16,
                }}
              >
                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={{ ...BrandType.micro, color: palette.textMuted as string }}>
                    {jobsNeedingReview.length > 0
                      ? "Review applicants first, then lock the schedule."
                      : "Calendar stays one tap away when you need to place the next session."}
                  </Text>
                </View>
                <View
                  style={{
                    width: layout.actionColumnWidth ?? "100%",
                    gap: 8,
                  }}
                >
                  <KitButton label="Open Jobs" onPress={onOpenJobs} size="sm" fullWidth />
                  <KitButton
                    label="Calendar"
                    onPress={onOpenCalendar}
                    variant="secondary"
                    size="sm"
                    fullWidth
                    style={{ backgroundColor: palette.appBg as string }}
                  />
                </View>
              </View>
            </HomeSurface>
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(120).duration(320)}
            style={{ flex: layout.chartFlex }}
          >
            <PerformanceHeroCard
              palette={palette}
              timeframe={timeframe}
              metricMode={metricMode}
              timeframeLabel={timeframeLabel}
              totalLabel={summaryValue}
              metricOptions={metricOptions}
              timeframeOptions={timeframeOptions}
              seriesByTimeframe={timeframeSeries}
              onSelectMetric={setMetricMode}
              onSelectTimeframe={setTimeframe}
              onSwipeTimeframe={(direction) => {
                setTimeframe((prev) => getAdjacentTimeframe(prev, direction));
              }}
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
              <HomeSectionHeading title="Needs review" eyebrow="QUEUE" palette={palette} />
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
              eyebrow="LIVE BOARD"
              palette={palette}
            />
            {recentJobs.length === 0 ? (
              <HomeSurface palette={palette} style={{ padding: 18, gap: 6 }}>
                <Text style={{ ...BrandType.title, color: palette.text as string }}>
                  {t("home.studio.noRecent")}
                </Text>
                <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                  Post a shift and start filling your upcoming schedule.
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
