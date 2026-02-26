import { toSportLabel } from "@/convex/constants";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { AppSymbol } from "@/components/ui/app-symbol";
import { BrandSpacing } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import type { BrandPalette } from "@/constants/brand";
import { HomeHeaderSheet } from "@/components/home/home-header-sheet";
import type { TFunction } from "i18next";
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedRef,
  useScrollViewOffset,
} from "react-native-reanimated";

type RecentJob = {
  jobId: string;
  sport: string;
  status: "open" | "assigned" | "completed" | "cancelled" | "filled";
  zone: string;
  startTime: number;
  pay: number;
  pendingApplicationsCount: number;
};

type StudioHomeContentProps = {
  displayName: string;
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

export function StudioHomeContent({
  displayName,
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
}: StudioHomeContentProps) {
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const jobsNeedingReview = recentJobs.filter((job) => job.pendingApplicationsCount > 0).slice(0, 3);
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
        statsLabel={pendingApplicants > 0 ? t("home.shared.pending") : t("home.shared.open")}
        statsValue={String(pendingApplicants > 0 ? pendingApplicants : openJobs)}
        extraStatsLabel={t("home.shared.jobsFilled")}
        extraStatsValue={String(jobsFilled)}
        sports={sports}
      />
      <TabScreenScrollView
        animatedRef={scrollRef}
        routeKey="studio/index"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: BrandSpacing.xxl, gap: 0, paddingTop: sheetTotalHeight }}
      >
      {/* Content starts below sheet — header section removed (handled by HomeHeaderSheet) */}
      <View className="px-6 gap-8">
        <Animated.View entering={FadeInUp.delay(100).duration(450).springify().damping(20)}>
          <Pressable
            className="active:opacity-90 p-7"
            onPress={pendingApplicants > 0 ? onOpenJobs : onOpenCalendar}
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
                    name={pendingApplicants > 0 ? "person.3.sequence.fill" : "calendar.badge.plus"}
                    tintColor={palette.onPrimary as string}
                    size={18}
                  />
                  <Text className="font-title text-sm" style={{ color: palette.onPrimary as string }}>
                    {pendingApplicants > 0 ? t("home.actions.jobsTitle") : t("home.actions.calendarTitle")}
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
              {pendingApplicants > 0 ? t("home.actions.jobsTitle") : t("home.actions.calendarTitle")}
            </Text>
            <Text className="mt-3 font-bodyStrong text-xl opacity-90" style={{ color: palette.onPrimary as string }}>
              {pendingApplicants > 0
                ? t("jobsTab.applicationSummary", { count: pendingApplicants })
                : t("home.actions.calendarSubtitle", { count: openJobs })}
            </Text>
          </Pressable>
        </Animated.View>

        {/* 3. Layered Metric Tiles */}
        <Animated.View entering={FadeInUp.delay(150).duration(450)} className="gap-3">
          <View className="flex-row gap-4">
            <MetricTile
              label={t("home.studio.stats.openLabel")}
              value={openJobs}
              palette={palette}
              onPress={onOpenCalendar}
              accentIcon="briefcase.fill"
              accentColor={palette.primary as string}
            />
            <MetricTile
              label={t("home.studio.stats.pendingLabel")}
              value={pendingApplicants}
              palette={palette}
              onPress={onOpenJobs}
              accentIcon="person.3.sequence.fill"
              accentColor={palette.warning as string}
            />
          </View>
        </Animated.View>

        {/* 4. Attention Required Stack */}
        {jobsNeedingReview.length > 0 && (
          <Animated.View entering={FadeInUp.delay(200).duration(450)} className="gap-5 pt-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-heading text-3xl" style={{ color: palette.text as string }}>
                {t("jobsTab.studioApplicationsTitle")}
              </Text>
              <AppSymbol name="exclamationmark.circle.fill" size={24} tintColor={palette.warning as string} />
            </View>
            <View className="gap-6">
              {jobsNeedingReview.map((job, index) => (
                <Animated.View key={`review-${job.jobId}`} entering={FadeInUp.delay(250 + index * 50).duration(400).springify().damping(18)}>
                  <Pressable
                    onPress={onOpenJobs}
                    className="active:opacity-80 rounded-[32px] p-6 border-l-8"
                    style={[
                      {
                        backgroundColor: palette.surface as string,
                        borderCurve: "continuous",
                        borderLeftColor: palette.primary as string,
                        borderColor: palette.border as string,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.05,
                        shadowRadius: 10,
                        elevation: 2,
                      },
                    ]}
                  >
                    <View className="mb-4">
                      <Text className="font-heading text-4xl mb-1" style={{ color: palette.text as string }}>
                        {toSportLabel(job.sport as never)}
                      </Text>
                    </View>

                    <View className="mb-5 flex-row flex-wrap gap-3">
                      <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: palette.surfaceAlt as string }}>
                        <AppSymbol name="calendar" size={12} tintColor={palette.text as string} />
                        <Text className="font-title text-sm" style={{ color: palette.text as string }}>
                          {new Date(job.startTime).toLocaleDateString(locale)}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: palette.surfaceAlt as string }}>
                        <AppSymbol name="mappin.and.ellipse" size={12} tintColor={palette.text as string} />
                        <Text className="font-title text-sm" style={{ color: palette.text as string }}>
                          {getZoneLabel(job.zone, zoneLanguage)}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-end justify-between border-t border-dashed pt-5" style={{ borderColor: palette.primarySubtle as string }}>
                      <View className="flex-row items-center gap-3">
                        <AppSymbol name="person.3.sequence.fill" size={28} tintColor={palette.primary as string} />
                        <Text className="font-heading text-5xl" style={{ color: palette.primary as string, fontVariant: ["tabular-nums"] }}>
                          {job.pendingApplicationsCount}
                        </Text>
                      </View>
                      <View className="rounded-2xl px-4 py-2" style={{ backgroundColor: palette.primarySubtle as string, borderCurve: "continuous" }}>
                        <Text className="font-title text-sm" style={{ color: palette.primary as string }}>
                          {t("home.studio.stats.pendingLabel")}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* 5. Bold Recent Jobs List */}
        <Animated.View entering={FadeInUp.delay(jobsNeedingReview.length > 0 ? 300 : 200).duration(450)} className="gap-5 pb-10 pt-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-heading text-3xl" style={{ color: palette.text as string }}>
              {t("home.studio.recentTitle")}
            </Text>
            {recentJobs.length > 0 && (
              <AppSymbol name="bag.badge.plus" size={24} tintColor={palette.textMuted as string} />
            )}
          </View>

          {recentJobs.length === 0 ? (
            <View
              className="items-center gap-4 rounded-[32px] p-10 border-2 border-dashed"
              style={{
                backgroundColor: palette.surface as string,
                borderColor: palette.border as string,
                borderCurve: "continuous",
              }}
            >
              <View className="h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: palette.surfaceAlt as string }}>
                <AppSymbol name="bag.badge.plus" size={36} tintColor={palette.textMuted as string} />
              </View>
              <Text className="font-title text-xl text-center" style={{ color: palette.text as string }}>
                {t("home.studio.noRecent")}
              </Text>
            </View>
          ) : (
            <View className="gap-6">
              {recentJobs.slice(0, 3).map((job, index) => (
                <Animated.View key={job.jobId} entering={FadeInUp.delay((jobsNeedingReview.length ? 350 : 250) + index * 50).duration(400).springify().damping(18)}>
                  <View
                    className="rounded-[32px] p-6 border border-b-4"
                    style={{
                      backgroundColor: palette.surfaceElevated as string,
                      borderColor: palette.border as string,
                      borderCurve: "continuous",
                    }}
                  >
                    <View className="mb-4">
                      <Text className="font-heading text-4xl mb-1" style={{ color: palette.text as string }}>
                        {toSportLabel(job.sport as never)}
                      </Text>
                    </View>

                    <View className="mb-5 flex-row flex-wrap gap-3">
                      <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: palette.surfaceAlt as string }}>
                        <AppSymbol name="calendar" size={12} tintColor={palette.text as string} />
                        <Text className="font-title text-sm" style={{ color: palette.text as string }}>
                          {new Date(job.startTime).toLocaleDateString(locale)}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: palette.surfaceAlt as string }}>
                        <AppSymbol name="mappin.and.ellipse" size={12} tintColor={palette.text as string} />
                        <Text className="font-title text-sm" style={{ color: palette.text as string }}>
                          {getZoneLabel(job.zone, zoneLanguage)}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-end justify-between border-t border-dashed pt-5" style={{ borderColor: palette.borderStrong as string }}>
                      <Text
                        className="font-heading text-5xl"
                        style={{ color: palette.text as string, fontVariant: ["tabular-nums"] }}
                      >
                        {currencyFormatter.format(job.pay)}
                      </Text>
                      <View className="rounded-2xl px-4 py-2" style={{ backgroundColor: palette.surfaceAlt as string, borderCurve: "continuous" }}>
                        <Text className="font-title text-sm" style={{ color: palette.text as string }}>
                          {t(`jobsTab.status.job.${job.status}`)}
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
