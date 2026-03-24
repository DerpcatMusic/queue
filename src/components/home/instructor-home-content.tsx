import type { TFunction } from "i18next";
import { Text, useWindowDimensions, View } from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { HomeAgendaWidget } from "@/components/home/home-agenda-widget";
import { HomeSurface, useHomeDashboardLayout } from "@/components/home/home-dashboard-layout";
import { getHomeHeaderScrollTopPadding } from "@/components/home/home-header-sheet";
import { HomeSignalTile } from "@/components/home/home-shared";
import { JobCarouselDots } from "@/components/home/job-carousel-dots";
import {
  InstructorJobCard,
  type InstructorMarketplaceJob,
} from "@/components/jobs/instructor/instructor-job-card";
import { useScrollSheetBindings } from "@/components/layout/scroll-sheet-provider";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import type { Id } from "@/convex/_generated/dataModel";
import { useAppInsets } from "@/hooks/use-app-insets";

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
  palette: BrandPalette;
  t: TFunction;
  totalEarningsAgorot: number;
  upcomingSessions: UpcomingSession[];
  onOpenJobs: () => void;
  onOpenStudio: (studioId: Id<"studioProfiles">, jobId: Id<"jobs">) => void;
};

function InstructorJobsEmptyState({ palette, t }: { palette: BrandPalette; t: TFunction }) {
  return (
    <HomeSurface palette={palette} style={{ padding: BrandSpacing.inset }}>
      <View style={{ alignItems: "center", gap: BrandSpacing.stackTight }}>
        <IconSymbol name="briefcase.fill" size={28} color={palette.textMuted as string} />
        <Text style={{ ...BrandType.title, color: palette.text as string }}>
          {t("home.instructor.noJobsAvailable")}
        </Text>
        <Text
          style={{
            ...BrandType.caption,
            color: palette.textMuted as string,
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
  palette,
  t,
  totalEarningsAgorot,
  upcomingSessions,
  onOpenJobs,
  onOpenStudio,
}: InstructorHomeContentProps) {
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const { safeTop } = useAppInsets();
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
    <View collapsable={false} style={{ flex: 1, backgroundColor: palette.appBg }}>
      <TabScreenScrollView
        animatedRef={scrollRef}
        onScroll={onScroll}
        routeKey="instructor/index"
        style={{ flex: 1 }}
        topInsetTone="sheet"
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.insetRoomy,
          paddingTop: getHomeHeaderScrollTopPadding(safeTop),
          paddingBottom: BrandSpacing.section,
          gap: BrandSpacing.section,
        }}
      >
        <Animated.View
          entering={FadeInUp.delay(70).duration(260)}
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
                  scrollEnabled={visibleAvailableJobs.length > 1}
                >
                  {visibleAvailableJobs.map((job) => (
                    <View
                      key={job.jobId}
                      style={{
                        width: cardWidth,
                        borderRadius: BrandRadius.soft,
                        overflow: "hidden",
                      }}
                    >
                      <InstructorJobCard
                        job={job}
                        locale={locale}
                        zoneLanguage={zoneLanguage}
                        palette={palette}
                        now={now}
                        onApply={() => onOpenStudio(job.studioId, job.jobId)}
                        onOpenStudio={onOpenStudio}
                        t={t}
                      />
                    </View>
                  ))}
                </Animated.ScrollView>
              </Animated.View>
            ) : (
              <InstructorJobsEmptyState palette={palette} t={t} />
            )}
          </View>

          {/* Stats tiles */}
          <View style={{ flex: layout.chartFlex, gap: BrandSpacing.stackTight }}>
            <View style={{ flexDirection: "row", gap: BrandSpacing.stackTight }}>
              <HomeSignalTile
                label={t("home.actions.jobsTitle")}
                value={String(availableJobsCount)}
                palette={palette}
                tone="accent"
                icon="briefcase.fill"
              />
              <HomeSignalTile
                label={t("home.instructor.pendingApps")}
                value={String(pendingApplications)}
                palette={palette}
                tone="warning"
                icon="clock.badge.checkmark"
              />
            </View>
            <View style={{ flexDirection: "row", gap: BrandSpacing.stackTight }}>
              <HomeSignalTile
                label={t("home.performance.earnings")}
                value={earningsLabel}
                palette={palette}
                tone="success"
                icon="banknote"
              />
              <HomeSignalTile
                label={t("home.shared.jobsFilled")}
                value={completionLabel}
                palette={palette}
                tone="accent"
                icon="checkmark.circle.fill"
              />
            </View>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(140).duration(280)}
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
            palette={palette}
            t={t}
            locale={locale}
            maxItems={layout.isWideWeb ? 8 : 5}
            maxHeight={layout.isWideWeb ? 360 : 280}
            heading={t("home.instructor.nextTitle")}
            emptyLabel={t("home.instructor.noUpcoming")}
            onPressAll={onOpenJobs}
          />
        </Animated.View>
      </TabScreenScrollView>
    </View>
  );
}
