import type { TFunction } from "i18next";
import { memo, useCallback, useMemo, useState } from "react";
import { Pressable, useWindowDimensions } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import {
  HomeSectionHeading,
  HomeSurface,
  useHomeDashboardLayout,
} from "@/components/home/home-dashboard-layout";
import { HomeChecklistCard, type HomeChecklistItem } from "@/components/home/home-shared";
import type { Application } from "@/components/home/home-tab/home-role-content";
import { JobCarouselDots } from "@/components/home/job-carousel-dots";
import { useScrollSheetBindings } from "@/components/layout/scroll-sheet-provider";
import { TabSceneTransition } from "@/components/layout/tab-scene-transition";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { SkeletonLine } from "@/components/ui/skeleton";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useContentReveal } from "@/hooks/use-content-reveal";
import { useTheme } from "@/hooks/use-theme";
import { formatDateTime } from "@/lib/jobs-utils";
import { Box, Text } from "@/primitives";

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
  isLoading: boolean;
  locale: string;
  openJobs: number;
  pendingApplicants: number;
  jobsFilled: number;
  currencyFormatter: Intl.NumberFormat;
  t: TFunction;
  recentJobs: RecentJob[];
  setupItems: HomeChecklistItem[];
  onOpenJobs: () => void;
  onOpenCalendar: () => void;
  onOpenInstructorProfile: (instructorId: Id<"instructorProfiles">) => void;
  reviewApplication: (args: {
    applicationId: Id<"jobApplications">;
    status: "accepted" | "rejected";
  }) => Promise<{ ok: boolean }>;
};

const ReviewQueueEmptyState = memo(function ReviewQueueEmptyState({ t }: { t: TFunction }) {
  const { color: palette } = useTheme();
  return (
    <HomeSurface style={{ padding: BrandSpacing.inset }}>
      <Box style={{ alignItems: "center", gap: BrandSpacing.stackTight }}>
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
      </Box>
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
  onOpenInstructorProfile,
}: {
  application: Application;
  job: RecentJob;
  locale: string;
  zoneLanguage: "en" | "he";
  t: TFunction;
  onReview: (status: "accepted" | "rejected") => void;
  isReviewing: boolean;
  hasError: boolean;
  onOpenInstructorProfile: (instructorId: Id<"instructorProfiles">) => void;
}) {
  const { color: palette } = useTheme();
  return (
    <HomeSurface style={{ padding: BrandSpacing.inset }}>
      <Box style={{ gap: BrandSpacing.stackRoomy }}>
        {/* Header: sport + instructor */}
        <Box style={{ gap: BrandSpacing.xs }}>
          <Text
            style={{
              ...BrandType.micro,
              color: palette.primary,
              textTransform: "uppercase",
            }}
          >
            {toSportLabel(job.sport as never)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={application.instructorName}
            onPress={() => onOpenInstructorProfile(application.instructorId)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: BrandSpacing.sm,
              opacity: pressed ? 0.82 : 1,
            })}
          >
            <ProfileAvatar
              imageUrl={application.profileImageUrl}
              fallbackName={application.instructorName}
              size={BrandSpacing.controlMd}
              roundedSquare={false}
            />
            <Text style={[BrandType.title, { color: palette.primary }]}>
              {application.instructorName}
            </Text>
          </Pressable>
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
            <Text
              style={{ ...BrandType.caption, fontStyle: "italic", color: palette.textMuted }}
              numberOfLines={2}
            >
              "{application.message}"
            </Text>
          ) : null}
        </Box>

        {/* Pending count badge */}
        <Box style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.xs }}>
          <Text
            selectable
            style={{
              fontFamily: "Lexend_600SemiBold",
              fontSize: BrandType.heading.fontSize,
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
        </Box>

        {/* Error feedback */}
        {hasError ? (
          <Text style={{ ...BrandType.caption, color: palette.danger }}>{t("common.error")}</Text>
        ) : null}

        {/* Accept / Reject buttons */}
        <Box style={{ flexDirection: "row", gap: BrandSpacing.stack }}>
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
        </Box>
      </Box>
    </HomeSurface>
  );
});

function SkeletonStudioHome() {
  const { color: palette } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{ flex: 1 }}
    >
      <Box style={{ padding: BrandSpacing.lg, gap: BrandSpacing.xl }}>
        {/* Hero card skeleton */}
        <Box
          style={[
            {
              backgroundColor: palette.surface,
              borderRadius: BrandRadius.card,
              padding: BrandSpacing.insetRoomy,
              gap: BrandSpacing.stackRoomy,
            },
          ]}
        >
          <Box style={{ gap: BrandSpacing.stackTight }}>
            <SkeletonLine width={60} height={12} />
            <SkeletonLine width="80%" height={28} />
            <SkeletonLine width="60%" height={16} />
          </Box>

          <Box style={{ flexDirection: "row", gap: BrandSpacing.stack }}>
            <Box style={{ flex: 1 }}>
              <SkeletonLine width={40} height={40} radius={20} />
              <Box style={{ height: BrandSpacing.xs }} />
              <SkeletonLine width={50} height={24} />
            </Box>
            <Box style={{ flex: 1 }}>
              <SkeletonLine width={40} height={40} radius={20} />
              <Box style={{ height: BrandSpacing.xs }} />
              <SkeletonLine width={50} height={24} />
            </Box>
            <Box style={{ flex: 1 }}>
              <SkeletonLine width={40} height={40} radius={20} />
              <Box style={{ height: BrandSpacing.xs }} />
              <SkeletonLine width={50} height={24} />
            </Box>
          </Box>

          <Box style={{ flexDirection: "row", gap: BrandSpacing.stack }}>
            <Box
              style={{
                flex: 1,
                height: 44,
                borderRadius: BrandRadius.button,
                backgroundColor: palette.surfaceAlt,
              }}
            />
            <Box
              style={{
                flex: 1,
                height: 44,
                borderRadius: BrandRadius.button,
                backgroundColor: palette.surfaceAlt,
              }}
            />
          </Box>
        </Box>

        {/* Review queue skeleton */}
        <Box style={{ gap: BrandSpacing.stack }}>
          <SkeletonLine width={120} height={14} />
          <Box
            style={[
              {
                backgroundColor: palette.surface,
                borderRadius: BrandRadius.card,
                padding: BrandSpacing.lg,
                gap: BrandSpacing.md,
              },
            ]}
          >
            {[1, 2].map((i) => (
              <Box
                key={i}
                style={{
                  backgroundColor: palette.surface,
                  borderRadius: BrandRadius.card,
                  padding: BrandSpacing.inset,
                  gap: BrandSpacing.sm,
                }}
              >
                <Box style={{ flexDirection: "row", gap: BrandSpacing.sm, alignItems: "center" }}>
                  <SkeletonLine width={40} height={40} radius={20} />
                  <Box style={{ flex: 1, gap: BrandSpacing.xs }}>
                    <SkeletonLine width="50%" height={14} />
                    <SkeletonLine width="70%" height={12} />
                  </Box>
                </Box>
                <Box style={{ flexDirection: "row", gap: BrandSpacing.stack }}>
                  <Box
                    style={{
                      flex: 1,
                      height: 36,
                      borderRadius: BrandRadius.button,
                      backgroundColor: palette.surfaceAlt,
                    }}
                  />
                  <Box
                    style={{
                      flex: 1,
                      height: 36,
                      borderRadius: BrandRadius.button,
                      backgroundColor: palette.surfaceAlt,
                    }}
                  />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Live board skeleton */}
        <Box style={{ gap: BrandSpacing.stack }}>
          <SkeletonLine width={100} height={14} />
          {[1, 2, 3].map((i) => (
            <Box
              key={i}
              style={[
                {
                  backgroundColor: palette.surface,
                  borderRadius: BrandRadius.card,
                  padding: BrandSpacing.inset,
                  gap: BrandSpacing.xs,
                },
              ]}
            >
              <Box style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Box style={{ gap: BrandSpacing.xs }}>
                  <SkeletonLine width={80} height={16} />
                  <SkeletonLine width={120} height={12} />
                </Box>
                <SkeletonLine width={60} height={16} />
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Animated.View>
  );
}

export function StudioHomeContent({
  isLoading,
  locale,
  openJobs,
  pendingApplicants,
  jobsFilled,
  currencyFormatter,
  t,
  recentJobs,
  setupItems,
  onOpenJobs,
  onOpenCalendar,
  onOpenInstructorProfile,
  reviewApplication,
}: StudioHomeContentProps) {
  const { color: palette } = useTheme();
  const layout = useHomeDashboardLayout();
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const { scrollRef, onScroll } = useScrollSheetBindings();
  const { width: screenWidth } = useWindowDimensions();

  const { animatedStyle } = useContentReveal(isLoading);

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
  const setupSubtitle = useMemo(() => {
    const remaining = setupItems.filter((item) => !item.done).length;
    return remaining === 0
      ? t("home.tasks.allDone")
      : t("home.tasks.remaining", { count: remaining });
  }, [setupItems, t]);

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
    (applicationId: Id<"jobApplications">) => (status: "accepted" | "rejected") =>
      handleReview(applicationId, status),
    [handleReview],
  );

  return (
    <TabSceneTransition>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        {isLoading ? (
          <SkeletonStudioHome />
        ) : (
          <Box collapsable={false} style={{ flex: 1 }}>
            <TabScreenScrollView
              animatedRef={scrollRef}
              onScroll={onScroll}
              routeKey="studio/index"
              style={{ flex: 1 }}
              topInsetTone="sheet"
              sheetInsets={{
                topSpacing: BrandSpacing.xl,
                bottomSpacing: BrandSpacing.section,
                horizontalPadding: BrandSpacing.insetRoomy,
              }}
            >
              <Box
                style={{
                  flexDirection: layout.isWideWeb ? "row" : "column",
                  gap: BrandSpacing.stackTight,
                  alignItems: "stretch",
                }}
              >
                <HomeSurface
                  tone="primary"
                  style={{
                    flex: layout.heroFlex,
                    padding: BrandSpacing.insetRoomy,
                    gap: BrandSpacing.stackRoomy,
                  }}
                >
                  <Box style={{ gap: BrandSpacing.stackTight }}>
                    <Text
                      style={{
                        ...BrandType.micro,
                        textTransform: "uppercase",
                      }}
                    >
                      {t("home.studio.title")}
                    </Text>
                    <Text style={BrandType.headingDisplay}>{heroTitle}</Text>
                    <Text style={BrandType.body}>
                      {pendingApplications.length > 0
                        ? t("home.studio.waitingCount", {
                            count: pendingApplicants,
                          })
                        : t("home.studio.heroActive", {
                            count: openJobs,
                          })}
                    </Text>
                    <Text style={{ ...BrandType.caption, color: palette.onPrimary }}>
                      {t("home.studio.boardSummaryBody", {
                        open: openJobs,
                        pending: pendingApplicants,
                        filled: jobsFilled,
                      })}
                    </Text>
                  </Box>

                  <Box
                    style={{
                      flexDirection: layout.isWideWeb ? "row" : "column",
                      gap: BrandSpacing.stack,
                    }}
                  >
                    <Box style={{ flex: 1 }}>
                      <ActionButton
                        accessibilityLabel={t("home.actions.jobsTitle")}
                        label={t("home.actions.jobsTitle")}
                        onPress={onOpenJobs}
                        tone="secondary"
                        fullWidth
                      />
                    </Box>
                    <Box style={{ flex: 1 }}>
                      <ActionButton
                        accessibilityLabel={t("home.actions.calendarTitle")}
                        label={t("home.actions.calendarTitle")}
                        onPress={onOpenCalendar}
                        fullWidth
                      />
                    </Box>
                  </Box>
                </HomeSurface>

                <Box style={{ flex: layout.chartFlex }}>
                  <HomeChecklistCard
                    title={t("home.tasks.studio.title")}
                    subtitle={setupSubtitle}
                    items={setupItems}
                  />
                </Box>
              </Box>

              <Box
                style={{
                  flexDirection:
                    layout.isWideWeb && pendingApplications.length > 0 ? "row" : "column",
                  alignItems: "stretch",
                  gap: layout.sectionGap,
                }}
              >
                {/* Review queue carousel */}
                {pendingApplications.length > 0 ? (
                  <Box
                    style={{ flex: layout.isWideWeb ? 1.08 : undefined, gap: BrandSpacing.stack }}
                  >
                    <HomeSectionHeading
                      title={t("home.studio.needsReview")}
                      eyebrow={t("home.studio.queueEyebrow")}
                    />

                    <Box style={{ gap: BrandSpacing.stackTight }}>
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
                          <Box
                            key={application.applicationId}
                            style={{
                              width: cardWidth,
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
                              onOpenInstructorProfile={onOpenInstructorProfile}
                            />
                          </Box>
                        ))}
                      </Animated.ScrollView>
                    </Box>
                  </Box>
                ) : (
                  <Box style={{ gap: BrandSpacing.stack }}>
                    <HomeSectionHeading
                      title={t("home.studio.needsReview")}
                      eyebrow={t("home.studio.queueEyebrow")}
                    />
                    <ReviewQueueEmptyState t={t} />
                  </Box>
                )}

                {/* Live board */}
                <Box
                  style={{
                    flex: layout.isWideWeb && pendingApplications.length > 0 ? 0.92 : undefined,
                    gap: BrandSpacing.stack,
                  }}
                >
                  <HomeSectionHeading title={t("home.studio.boardEyebrow")} />
                  {recentJobs.length === 0 ? (
                    <HomeSurface
                      style={{ padding: BrandSpacing.inset, gap: BrandSpacing.stackTight }}
                    >
                      <Text style={{ ...BrandType.title, color: palette.text }}>
                        {t("home.studio.noRecent")}
                      </Text>
                      <Text style={{ ...BrandType.caption, color: palette.textMuted }}>
                        {t("home.studio.emptyBoard")}
                      </Text>
                    </HomeSurface>
                  ) : (
                    <Box style={{ gap: BrandSpacing.stack }}>
                      {visibleRecentJobs.map((job) => (
                        <Box key={job.jobId}>
                          <HomeSurface
                            style={{ padding: BrandSpacing.inset, gap: BrandSpacing.xs }}
                          >
                            <Box
                              style={{
                                flexDirection: "row",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                gap: BrandSpacing.stack,
                              }}
                            >
                              <Box style={{ flex: 1, gap: BrandSpacing.xs }}>
                                <Text style={{ ...BrandType.title, color: palette.text }}>
                                  {toSportLabel(job.sport as never)}
                                </Text>
                                <Text style={{ ...BrandType.caption, color: palette.textMuted }}>
                                  {[
                                    formatDateTime(job.startTime, locale),
                                    getZoneLabel(job.zone, zoneLanguage),
                                  ].join("  ·  ")}
                                </Text>
                              </Box>
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
                            </Box>
                          </HomeSurface>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            </TabScreenScrollView>
          </Box>
        )}
      </Animated.View>
    </TabSceneTransition>
  );
}
