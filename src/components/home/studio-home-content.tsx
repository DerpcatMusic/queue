import type { TFunction } from "i18next";
import { memo, useCallback, useMemo, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import {
  HomeSectionHeading,
  HomeSurface,
  useHomeDashboardLayout,
} from "@/components/home/home-dashboard-layout";
import { getHomeHeaderScrollTopPadding } from "@/components/home/home-header-sheet";
import { HomeSignalTile } from "@/components/home/home-shared";
import type { Application } from "@/components/home/home-tab/home-role-content";
import { JobCarouselDots } from "@/components/home/job-carousel-dots";
import { useScrollSheetBindings } from "@/components/layout/scroll-sheet-provider";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useTheme } from "@/hooks/use-theme";
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
  applications?: Application[];
};

type StudioHomeContentProps = {
  locale: string;
  openJobs: number;
  pendingApplicants: number;
  jobsFilled: number;
  currencyFormatter: Intl.NumberFormat;
  t: TFunction;
  recentJobs: RecentJob[];
  onOpenJobs: () => void;
  onOpenCalendar: () => void;
  reviewApplication: (args: {
    applicationId: Id<"jobApplications">;
    status: "accepted" | "rejected";
  }) => Promise<{ ok: boolean }>;
};

const ReviewQueueEmptyState = memo(function ReviewQueueEmptyState({ t }: { t: TFunction }) {
  const { color: palette } = useTheme();
  return (
    <HomeSurface style={{ padding: BrandSpacing.inset }}>
      <View style={{ alignItems: "center", gap: BrandSpacing.stackTight }}>
        <IconSymbol name="checkmark.circle.fill" size={28} color={palette.success} />
        <Text style={BrandType.title}>{t("home.studio.noReviewJobs")}</Text>
        <Text
          style={{
            ...BrandType.caption,
            textAlign: "center",
            color: palette.textMuted,
          }}
        >
          {t("home.studio.noReviewJobsHint")}
        </Text>
      </View>
    </HomeSurface>
  );
});

const ReviewApplicationCard = memo(function ReviewApplicationCard({
  application,
  job,
  locale,
  zoneLanguage,
  t,
  onReview,
  isReviewing,
  hasError,
}: {
  application: Application;
  job: RecentJob;
  locale: string;
  zoneLanguage: "en" | "he";
  t: TFunction;
  onReview: (status: "accepted" | "rejected") => void;
  isReviewing: boolean;
  hasError: boolean;
}) {
  const { color: palette } = useTheme();
  return (
    <HomeSurface style={{ padding: BrandSpacing.inset }}>
      <View style={{ gap: BrandSpacing.stackRoomy }}>
        {/* Header: sport + instructor */}
        <View style={{ gap: BrandSpacing.xs }}>
          <Text
            style={{
              ...BrandType.micro,
              color: palette.primary,
              textTransform: "uppercase",
            }}
          >
            {toSportLabel(job.sport as never)}
          </Text>
          <Text style={BrandType.title}>{application.instructorName}</Text>
          <Text
            style={{
              ...BrandType.caption,
              color: palette.textMuted,
            }}
          >
            {[formatDateTime(job.startTime, locale), getZoneLabel(job.zone, zoneLanguage)].join(
              "  ·  ",
            )}
          </Text>
          {application.message ? (
            <Text style={{ ...BrandType.caption, fontStyle: "italic", color: palette.textMuted }} numberOfLines={2}>
              "{application.message}"
            </Text>
          ) : null}
        </View>

        {/* Pending count badge */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.xs }}>
          <Text
            selectable
            style={{
              fontFamily: "Lexend_600SemiBold",
              fontSize: 24,
              fontWeight: "600",
              letterSpacing: -0.45,
              lineHeight: 24,
              fontVariant: ["tabular-nums"],
              color: palette.warning,
            }}
          >
            {String(job.pendingApplicationsCount)}
          </Text>
          <Text
            style={{
              ...BrandType.caption,
              color: palette.textMuted,
            }}
          >
            {t("home.studio.pendingApplicants")}
          </Text>
        </View>

        {/* Error feedback */}
        {hasError ? (
          <Text style={{ ...BrandType.caption, color: palette.danger }}>
            {t("common.error")}
          </Text>
        ) : null}

        {/* Accept / Reject buttons */}
        <View style={{ flexDirection: "row", gap: BrandSpacing.stack }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("jobsTab.studioFeed.accept")}
            disabled={isReviewing}
            onPress={() => onReview("accepted")}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: BrandSpacing.insetTight,
              paddingHorizontal: BrandSpacing.inset,
              borderRadius: BrandRadius.button,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isReviewing
                ? palette.successSubtle
                : pressed
                  ? palette.success
                  : palette.successSubtle,
              opacity: isReviewing ? 0.7 : 1,
            })}
          >
            {({ pressed }) => (
              <Text
                style={{
                  ...BrandType.bodyStrong,
                  color: isReviewing
                    ? palette.success
                    : pressed
                      ? palette.onPrimary
                      : palette.success,
                }}
              >
                {isReviewing ? t("jobsTab.studioFeed.accepting") : t("jobsTab.studioFeed.accept")}
              </Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("jobsTab.studioFeed.reject")}
            disabled={isReviewing}
            onPress={() => onReview("rejected")}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: BrandSpacing.insetTight,
              paddingHorizontal: BrandSpacing.inset,
              borderRadius: BrandRadius.button,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isReviewing
                ? palette.dangerSubtle
                : pressed
                  ? palette.danger
                  : palette.dangerSubtle,
              opacity: isReviewing ? 0.7 : 1,
            })}
          >
            {({ pressed }) => (
              <Text
                style={{
                  ...BrandType.bodyStrong,
                  color: isReviewing
                    ? palette.danger
                    : pressed
                      ? palette.onPrimary
                      : palette.danger,
                }}
              >
                {isReviewing ? t("jobsTab.studioFeed.rejecting") : t("jobsTab.studioFeed.reject")}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </HomeSurface>
  );
});

export function StudioHomeContent({
  locale,
  openJobs,
  pendingApplicants,
  jobsFilled,
  currencyFormatter,
  t,
  recentJobs,
  onOpenJobs,
  onOpenCalendar,
  reviewApplication,
}: StudioHomeContentProps) {
  const { safeTop } = useAppInsets();
  const { color: palette } = useTheme();
  const layout = useHomeDashboardLayout();
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const { scrollRef, onScroll } = useScrollSheetBindings();
  const { width: screenWidth } = useWindowDimensions();

  const cardWidth = screenWidth - BrandSpacing.insetRoomy * 2;
  const scrollX = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  // Flatten all pending applications across all jobs into one list
  const pendingApplications = useMemo(() => {
    const result: Array<{ application: Application; job: RecentJob }> = [];
    for (const job of recentJobs) {
      if (job.applications) {
        for (const application of job.applications) {
          if (application.status === "pending") {
            result.push({ application, job });
          }
        }
      }
    }
    return result;
  }, [recentJobs]);

  const heroTitle =
    pendingApplications.length > 0
      ? t("home.studio.needsReview")
      : t("home.studio.heroActive", {
          count: openJobs,
        });

  const visibleRecentJobs = useMemo(
    () => recentJobs.slice(0, layout.isWideWeb ? 6 : 4),
    [recentJobs, layout.isWideWeb],
  );

  // Reviewing state — which applicationId is currently being reviewed
  const [reviewingId, setReviewingId] = useState<Id<"jobApplications"> | null>(null);
  const [errorId, setErrorId] = useState<Id<"jobApplications"> | null>(null);

  const handleReview = useCallback(
    async (applicationId: Id<"jobApplications">, status: "accepted" | "rejected") => {
      setReviewingId(applicationId);
      setErrorId(null);
      try {
        await reviewApplication({ applicationId, status });
      } catch (_err) {
        setErrorId(applicationId);
      } finally {
        setReviewingId(null);
      }
    },
    [reviewApplication],
  );

  // Stable per-applicationId review handler factory — prevents new callback per card per render
  const makeReviewHandler = useCallback(
    (applicationId: Id<"jobApplications">) =>
      (status: "accepted" | "rejected") => handleReview(applicationId, status),
    [handleReview],
  );

  return (
    <View collapsable={false} style={{ flex: 1 }}>
      <TabScreenScrollView
        animatedRef={scrollRef}
        onScroll={onScroll}
        routeKey="studio/index"
        style={{ flex: 1 }}
        topInsetTone="sheet"
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.insetRoomy,
          paddingTop: getHomeHeaderScrollTopPadding(safeTop),
          paddingBottom: BrandSpacing.section,
          gap: BrandSpacing.section,
        }}
      >
        <Animated.View entering={FadeInUp.delay(80).duration(280)}>
          <HomeSurface
            tone="primary"
            style={{
              padding: BrandSpacing.insetRoomy,
              gap: BrandSpacing.stackRoomy,
            }}
          >
            <View style={{ gap: BrandSpacing.stackTight }}>
              <Text
                style={{
                  ...BrandType.micro,
                  textTransform: "uppercase",
                }}
              >
                {t("home.studio.title")}
              </Text>
              <Text
                style={{
                  ...BrandType.headingDisplay,
                  lineHeight: layout.isWideWeb ? 36 : 30,
                }}
              >
                {heroTitle}
              </Text>
              <Text style={BrandType.body}>
                {pendingApplications.length > 0
                  ? t("home.studio.waitingCount", {
                      count: pendingApplicants,
                    })
                  : t("home.studio.heroActive", {
                      count: openJobs,
                    })}
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: BrandSpacing.stack }}>
              <HomeSignalTile
                label={t("home.actions.jobsTitle")}
                value={String(openJobs)}
                tone="accent"
                icon="briefcase.fill"
              />
              <HomeSignalTile
                label={t("home.studio.pendingApplicants")}
                value={String(pendingApplicants)}
                tone="warning"
                icon="clock.badge.checkmark"
              />
              <HomeSignalTile
                label={t("home.studio.recentlyFilled")}
                value={String(jobsFilled)}
                tone="success"
                icon="checkmark.circle.fill"
              />
            </View>

            <View
              style={{
                flexDirection: layout.isWideWeb ? "row" : "column",
                gap: BrandSpacing.stack,
              }}
            >
              <View style={{ flex: 1 }}>
                <ActionButton
                  accessibilityLabel={t("home.actions.jobsTitle")}
                  label={t("home.actions.jobsTitle")}
                  onPress={onOpenJobs}
                  tone="secondary"
                  fullWidth
                />
              </View>
              <View style={{ flex: 1 }}>
                <ActionButton
                  accessibilityLabel={t("home.actions.calendarTitle")}
                  label={t("home.actions.calendarTitle")}
                  onPress={onOpenCalendar}
                  fullWidth
                />
              </View>
            </View>
          </HomeSurface>
        </Animated.View>

        <View
          style={{
            flexDirection: layout.isWideWeb && pendingApplications.length > 0 ? "row" : "column",
            alignItems: "stretch",
            gap: layout.sectionGap,
          }}
        >
          {/* Review queue carousel */}
          {pendingApplications.length > 0 ? (
            <Animated.View
              entering={FadeInUp.delay(180).duration(320)}
              style={{ flex: layout.isWideWeb ? 1.08 : undefined, gap: BrandSpacing.stack }}
            >
              <HomeSectionHeading
                title={t("home.studio.needsReview")}
                eyebrow={t("home.studio.queueEyebrow")}
              />

              <Animated.View style={{ gap: BrandSpacing.stackTight }}>
                {/* Dot indicators */}
                <JobCarouselDots
                  count={pendingApplications.length}
                  scrollX={scrollX}
                  cardWidth={cardWidth}
                />

                {/* Horizontal carousel */}
                <Animated.ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={cardWidth}
                  decelerationRate="fast"
                  onScroll={scrollHandler}
                  scrollEventThrottle={16}
                  scrollEnabled={pendingApplications.length > 1}
                >
                  {pendingApplications.map(({ application, job }) => (
                    <View
                      key={application.applicationId}
                      style={{
                        width: cardWidth,
                        borderRadius: BrandRadius.soft,
                        overflow: "hidden",
                      }}
                    >
                      <ReviewApplicationCard
                        application={application}
                        job={job}
                        locale={locale}
                        zoneLanguage={zoneLanguage}
                        t={t}
                        onReview={makeReviewHandler(application.applicationId)}
                        isReviewing={reviewingId === application.applicationId}
                        hasError={errorId === application.applicationId}
                      />
                    </View>
                  ))}
                </Animated.ScrollView>
              </Animated.View>
            </Animated.View>
          ) : (
            <Animated.View
              entering={FadeInUp.delay(180).duration(320)}
              style={{ gap: BrandSpacing.stack }}
            >
              <HomeSectionHeading
                title={t("home.studio.needsReview")}
                eyebrow={t("home.studio.queueEyebrow")}
              />
              <ReviewQueueEmptyState t={t} />
            </Animated.View>
          )}

          {/* Live board */}
          <Animated.View
            entering={FadeInUp.delay(pendingApplications.length > 0 ? 220 : 180).duration(320)}
            style={{
              flex: layout.isWideWeb && pendingApplications.length > 0 ? 0.92 : undefined,
              gap: BrandSpacing.stack,
            }}
          >
            <HomeSectionHeading title={t("home.studio.boardEyebrow")} />
            {recentJobs.length === 0 ? (
              <HomeSurface style={{ padding: BrandSpacing.inset, gap: BrandSpacing.stackTight }}>
                <Text style={{ ...BrandType.title, color: palette.text }}>
                  {t("home.studio.noRecent")}
                </Text>
                <Text style={{ ...BrandType.caption, color: palette.textMuted }}>
                  {t("home.studio.emptyBoard")}
                </Text>
              </HomeSurface>
            ) : (
              <View style={{ gap: BrandSpacing.stack }}>
                {visibleRecentJobs.map((job, index) => (
                  <Animated.View
                    key={job.jobId}
                    entering={FadeInUp.delay(260 + index * 35)
                      .duration(260)
                      .springify()
                      .damping(18)}
                  >
                    <HomeSurface style={{ padding: BrandSpacing.inset, gap: BrandSpacing.xs }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: BrandSpacing.stack,
                        }}
                      >
                        <View style={{ flex: 1, gap: BrandSpacing.xs }}>
                          <Text style={{ ...BrandType.title, color: palette.text }}>
                            {toSportLabel(job.sport as never)}
                          </Text>
                          <Text style={{ ...BrandType.caption, color: palette.textMuted }}>
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
                            fontVariant: ["tabular-nums"],
                            color: palette.text,
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
