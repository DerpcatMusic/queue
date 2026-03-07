import type { TFunction } from "i18next";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInUp, useAnimatedRef } from "react-native-reanimated";

import {
  HomeSectionHeading,
  HomeSurface,
  useHomeDashboardLayout,
} from "@/components/home/home-dashboard-layout";
import { getRelativeTimeLabel } from "@/components/home/home-shared";
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
  const layout = useHomeDashboardLayout();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const [timeframe, setTimeframe] = useState<Timeframe>("weekly");
  const [metricMode, setMetricMode] = useState<MetricMode>("earnings");

  const timeframeSeries = useMemo(() => {
    const frames = {} as Record<Timeframe, PerformanceTimeframeSeries>;

    (["weekly", "monthly", "yearly"] as const).forEach((frame) => {
      const frameData = getTimeframeData(frame, now, locale);
      const values = Array.from({ length: frameData.bucketStarts.length }, () => 0);

      if (metricMode === "earnings") {
        for (const row of earningsEvents) {
          for (let index = 0; index < frameData.bucketStarts.length; index += 1) {
            const bucketStart = frameData.bucketStarts[index]!;
            const bucketEnd = frameData.bucketEnds[index]!;
            if (row.timestamp >= bucketStart && row.timestamp < bucketEnd) {
              values[index] = (values[index] ?? 0) + row.amountAgorot;
              break;
            }
          }
        }
      } else {
        for (const row of lessonEvents) {
          for (let index = 0; index < frameData.bucketStarts.length; index += 1) {
            const bucketStart = frameData.bucketStarts[index]!;
            const bucketEnd = frameData.bucketEnds[index]!;
            if (row.endTime >= bucketStart && row.endTime < bucketEnd) {
              values[index] = (values[index] ?? 0) + 1;
              break;
            }
          }
        }
      }

      frames[frame] = {
        values,
        axisTicks: frameData.axisTicks,
      };
    });

    return frames;
  }, [earningsEvents, lessonEvents, metricMode, locale, now]);

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
      { value: "earnings", label: "Earnings" },
      { value: "lessons", label: "Lessons" },
    ],
    [],
  );
  const nextSession = upcomingSessions[0] ?? null;
  const readinessLabel = isVerified ? "Verified and ready" : "Needs profile polish";
  const heroTitle = nextSession
    ? `${toSportLabel(nextSession.sport as never)} at ${nextSession.studioName}`
    : `${String(openMatches)} open matches near you`;
  const heroSubtitle = nextSession
    ? [
        formatDateTime(nextSession.startTime, locale),
        getZoneLabel(nextSession.zone, zoneLanguage),
        currencyFormatter.format(nextSession.pay),
      ].join("  ·  ")
    : "Fresh sessions are moving on the board right now.";
  const heroSecondaryLabel = pendingApplications > 0 ? "Pending applications" : "Ready state";
  const heroSecondaryValue =
    pendingApplications > 0
      ? `${String(pendingApplications)} waiting`
      : nextSession
        ? getRelativeTimeLabel(nextSession.startTime, now, locale)
        : "Profile set";
  const visibleSessions = upcomingSessions.slice(0, layout.isWideWeb ? 6 : 4);

  return (
    <View collapsable={false} style={{ flex: 1, backgroundColor: palette.appBg }}>
      <TabScreenScrollView
        animatedRef={scrollRef}
        routeKey="instructor/index"
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
              {readinessLabel}
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
                    {nextSession ? "NEXT LESSON" : "JOBS BOARD"}
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
                    {readinessLabel}
                  </Text>
                  {sports && sports.length > 0 ? (
                    <Text style={{ ...BrandType.caption, color: palette.text as string }}>
                      {sports
                        .slice(0, 4)
                        .map((sport) => toSportLabel(sport as never))
                        .join("  ·  ")}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={{
                    width: layout.actionColumnWidth ?? "100%",
                    gap: 8,
                  }}
                >
                  <KitButton label="Open Jobs" onPress={onOpenJobs} size="sm" fullWidth />
                  <KitButton
                    label="Profile"
                    onPress={onOpenProfile}
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

        <Animated.View entering={FadeInUp.delay(180).duration(320)} style={{ gap: 12 }}>
          <HomeSectionHeading
            title={t("home.instructor.nextTitle")}
            eyebrow="SCHEDULE"
            palette={palette}
          />
          {upcomingSessions.length === 0 ? (
            <HomeSurface palette={palette} style={{ padding: 18, gap: 6 }}>
              <Text style={{ ...BrandType.title, color: palette.text as string }}>
                {t("home.instructor.noUpcoming")}
              </Text>
              <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                The jobs board is still live when you want the next one.
              </Text>
            </HomeSurface>
          ) : (
            <View
              style={{
                flexDirection: layout.isWideWeb ? "row" : "column",
                flexWrap: layout.isWideWeb ? "wrap" : "nowrap",
                gap: 10,
              }}
            >
              {visibleSessions.map((session, index) => (
                <Animated.View
                  key={session.applicationId}
                  entering={FadeInUp.delay(220 + index * 35)
                    .duration(260)
                    .springify()
                    .damping(18)}
                  style={{ width: layout.isWideWeb ? "48.9%" : "100%" }}
                >
                  <HomeSurface
                    palette={palette}
                    style={{
                      flexDirection: "row",
                      alignItems: "stretch",
                      gap: 12,
                      padding: 16,
                    }}
                  >
                    <View
                      style={{
                        width: 72,
                        justifyContent: "space-between",
                        paddingVertical: 2,
                      }}
                    >
                      <Text
                        style={{
                          ...BrandType.heading,
                          fontSize: 24,
                          lineHeight: 24,
                          color: palette.text as string,
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {new Date(session.startTime).toLocaleTimeString(locale, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                      <Text style={{ ...BrandType.micro, color: palette.textMuted as string }}>
                        {getRelativeTimeLabel(session.startTime, now, locale)}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text
                            style={{ ...BrandType.title, color: palette.text as string }}
                            numberOfLines={1}
                          >
                            {toSportLabel(session.sport as never)}
                          </Text>
                          <Text
                            style={{ ...BrandType.micro, color: palette.primary as string }}
                            numberOfLines={1}
                          >
                            {session.studioName}
                          </Text>
                        </View>
                        <Text
                          style={{
                            ...BrandType.title,
                            color: palette.text as string,
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {currencyFormatter.format(session.pay)}
                        </Text>
                      </View>
                      <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                        {[
                          formatDateTime(session.startTime, locale),
                          getZoneLabel(session.zone, zoneLanguage),
                        ].join("  ·  ")}
                      </Text>
                    </View>
                  </HomeSurface>
                </Animated.View>
              ))}
            </View>
          )}
        </Animated.View>
      </TabScreenScrollView>
    </View>
  );
}
