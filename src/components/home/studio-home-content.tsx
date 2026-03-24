import type { TFunction } from "i18next";
import { useCallback, useState } from "react";
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
import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import type { Id } from "@/convex/_generated/dataModel";
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
  applications?: Application[];
};

type StudioHomeContentProps = {
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
  reviewApplication: (args: {
    applicationId: Id<"jobApplications">;
    status: "accepted" | "rejected";
  }) => Promise<{ ok: boolean }>;
};

function ReviewQueueEmptyState({ palette, t }: { palette: BrandPalette; t: TFunction }) {
  return (
    <HomeSurface palette={palette} style={{ padding: BrandSpacing.inset }}>
      <View style={{ alignItems: "center", gap: BrandSpacing.stackTight }}>
        <IconSymbol name="checkmark.circle.fill" size={28} color={palette.success as string} />
        <Text style={{ ...BrandType.title, color: palette.text as string }}>
          {t("home.studio.noReviewJobs")}
        </Text>
        <Text
          style={{
            ...BrandType.caption,
            color: palette.textMuted as string,
            textAlign: "center",
          }}
        >
          {t("home.studio.noReviewJobsHint")}
        </Text>
      </View>
    </HomeSurface>
  );
}

function ReviewApplicationCard({
  application,
  job,
  palette,
  locale,
  zoneLanguage,
  t,
  onReview,
  isReviewing,
}: {
  application: Application;
  job: RecentJob;
  palette: BrandPalette;
  locale: string;
  zoneLanguage: "en" | "he";
  t: TFunction;
  onReview: (status: "accepted" | "rejected") => void;
  isReviewing: boolean;
}) {
  return (
    <HomeSurface palette={palette} style={{ padding: BrandSpacing.inset }}>
      <View style={{ gap: BrandSpacing.stackRoomy }}>
        {/* Header: sport + instructor */}
        <View style={{ gap: BrandSpacing.xs }}>
          <Text
            style={{
              ...BrandType.micro,
              color: palette.primary as string,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            {toSportLabel(job.sport as never)}
          </Text>
          <Text style={{ ...BrandType.title, color: palette.text as string }}>
            {application.instructorName}
          </Text>
          <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
            {[formatDateTime(job.startTime, locale), getZoneLabel(job.zone, zoneLanguage)].join(
              "  ·  ",
            )}
          </Text>
          {application.message ? (
            <Text
              style={{
                ...BrandType.caption,
                color: palette.textMuted as string,
                fontStyle: "italic",
              }}
              numberOfLines={2}
            >
              "{application.message}"
            </Text>
          ) : null}
        </View>

        {/* Pending count badge */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.xs }}>
          <Text
            selectable
            style={{
              ...BrandType.heading,
              fontSize: 24,
              lineHeight: 24,
              color: palette.warning as string,
              fontVariant: ["tabular-nums"],
            }}
          >
            {String(job.pendingApplicationsCount)}
          </Text>
          <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
            {t("home.studio.pendingApplicants")}
          </Text>
        </View>

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
              backgroundColor: isReviewing
                ? (palette.successSubtle as string)
                : pressed
                  ? (palette.success as string)
                  : (palette.successSubtle as string),
              alignItems: "center",
              justifyContent: "center",
              opacity: isReviewing ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                ...BrandType.bodyStrong,
                color: isReviewing ? (palette.success as string) : (palette.success as string),
              }}
            >
              {isReviewing ? t("jobsTab.studioFeed.accepting") : t("jobsTab.studioFeed.accept")}
            </Text>
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
              backgroundColor: isReviewing
                ? (palette.dangerSubtle as string)
                : pressed
                  ? (palette.danger as string)
                  : (palette.dangerSubtle as string),
              alignItems: "center",
              justifyContent: "center",
              opacity: isReviewing ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                ...BrandType.bodyStrong,
                color: isReviewing ? (palette.danger as string) : (palette.danger as string),
              }}
            >
              {isReviewing ? t("jobsTab.studioFeed.rejecting") : t("jobsTab.studioFeed.reject")}
            </Text>
          </Pressable>
        </View>
      </View>
    </HomeSurface>
  );
}

export function StudioHomeContent({
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
  reviewApplication,
}: StudioHomeContentProps) {
  const { safeTop } = useAppInsets();
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
  const pendingApplications: Array<{ application: Application; job: RecentJob }> = [];
  for (const job of recentJobs) {
    if (job.applications) {
      for (const application of job.applications) {
        if (application.status === "pending") {
          pendingApplications.push({ application, job });
        }
      }
    }
  }

  const heroTitle =
    pendingApplications.length > 0
      ? t("home.studio.needsReview")
      : t("home.studio.heroActive", {
          count: openJobs,
        });

  const visibleRecentJobs = recentJobs.slice(0, layout.isWideWeb ? 6 : 4);

  // Reviewing state — which applicationId is currently being reviewed
  const [reviewingId, setReviewingId] = useState<Id<"jobApplications"> | null>(null);

  const handleReview = useCallback(
    async (applicationId: Id<"jobApplications">, status: "accepted" | "rejected") => {
      setReviewingId(applicationId);
      try {
        await reviewApplication({ applicationId, status });
      } catch (_err) {
        // Error handling could be enhanced with a toast/banner
      } finally {
        setReviewingId(null);
      }
    },
    [reviewApplication],
  );

  return (
    <View collapsable={false} style={{ flex: 1, backgroundColor: palette.appBg }}>
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
            palette={palette}
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
                  color: palette.onPrimary as string,
                  letterSpacing: 0.8,
                }}
              >
                {t("home.studio.title")}
              </Text>
              <Text
                style={{
                  ...BrandType.heading,
                  fontSize: layout.isWideWeb ? 34 : 28,
                  lineHeight: layout.isWideWeb ? 36 : 30,
                  color: palette.onPrimary as string,
                }}
              >
                {heroTitle}
              </Text>
              <Text
                style={{
                  ...BrandType.body,
                  color: palette.onPrimary as string,
                }}
              >
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
                palette={palette}
                tone="accent"
                icon="briefcase.fill"
              />
              <HomeSignalTile
                label={t("home.studio.pendingApplicants")}
                value={String(pendingApplicants)}
                palette={palette}
                tone="warning"
                icon="clock.badge.checkmark"
              />
              <HomeSignalTile
                label={t("home.studio.recentlyFilled")}
                value={String(jobsFilled)}
                palette={palette}
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
                  palette={palette}
                  tone="secondary"
                  fullWidth
                />
              </View>
              <View style={{ flex: 1 }}>
                <ActionButton
                  accessibilityLabel={t("home.actions.calendarTitle")}
                  label={t("home.actions.calendarTitle")}
                  onPress={onOpenCalendar}
                  palette={palette}
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
                palette={palette}
              />

              <Animated.View style={{ gap: BrandSpacing.stackTight }}>
                {/* Dot indicators */}
                <JobCarouselDots
                  count={pendingApplications.length}
                  scrollX={scrollX}
                  cardWidth={cardWidth}
                  palette={palette}
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
                        palette={palette}
                        locale={locale}
                        zoneLanguage={zoneLanguage}
                        t={t}
                        onReview={(status) => handleReview(application.applicationId, status)}
                        isReviewing={reviewingId === application.applicationId}
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
                palette={palette}
              />
              <ReviewQueueEmptyState palette={palette} t={t} />
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
            <HomeSectionHeading title={t("home.studio.boardEyebrow")} palette={palette} />
            {recentJobs.length === 0 ? (
              <HomeSurface
                palette={palette}
                style={{ padding: BrandSpacing.inset, gap: BrandSpacing.stackTight }}
              >
                <Text style={{ ...BrandType.title, color: palette.text as string }}>
                  {t("home.studio.noRecent")}
                </Text>
                <Text
                  style={{
                    ...BrandType.caption,
                    color: palette.textMuted as string,
                  }}
                >
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
                    <HomeSurface
                      palette={palette}
                      style={{ padding: BrandSpacing.inset, gap: BrandSpacing.xs }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: BrandSpacing.stack,
                        }}
                      >
                        <View style={{ flex: 1, gap: BrandSpacing.xs }}>
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
