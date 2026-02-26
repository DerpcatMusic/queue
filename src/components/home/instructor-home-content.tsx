import { toSportLabel } from "@/convex/constants";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { AppSymbol } from "@/components/ui/app-symbol";
import { BrandSpacing } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { formatDateTime } from "@/lib/jobs-utils";
import type { BrandPalette } from "@/constants/brand";
import {
  getRelativeTimeLabel,
} from "@/components/home/home-shared";
import { HomeHeaderSheet } from "@/components/home/home-header-sheet";
import type { TFunction } from "i18next";
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedRef,
  useScrollViewOffset,
} from "react-native-reanimated";

type UpcomingSession = {
  applicationId: string;
  sport: string;
  studioName: string;
  zone: string;
  startTime: number;
  pay: number;
};

type InstructorHomeContentProps = {
  displayName: string;
  locale: string;
  openMatches: number;
  pendingApplications: number;
  totalEarnings: number;
  palette: BrandPalette;
  currencyFormatter: Intl.NumberFormat;
  t: TFunction;
  upcomingSessions: UpcomingSession[];
  sports: string[] | undefined;
  onOpenCalendar: () => void;
  onOpenJobs: () => void;
};

type MetricTileProps = {
  label: string;
  value: number;
  palette: BrandPalette;
  onPress: () => void;
  accentIcon: string;
  accentColor: string;
};

function MetricTile({ label, value, palette, onPress, accentIcon, accentColor }: MetricTileProps) {
  return (
    <Pressable
      className="active:opacity-80 flex-1 rounded-[32px] p-6 justify-between gap-6"
      onPress={onPress}
      style={[
        {
          backgroundColor: palette.surfaceAlt as string,
          borderCurve: "continuous",
        },
      ]}
    >
      <View className="flex-row items-start justify-between">
        <Text
          className="font-heading text-5xl"
          style={{ color: palette.text as string, fontVariant: ["tabular-nums"] }}
        >
          {value}
        </Text>
        <View
          className="h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: palette.surface as string }}
        >
          <AppSymbol name={accentIcon} size={20} tintColor={accentColor} />
        </View>
      </View>
      <Text className="font-bodyStrong text-sm opacity-80" style={{ color: palette.text as string }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function InstructorHomeContent({
  displayName,
  locale,
  openMatches,
  pendingApplications,
  totalEarnings,
  palette,
  currencyFormatter,
  t,
  upcomingSessions,
  sports,
  onOpenCalendar,
  onOpenJobs,
}: InstructorHomeContentProps) {
  const now = Date.now();
  const focusSession = upcomingSessions[0] ?? null;
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef);
  const SHEET_EXPANDED_HEIGHT = 168; // Match HomeHeaderSheet expansion
  const sheetTotalHeight = SHEET_EXPANDED_HEIGHT + BrandSpacing.lg;

  return (
    <View style={{ flex: 1, backgroundColor: palette.appBg }}>
      <HomeHeaderSheet
        displayName={displayName}
        scrollY={scrollY}
        palette={palette}
        statsLabel={openMatches > 0 ? t("home.shared.matches") : t("home.shared.pending")}
        statsValue={String(openMatches > 0 ? openMatches : pendingApplications)}
        extraStatsLabel={t("home.shared.totalEarnings")}
        extraStatsValue={currencyFormatter.format(totalEarnings)}
        sports={sports}
      />
      <TabScreenScrollView
        animatedRef={scrollRef}
        routeKey="instructor/index"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: BrandSpacing.xxl, gap: 0, paddingTop: sheetTotalHeight }}
      >
      {/* Content starts below sheet — header section removed (handled by HomeHeaderSheet) */}
      <View className="px-6 gap-8">
        <Animated.View entering={FadeInUp.delay(100).duration(450).springify().damping(20)}>
          <Pressable
            className="active:opacity-90 p-7"
            onPress={focusSession ? onOpenCalendar : onOpenJobs}
            style={[
              {
                backgroundColor: palette.primary as string,
                borderRadius: 36,
                borderCurve: "continuous",
                shadowColor: palette.primary as string,
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.35,
                shadowRadius: 24,
                elevation: 10,
              },
            ]}
          >
            <View className="mb-6 flex-row items-center justify-between">
              <View
                className="rounded-full px-4 py-2"
                style={{ backgroundColor: "rgba(0,0,0,0.15)" }}
              >
                <View className="flex-row items-center gap-2">
                  <AppSymbol
                    name={focusSession ? "calendar.circle.fill" : "briefcase.fill"}
                    tintColor={palette.onPrimary as string}
                    size={18}
                  />
                  <Text className="font-title text-sm" style={{ color: palette.onPrimary as string }}>
                    {focusSession ? t("home.actions.calendarTitle") : t("home.actions.jobsTitle")}
                  </Text>
                </View>
              </View>
              <View
                className="h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(0,0,0,0.15)" }}
              >
                <AppSymbol name="arrow.right" tintColor={palette.onPrimary as string} size={20} />
              </View>
            </View>

            <Text className="font-heading text-5xl tracking-tight" style={{ color: palette.onPrimary as string }}>
              {focusSession ? toSportLabel(focusSession.sport as never) : t("home.actions.jobsTitle")}
            </Text>
            <Text className="mt-3 font-bodyStrong text-xl opacity-90" style={{ color: palette.onPrimary as string }}>
              {focusSession
                ? getRelativeTimeLabel(focusSession.startTime, now, locale)
                : pendingApplications > 0
                  ? t("jobsTab.applicationSummary", { count: pendingApplications })
                  : t("home.actions.jobsSubtitle", { count: openMatches })}
            </Text>
          </Pressable>
        </Animated.View>

        {/* 3. Layered Metric Tiles */}
        <Animated.View entering={FadeInUp.delay(150).duration(450)} className="gap-3">
          <View className="flex-row gap-4">
            <MetricTile
              label={t("home.instructor.stats.matchesLabel")}
              value={openMatches}
              palette={palette}
              onPress={onOpenJobs}
              accentIcon="flame.fill"
              accentColor={palette.primary as string}
            />
            <MetricTile
              label={t("home.instructor.stats.pendingLabel")}
              value={pendingApplications}
              palette={palette}
              onPress={onOpenJobs}
              accentIcon="clock.fill"
              accentColor={palette.warning as string}
            />
          </View>
        </Animated.View>

        {/* 4. Bold Upcoming Sessions List */}
        <Animated.View entering={FadeInUp.delay(200).duration(450)} className="gap-5 pb-10 pt-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-heading text-3xl" style={{ color: palette.text as string }}>
              {t("home.instructor.nextTitle")}
            </Text>
            {upcomingSessions.length > 0 && (
              <AppSymbol name="calendar.badge.clock" size={24} tintColor={palette.textMuted as string} />
            )}
          </View>

          {upcomingSessions.length === 0 ? (
            <View
              className="items-center gap-4 rounded-[32px] p-10 border-2 border-dashed"
              style={{
                backgroundColor: palette.surface as string,
                borderColor: palette.border as string,
                borderCurve: "continuous",
              }}
            >
              <View className="h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: palette.surfaceAlt as string }}>
                <AppSymbol name="gym.bag.fill" size={36} tintColor={palette.textMuted as string} />
              </View>
              <Text className="font-title text-xl text-center" style={{ color: palette.text as string }}>
                {t("home.instructor.noUpcoming")}
              </Text>
              <Text className="font-body text-base text-center" style={{ color: palette.textMuted as string }}>
                {t("home.actions.jobsSubtitle", { count: openMatches })}
              </Text>
            </View>
          ) : (
            <View className="gap-6">
              {upcomingSessions.map((session, index) => (
                <Animated.View
                  key={session.applicationId}
                  entering={FadeInUp.delay(250 + index * 50).duration(400).springify().damping(18)}
                >
                  <View
                    className="rounded-[32px] p-6 border-l-8"
                    style={{
                      backgroundColor: palette.surface as string,
                      borderCurve: "continuous",
                      borderLeftColor: palette.primary as string,
                    }}
                  >
                    <View className="mb-4">
                      <Text className="font-heading text-4xl mb-1" style={{ color: palette.text as string }}>
                        {toSportLabel(session.sport as never)}
                      </Text>
                      <View className="flex-row items-center gap-2">
                        <AppSymbol name="building.2.fill" size={14} tintColor={palette.textMuted as string} />
                        <Text className="font-bodyStrong text-base" style={{ color: palette.textMuted as string }}>
                          {session.studioName}
                        </Text>
                      </View>
                    </View>

                    <View className="mb-5 flex-row flex-wrap gap-3">
                      <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: palette.surfaceAlt as string }}>
                        <AppSymbol name="clock.fill" size={12} tintColor={palette.text as string} />
                        <Text className="font-title text-sm" style={{ color: palette.text as string }}>
                          {formatDateTime(session.startTime, locale)}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: palette.surfaceAlt as string }}>
                        <AppSymbol name="mappin.and.ellipse" size={12} tintColor={palette.text as string} />
                        <Text className="font-title text-sm" style={{ color: palette.text as string }}>
                          {getZoneLabel(session.zone, zoneLanguage)}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-end justify-between border-t border-dashed pt-5" style={{ borderColor: palette.borderStrong as string }}>
                      <Text
                        className="font-heading text-5xl"
                        style={{ color: palette.text as string, fontVariant: ["tabular-nums"] }}
                      >
                        {currencyFormatter.format(session.pay)}
                      </Text>
                      <View className="rounded-2xl px-4 py-2" style={{ backgroundColor: palette.primarySubtle as string, borderCurve: "continuous" }}>
                        <Text className="font-title text-sm" style={{ color: palette.primary as string }}>
                          {getRelativeTimeLabel(session.startTime, now, locale)}
                        </Text>
                      </View>
                    </View>
                  </View>
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
