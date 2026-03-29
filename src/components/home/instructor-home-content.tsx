import type { TFunction } from "i18next";
import { Text, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { HomeAgendaWidget } from "@/components/home/home-agenda-widget";
import { HomeSurface, useHomeDashboardLayout } from "@/components/home/home-dashboard-layout";
import { HomeSignalTile } from "@/components/home/home-shared";
import { JobCarouselDots } from "@/components/home/job-carousel-dots";
import {
  InstructorJobCard,
  type InstructorMarketplaceJob,
} from "@/components/jobs/instructor/instructor-job-card";
import { useScrollSheetBindings } from "@/components/layout/scroll-sheet-provider";
import { TabSceneTransition } from "@/components/layout/tab-scene-transition";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandSpacing } from "@/constants/brand";
import type { Id } from "@/convex/_generated/dataModel";
import { useTheme } from "@/hooks/use-theme";

type UpcomingSession = {
  applicationId: string;
  sport: string;
  studioName: string;
  zone: string;
  startTime: number;
  pay: number;
};

type InstructorHomeContentProps = {
  currencyFormatter: Intl.NumberFormat;
  locale: string;
  now: number;
  lessonsCompleted: number;
  pendingApplications: number;
  availableJobs?: InstructorMarketplaceJob[] | undefined;
  t: TFunction;
  totalEarningsAgorot: number;
  upcomingSessions: UpcomingSession[];
  onOpenJobs: () => void;
  onOpenStudio: (studioId: Id<"studioProfiles">, jobId: Id<"jobs">) => void;
  withdrawingApplicationId?: Id<"jobApplications"> | null;
  onWithdrawApplication?: (applicationId: Id<"jobApplications">) => void;
};

function InstructorJobsEmptyState({ t }: { t: TFunction }) {
  const { color: palette } = useTheme();
  return (
    <HomeSurface style={{ padding: BrandSpacing.inset }}>
      <View style={{ alignItems: "center", gap: BrandSpacing.stackTight }}>
        <IconSymbol name="briefcase.fill" size={28} color={palette.textMuted} />
        <Text
          style={{
            fontFamily: "Lexend_500Medium",
            fontSize: 20,
            fontWeight: "500",
            letterSpacing: -0.24,
            lineHeight: 26,
            color: palette.text,
          }}
        >
          {t("home.instructor.noJobsAvailable")}
        </Text>
        <Text
          style={{
            fontFamily: "Manrope_400Regular",
            fontSize: 14,
            fontWeight: "400",
            lineHeight: 19,
            color: palette.textMuted,
            textAlign: "center",
          }}
        >
          {t("home.instructor.noJobsHint")}
        </Text>
      </View>
    </HomeSurface>
  );
}

export function InstructorHomeContent({
  currencyFormatter,
  locale,
  now,
  lessonsCompleted,
  pendingApplications,
  availableJobs,
  t,
  totalEarningsAgorot,
  upcomingSessions,
  onOpenJobs,
  onOpenStudio,
  withdrawingApplicationId,
  onWithdrawApplication,
}: InstructorHomeContentProps) {
  const { color: palette } = useTheme();
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const layout = useHomeDashboardLayout();
  const { scrollRef, onScroll } = useScrollSheetBindings();
  const { width: screenWidth } = useWindowDimensions();

  const cardWidth = screenWidth - BrandSpacing.insetRoomy * 2;
  const scrollX = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const availableJobsCount = availableJobs?.length ?? 0;
  const visibleAvailableJobs = (availableJobs ?? []).slice(0, 4);
  const earningsLabel = currencyFormatter.format(totalEarningsAgorot / 100);
  const completionLabel = String(lessonsCompleted);

  const hasJobs = visibleAvailableJobs.length > 0;

  return (
    <TabSceneTransition>
      <View collapsable={false} style={{ flex: 1, backgroundColor: palette.appBg }}>
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
          <View
            style={{
              flexDirection: layout.isWideWeb ? "row" : "column",
              gap: layout.topRowGap,
              alignItems: "stretch",
            }}
          >
            {/* Jobs section — carousel or empty state */}
            <View style={{ flex: layout.heroFlex }}>
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
                      <View
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
                      </View>
                    ))}
                  </Animated.ScrollView>
                </Animated.View>
              ) : (
                <InstructorJobsEmptyState t={t} />
              )}
            </View>

            {/* Stats tiles */}
            <View style={{ flex: layout.chartFlex, gap: BrandSpacing.stackTight }}>
              <View style={{ flexDirection: "row", gap: BrandSpacing.stackTight }}>
                <HomeSignalTile
                  label={t("home.actions.jobsTitle")}
                  value={String(availableJobsCount)}
                  tone="accent"
                  icon="briefcase.fill"
                />
                <HomeSignalTile
                  label={t("home.instructor.pendingApps")}
                  value={String(pendingApplications)}
                  tone="warning"
                  icon="clock.badge.checkmark"
                />
              </View>
              <View style={{ flexDirection: "row", gap: BrandSpacing.stackTight }}>
                <HomeSignalTile
                  label={t("home.performance.earnings")}
                  value={earningsLabel}
                  tone="success"
                  icon="banknote"
                />
                <HomeSignalTile
                  label={t("home.shared.jobsFilled")}
                  value={completionLabel}
                  tone="accent"
                  icon="checkmark.circle.fill"
                />
              </View>
            </View>
          </View>

          <View
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
          </View>
        </TabScreenScrollView>
      </View>
    </TabSceneTransition>
  );
}
