import type { TFunction } from "i18next";
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedRef,
  useScrollViewOffset,
} from "react-native-reanimated";

import {
  HomeSectionHeading,
  HomeSurface,
  useHomeDashboardLayout,
} from "@/components/home/home-dashboard-layout";
import {
  getHomeHeaderScrollTopPadding,
  HomeHeaderSheet,
} from "@/components/home/home-header-sheet";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
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

  const heroTitle =
    jobsNeedingReview.length > 0
      ? t("home.studio.heroReview", { defaultValue: "Decisions are waiting" })
      : t("home.studio.heroActive", {
          count: openJobs,
          defaultValue: `${String(openJobs)} active jobs on the board`,
        });

  const heroSecondaryLabel =
    jobsNeedingReview.length > 0
      ? t("home.studio.pendingApplicants", {
          defaultValue: "Pending applicants",
        })
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
  const leadAction = jobsNeedingReview.length > 0 ? onOpenJobs : onOpenCalendar;
  const leadActionHint =
    jobsNeedingReview.length > 0
      ? t("home.actions.jobsTitle", { defaultValue: "Open jobs" })
      : t("home.actions.calendarTitle", { defaultValue: "Open calendar" });

  const visibleRecentJobs = recentJobs.slice(0, layout.isWideWeb ? 6 : 4);

  return (
    <View
      collapsable={false}
      style={{ flex: 1, backgroundColor: palette.appBg }}
    >
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
        routeKey="studio/index"
        style={{ flex: 1 }}
        topInsetTone="sheet"
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.xl,
          paddingTop: getHomeHeaderScrollTopPadding(safeTop),
          paddingBottom: BrandSpacing.xxl,
          gap: BrandSpacing.xl,
        }}
      >
        <Animated.View entering={FadeInUp.delay(80).duration(280)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={leadActionHint}
            onPress={leadAction}
            style={({ pressed }) => ({
              opacity: pressed ? 0.94 : 1,
              transform: [{ scale: pressed ? 0.995 : 1 }],
            })}
          >
            <HomeSurface
              palette={palette}
              tone="surface"
              style={{
                padding: BrandSpacing.xl,
                gap: BrandSpacing.md,
              }}
            >
              <View style={{ gap: 6 }}>
                <Text
                  style={{
                    ...BrandType.micro,
                    color: palette.textMuted as string,
                    letterSpacing: 0.8,
                  }}
                >
                  {jobsNeedingReview.length > 0
                    ? t("home.studio.eyebrowReview", {
                        defaultValue: "REVIEW QUEUE",
                      })
                    : t("home.studio.eyebrowOps", {
                        defaultValue: "OPERATIONS",
                      })}
                </Text>
                <Text
                  style={{
                    ...BrandType.heading,
                    fontSize: layout.isWideWeb ? 30 : 24,
                    lineHeight: layout.isWideWeb ? 32 : 26,
                    color: palette.text as string,
                  }}
                >
                  {heroTitle}
                </Text>
                <Text
                  style={{
                    ...BrandType.body,
                    color: palette.textMuted as string,
                  }}
                >
                  {jobsNeedingReview.length > 0
                    ? t("home.studio.waitingCount", {
                        count: pendingApplicants,
                        defaultValue: `${String(pendingApplicants)} waiting`,
                      })
                    : t("home.studio.heroActive", {
                        count: openJobs,
                        defaultValue: `${String(openJobs)} active jobs on the board`,
                      })}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: layout.isWideWeb ? "row" : "column",
                  alignItems: layout.isWideWeb ? "center" : "stretch",
                  justifyContent: "space-between",
                  gap: BrandSpacing.md,
                }}
              >
                <Text
                  style={{
                    ...BrandType.bodyStrong,
                    color: palette.primary as string,
                  }}
                >
                  {`${heroSecondaryLabel}: ${heroSecondaryValue}`}
                </Text>
                <Text
                  style={{
                    ...BrandType.micro,
                    color: palette.textMuted as string,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                  }}
                >
                  {leadActionHint}
                </Text>
              </View>
            </HomeSurface>
          </Pressable>
        </Animated.View>

        <View
          style={{
            flexDirection:
              layout.isWideWeb && jobsNeedingReview.length > 0
                ? "row"
                : "column",
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
                title={t("home.studio.needsReview", {
                  defaultValue: "Needs review",
                })}
                eyebrow={t("home.studio.queueEyebrow", {
                  defaultValue: "QUEUE",
                })}
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
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("home.actions.jobsTitle")}
                      onPress={onOpenJobs}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.94 : 1,
                      })}
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
                            <Text
                              style={{
                                ...BrandType.title,
                                color: palette.text as string,
                              }}
                            >
                              {toSportLabel(job.sport as never)}
                            </Text>
                            <Text
                              style={{
                                ...BrandType.caption,
                                color: palette.textMuted as string,
                              }}
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
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          ) : null}

          <Animated.View
            entering={FadeInUp.delay(
              jobsNeedingReview.length > 0 ? 220 : 180,
            ).duration(320)}
            style={{
              flex:
                layout.isWideWeb && jobsNeedingReview.length > 0
                  ? 0.92
                  : undefined,
              gap: 12,
            }}
          >
            <HomeSectionHeading
              title={t("home.studio.recentTitle")}
              eyebrow={t("home.studio.boardEyebrow", {
                defaultValue: "LIVE BOARD",
              })}
              palette={palette}
            />
            {recentJobs.length === 0 ? (
              <HomeSurface palette={palette} style={{ padding: 18, gap: 6 }}>
                <Text
                  style={{ ...BrandType.title, color: palette.text as string }}
                >
                  {t("home.studio.noRecent")}
                </Text>
                <Text
                  style={{
                    ...BrandType.caption,
                    color: palette.textMuted as string,
                  }}
                >
                  {t("home.studio.emptyBoard", {
                    defaultValue:
                      "Post a shift to start filling your schedule.",
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
                    <HomeSurface
                      palette={palette}
                      style={{ padding: 16, gap: 4 }}
                    >
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
                            style={{
                              ...BrandType.title,
                              color: palette.text as string,
                            }}
                          >
                            {toSportLabel(job.sport as never)}
                          </Text>
                          <Text
                            style={{
                              ...BrandType.caption,
                              color: palette.textMuted as string,
                            }}
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
