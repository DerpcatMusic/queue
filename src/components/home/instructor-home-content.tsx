import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import type { TFunction } from "i18next";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, useWindowDimensions } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { useLessonCheckIn } from "@/components/calendar/use-lesson-check-in";
import { HomeAgendaWidget } from "@/components/home/home-agenda-widget";
import { HomeSurface, useHomeDashboardLayout } from "@/components/home/home-dashboard-layout";
import {
  getRelativeTimeLabel,
  HomeChecklistCard,
  type HomeChecklistItem,
} from "@/components/home/home-shared";
import { JobCarouselDots } from "@/components/home/job-carousel-dots";
import { InstructorJobCard } from "@/components/jobs/instructor/instructor-job-card";
import {
  useCollapsedSheetHeight,
  useScrollSheetBindings,
} from "@/components/layout/scroll-sheet-provider";
import { TabSceneTransition } from "@/components/layout/tab-scene-transition";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SkeletonLine } from "@/components/ui/skeleton";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import type { Id } from "@/convex/_generated/dataModel";
import type { InstructorMarketplaceJob } from "@/features/jobs/instructor-marketplace-job";
import { useContentReveal } from "@/hooks/use-content-reveal";
import { useMinuteNow } from "@/hooks/use-minute-now";
import { useTheme } from "@/hooks/use-theme";
import { Box, Text } from "@/primitives";

type UpcomingSession = {
  applicationId: string;
  sport: string;
  studioName: string;
  zone: string;
  startTime: number;
  pay: number;
};

type CheckInSession = {
  applicationId: string;
  jobId: Id<"jobs">;
  sport: string;
  studioName: string;
  branchName: string;
  branchAddress?: string;
  zone: string;
  startTime: number;
  endTime: number;
  pay: number;
  checkInStatus?: "verified" | "rejected";
  checkInReason?:
    | "verified"
    | "outside_radius"
    | "accuracy_too_low"
    | "sample_too_old"
    | "outside_check_in_window"
    | "branch_location_missing";
  checkedInAt?: number;
};

type InstructorHomeContentProps = {
  isLoading: boolean;
  locale: string;
  pendingApplications: number;
  availableJobs?: InstructorMarketplaceJob[] | undefined;
  t: TFunction;
  upcomingSessions: UpcomingSession[];
  nextCheckInSession: CheckInSession | null;
  setupItems: HomeChecklistItem[];
  onOpenJobs: () => void;
  onOpenStudio: (studioId: Id<"studioProfiles">, jobId: Id<"jobs">) => void;
  withdrawingApplicationId?: Id<"jobApplications"> | null;
  onWithdrawApplication?: (applicationId: Id<"jobApplications">) => void;
};

function InstructorJobsEmptyState({ t }: { t: TFunction }) {
  const { color: palette } = useTheme();
  return (
    <HomeSurface
      style={{
        paddingHorizontal: BrandSpacing.md,
        paddingVertical: BrandSpacing.sm,
        backgroundColor: palette.surfaceAlt,
      }}
    >
      <Box
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: BrandSpacing.sm,
        }}
      >
        <Box style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm, flex: 1 }}>
          <IconSymbol name="sparkles" size={14} color={palette.primary} />
          <Text
            numberOfLines={1}
            style={{
              ...BrandType.microItalic,
              color: palette.text,
            }}
          >
            {t("home.instructor.noJobsAvailable").toUpperCase()}
          </Text>
        </Box>
        <Text
          style={{
            ...BrandType.micro,
            color: palette.textMuted,
          }}
        >
          {t("home.instructor.noJobsHint")}
        </Text>
      </Box>
    </HomeSurface>
  );
}

function SkeletonInstructorHome() {
  const { color: palette } = useTheme();

  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1 }}>
      <Box style={{ padding: BrandSpacing.lg, gap: BrandSpacing.xl }}>
        {/* Task list skeleton */}
        <Box
          style={[
            {
              backgroundColor: palette.surface,
              borderRadius: BrandRadius.card,
              padding: BrandSpacing.inset,
              gap: BrandSpacing.md,
            },
          ]}
        >
          <SkeletonLine width={120} height={18} />
          <SkeletonLine width="70%" height={12} />
          {[1, 2, 3].map((i) => (
            <Box
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: BrandSpacing.md,
              }}
            >
              <SkeletonLine width={32} height={32} radius={16} />
              <Box style={{ flex: 1, gap: BrandSpacing.xs }}>
                <SkeletonLine width="55%" height={14} />
                <SkeletonLine width="70%" height={12} />
              </Box>
            </Box>
          ))}
        </Box>

        {/* Jobs carousel skeleton */}
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
          <SkeletonLine width={100} height={14} />
          <Box style={{ height: BrandSpacing.md }} />
          {[1, 2].map((i) => (
            <Box
              key={i}
              style={{
                flexDirection: "row",
                gap: BrandSpacing.md,
                marginTop: BrandSpacing.md,
                alignItems: "center",
              }}
            >
              <SkeletonLine width={40} height={40} radius={20} />
              <Box style={{ flex: 1, gap: BrandSpacing.xs }}>
                <SkeletonLine width="70%" height={14} />
                <SkeletonLine width="50%" height={12} />
              </Box>
            </Box>
          ))}
        </Box>

        {/* Agenda skeleton */}
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
          <SkeletonLine width={120} height={14} />
          <Box style={{ height: BrandSpacing.md }} />
          {[1, 2, 3].map((i) => (
            <Box
              key={i}
              style={{
                flexDirection: "row",
                gap: BrandSpacing.md,
                marginTop: BrandSpacing.md,
                alignItems: "center",
              }}
            >
              <SkeletonLine width={40} height={40} radius={20} />
              <Box style={{ flex: 1, gap: BrandSpacing.xs }}>
                <SkeletonLine width="60%" height={14} />
                <SkeletonLine width="40%" height={12} />
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Animated.View>
  );
}

function InstructorCheckInCard({
  session,
  locale,
  now,
  t,
  isSubmitting,
  feedback,
  onCheckIn,
}: {
  session: CheckInSession;
  locale: string;
  now: number;
  t: TFunction;
  isSubmitting: boolean;
  feedback: { tone: "danger" | "success"; message: string } | null;
  onCheckIn: () => void;
}) {
  const { color: palette } = useTheme();
  const startsSoon = getRelativeTimeLabel(session.startTime, now, locale);
  const isCheckedIn = session.checkInStatus === "verified";

  return (
    <HomeSurface
      tone="surface"
      style={{
        padding: BrandSpacing.md,
        gap: BrandSpacing.sm,
      }}
    >
      <Box style={{ gap: BrandSpacing.xs }}>
        <Text
          style={{
            ...BrandType.microItalic,
            color: palette.textMuted,
          }}
        >
          {t("home.checkIn.eyebrow")}
        </Text>
        <Text
          style={{
            ...BrandType.headingItalic,
            color: palette.primary,
            transform: [{ skewX: "-6deg" }],
          }}
        >
          {isCheckedIn ? t("home.checkIn.checkedInTitle") : t("home.checkIn.title")}
        </Text>
      </Box>

      <Box
        style={{
          borderRadius: BrandRadius.medium,
          borderCurve: "continuous",
          backgroundColor: palette.surfaceAlt,
          padding: BrandSpacing.controlX,
          gap: BrandSpacing.xs,
        }}
      >
        <Text style={{ ...BrandType.bodyStrong, color: palette.text }}>{session.sport}</Text>
        <Text style={{ ...BrandType.caption, color: palette.textMuted }}>
          {`${session.studioName} · ${session.branchName}`}
        </Text>
        <Text style={{ ...BrandType.caption, color: palette.textMuted }}>{startsSoon}</Text>
        {session.branchAddress ? (
          <Text numberOfLines={2} style={{ ...BrandType.caption, color: palette.textMuted }}>
            {session.branchAddress}
          </Text>
        ) : null}
      </Box>

      {feedback ? (
        <Text
          style={{
            ...BrandType.caption,
            color: feedback.tone === "danger" ? palette.danger : palette.success,
          }}
        >
          {feedback.message}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("calendarTab.card.checkIn")}
        disabled={isSubmitting || isCheckedIn}
        onPress={onCheckIn}
        style={({ pressed }) => ({
          minHeight: BrandSpacing.buttonMinHeightXl,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: BrandRadius.button,
          borderCurve: "continuous",
          backgroundColor: isCheckedIn
            ? palette.successSubtle
            : pressed
              ? palette.primaryPressed
              : palette.primary,
          opacity: isSubmitting ? 0.72 : 1,
        })}
      >
        <Text
          style={{
            ...BrandType.bodyStrong,
            color: isCheckedIn ? palette.success : palette.onPrimary,
          }}
        >
          {isCheckedIn
            ? t("calendarTab.card.checkedIn")
            : isSubmitting
              ? t("common.loading")
              : t("calendarTab.card.checkIn")}
        </Text>
      </Pressable>
    </HomeSurface>
  );
}

export function InstructorHomeContent({
  isLoading,
  locale,
  pendingApplications,
  availableJobs,
  t,
  upcomingSessions,
  nextCheckInSession,
  setupItems,
  onOpenJobs,
  onOpenStudio,
  withdrawingApplicationId,
  onWithdrawApplication,
}: InstructorHomeContentProps) {
  const now = useMinuteNow();
  const { color: palette } = useTheme();
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const layout = useHomeDashboardLayout();
  const { scrollRef, onScroll } = useScrollSheetBindings();
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const { width: screenWidth } = useWindowDimensions();
  const checkInSheetRef = useRef<BottomSheet | null>(null);
  const [checkInSheetSession, setCheckInSheetSession] = useState<CheckInSession | null>(null);
  const [checkInFeedback, setCheckInFeedback] = useState<{
    tone: "danger" | "success";
    message: string;
  } | null>(null);

  const { animatedStyle } = useContentReveal(isLoading);

  const cardWidth = screenWidth - BrandSpacing.insetRoomy * 2;
  const scrollX = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const availableJobsCount = availableJobs?.length ?? 0;
  const visibleAvailableJobs = (availableJobs ?? []).slice(0, 4);
  const hasJobs = visibleAvailableJobs.length > 0;
  const activeCheckInSession = checkInSheetSession ?? nextCheckInSession;
  const { isSubmitting: isCheckingIn, submitCheckIn } = useLessonCheckIn({
    suppressAlerts: true,
    onVerified: (result) => {
      if (!activeCheckInSession) {
        return;
      }
      setCheckInFeedback({
        tone: "success",
        message: t("home.checkIn.verifiedDistance", {
          distance: Math.max(0, Math.round(result.distanceToBranchMeters ?? 0)),
        }),
      });
      setCheckInSheetSession({
        ...activeCheckInSession,
        checkInStatus: "verified",
        checkInReason: "verified",
        checkedInAt: result.checkedInAt,
      });
      checkInSheetRef.current?.snapToIndex(0);
    },
    onRejected: (result) => {
      setCheckInFeedback({
        tone: "danger",
        message: t(`calendarTab.card.checkInReasons.${result.reason}`),
      });
    },
    onError: (message) => {
      setCheckInFeedback({
        tone: "danger",
        message,
      });
    },
  });
  const handleCheckIn = useCallback(() => {
    if (!activeCheckInSession) {
      return;
    }
    setCheckInFeedback(null);
    void submitCheckIn(activeCheckInSession.jobId);
  }, [activeCheckInSession, submitCheckIn]);
  const renderCheckInBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsAt={0}
        disappearsAt={-1}
        style={[props.style, { backgroundColor: palette.appBg }]}
      />
    ),
    [palette.appBg],
  );
  const setupSubtitle = useMemo(() => {
    const remaining = setupItems.filter((item) => !item.done).length;
    return remaining === 0
      ? t("home.tasks.allDone")
      : t("home.tasks.remaining", { count: remaining });
  }, [setupItems, t]);

  return (
    <TabSceneTransition>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        {isLoading ? (
          <SkeletonInstructorHome />
        ) : (
          <Box collapsable={false} style={{ flex: 1 }}>
            <TabScreenScrollView
              animatedRef={scrollRef}
              onScroll={onScroll}
              routeKey="instructor/index"
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
                  gap: layout.topRowGap,
                  alignItems: "stretch",
                }}
              >
                {/* Jobs section — carousel or empty state */}
                <Box style={{ flex: layout.heroFlex }}>
                  {hasJobs ? (
                    <Animated.View style={{ gap: BrandSpacing.stackTight }}>
                      {/* Dot indicators */}
                      <JobCarouselDots
                        count={visibleAvailableJobs.length}
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
                        scrollEnabled={visibleAvailableJobs.length > 1}
                      >
                        {visibleAvailableJobs.map((job) => (
                          <Box
                            key={job.jobId}
                            style={{
                              width: cardWidth,
                            }}
                          >
                            <InstructorJobCard
                              job={job}
                              locale={locale}
                              zoneLanguage={zoneLanguage}
                              now={now}
                              {...(withdrawingApplicationId !== undefined
                                ? { withdrawingApplicationId }
                                : {})}
                              {...(onWithdrawApplication ? { onWithdrawApplication } : {})}
                              onApply={() => onOpenStudio(job.studioId, job.jobId)}
                              onOpenStudio={onOpenStudio}
                              t={t}
                            />
                          </Box>
                        ))}
                      </Animated.ScrollView>
                    </Animated.View>
                  ) : (
                    <InstructorJobsEmptyState t={t} />
                  )}
                </Box>

                <Box style={{ flex: layout.chartFlex, gap: BrandSpacing.stackTight }}>
                  <HomeChecklistCard
                    title={t("home.tasks.instructor.title")}
                    subtitle={setupSubtitle}
                    items={setupItems}
                  />
                  {nextCheckInSession ? (
                    <InstructorCheckInCard
                      session={
                        checkInSheetSession &&
                        checkInSheetSession.jobId === nextCheckInSession.jobId
                          ? checkInSheetSession
                          : nextCheckInSession
                      }
                      locale={locale}
                      now={now}
                      t={t}
                      isSubmitting={isCheckingIn}
                      feedback={checkInFeedback}
                      onCheckIn={handleCheckIn}
                    />
                  ) : (
                    <HomeSurface
                      tone="surface"
                      style={{
                        padding: BrandSpacing.inset,
                        gap: BrandSpacing.xs,
                      }}
                    >
                      <Text style={{ ...BrandType.title, color: palette.text }}>
                        {t("home.instructor.boardSummaryTitle")}
                      </Text>
                      <Text style={{ ...BrandType.caption, color: palette.textMuted }}>
                        {t("home.instructor.boardSummaryBody", {
                          jobs: availableJobsCount,
                          pending: pendingApplications,
                        })}
                      </Text>
                    </HomeSurface>
                  )}
                </Box>
              </Box>

              <Box
                style={{
                  flexDirection: layout.isWideWeb ? "row" : "column",
                  gap: layout.topRowGap,
                  alignItems: "stretch",
                }}
              >
                <HomeAgendaWidget
                  items={upcomingSessions.map((session) => ({
                    id: session.applicationId,
                    sport: session.sport,
                    name: session.studioName,
                    startTime: session.startTime,
                    zone: session.zone,
                  }))}
                  t={t}
                  locale={locale}
                  maxItems={layout.isWideWeb ? 8 : 5}
                  maxHeight={layout.isWideWeb ? 360 : 280}
                  heading={t("home.instructor.nextTitle")}
                  emptyLabel={t("home.instructor.noUpcoming")}
                  onPressAll={onOpenJobs}
                />
              </Box>
            </TabScreenScrollView>
          </Box>
        )}
      </Animated.View>
      <BottomSheet
        ref={checkInSheetRef}
        index={-1}
        snapPoints={["46%"]}
        topInset={collapsedSheetHeight}
        enablePanDownToClose
        backdropComponent={renderCheckInBackdrop}
        handleIndicatorStyle={{ backgroundColor: palette.borderStrong }}
        backgroundStyle={{ backgroundColor: palette.surface }}
      >
        <BottomSheetView
          style={{
            paddingHorizontal: BrandSpacing.lg,
            paddingTop: BrandSpacing.lg,
            paddingBottom: BrandSpacing.xxl,
            gap: BrandSpacing.md,
          }}
        >
          <Box style={{ gap: BrandSpacing.xs }}>
            <Text style={{ ...BrandType.heading, color: palette.text }}>
              {t("home.checkIn.sheetTitle")}
            </Text>
            <Text style={{ ...BrandType.caption, color: palette.textMuted }}>
              {t("home.checkIn.sheetBody")}
            </Text>
          </Box>

          {checkInSheetSession ? (
            <Box
              style={{
                borderRadius: BrandRadius.card,
                borderCurve: "continuous",
                backgroundColor: palette.surface,
                padding: BrandSpacing.inset,
                gap: BrandSpacing.sm,
              }}
            >
              <Text style={{ ...BrandType.bodyStrong, color: palette.text }}>
                {checkInSheetSession.studioName}
              </Text>
              <Text style={{ ...BrandType.caption, color: palette.textMuted }}>
                {`${checkInSheetSession.sport} · ${checkInSheetSession.branchName}`}
              </Text>
              {checkInSheetSession.branchAddress ? (
                <Text style={{ ...BrandType.caption, color: palette.textMuted }}>
                  {checkInSheetSession.branchAddress}
                </Text>
              ) : null}
              <Text style={{ ...BrandType.caption, color: palette.textMuted }}>
                {t("home.checkIn.instructions")}
              </Text>
            </Box>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.done")}
            onPress={() => checkInSheetRef.current?.close()}
            style={({ pressed }) => ({
              minHeight: BrandSpacing.buttonMinHeightXl,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: BrandRadius.button,
              borderCurve: "continuous",
              backgroundColor: pressed ? palette.primaryPressed : palette.primary,
            })}
          >
            <Text style={{ ...BrandType.bodyStrong, color: palette.onPrimary }}>
              {t("home.checkIn.sheetCta")}
            </Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheet>
    </TabSceneTransition>
  );
}
