import { toSportLabel } from "@/convex/constants";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { KitSurface } from "@/components/ui/kit";
import { ThemedText } from "@/components/themed-text";
import { BrandSpacing, BrandRadius } from "@/constants/brand";
import type { BrandPalette } from "@/constants/brand";
import type { JobStatus } from "@/lib/status-tokens";
import { CONTENT_VERTICAL_PADDING } from "@/components/home/home-shared";
import { AppSymbol } from "@/components/ui/app-symbol";
import { getZoneLabel } from "@/constants/zones";
import type { TFunction } from "i18next";
import { View, Pressable } from "react-native";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";

type RecentJob = {
  jobId: string;
  sport: string;
  status: JobStatus;
  zone: string;
  startTime: number;
  pay: number;
  pendingApplicationsCount: number;
};

type StudioHomeContentProps = {
  displayName: string;
  memberSince: string;
  locale: string;
  openJobs: number;
  pendingApplicants: number;
  palette: BrandPalette;
  currencyFormatter: Intl.NumberFormat;
  t: TFunction;
  recentJobs: RecentJob[];
  onOpenJobs: () => void;
  onOpenCalendar: () => void;
  isDataLoading: boolean;
};

export function StudioHomeContent({
  displayName,
  memberSince,
  locale,
  openJobs,
  pendingApplicants,
  palette,
  currencyFormatter,
  t,
  recentJobs,
  onOpenJobs,
  onOpenCalendar,
  isDataLoading,
}: StudioHomeContentProps) {
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const jobsNeedingReview = recentJobs
    .filter((job) => job.pendingApplicationsCount > 0)
    .slice(0, 3);
    
  const hasPending = pendingApplicants > 0;

  return (
    <TabScreenScrollView
      routeKey="studio/index"
      style={{ flex: 1, backgroundColor: palette.appBg }}
      contentContainerStyle={{
        paddingHorizontal: BrandSpacing.lg,
        paddingVertical: CONTENT_VERTICAL_PADDING,
        gap: BrandSpacing.xl,
      }}
    >
      {/* Main Header */}
      <Animated.View entering={FadeIn.delay(40).duration(400)}>
        <ThemedText
          type="heading"
          style={{ fontSize: 40, lineHeight: 44, letterSpacing: -1.5, fontWeight: "900", color: palette.text, textTransform: "uppercase" }}
        >
          {displayName}
        </ThemedText>
        <ThemedText type="caption" style={{ color: palette.primary, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>
          {isDataLoading ? t("home.loading") : memberSince}
        </ThemedText>
      </Animated.View>

      {/* Massive Bold Primary Action Banner */}
      <Animated.View entering={FadeInUp.delay(100).duration(400).springify()}>
        <Pressable onPress={hasPending ? onOpenJobs : onOpenCalendar}>
          <KitSurface
            tone="base"
            style={{
              backgroundColor: palette.primary,
              borderColor: palette.primary,
              padding: BrandSpacing.xl,
              borderRadius: BrandRadius.card,
              borderCurve: "continuous",
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <AppSymbol name={hasPending ? "person.3.sequence.fill" : "calendar.badge.plus"} tintColor={palette.onPrimary} size={24} />
                  <ThemedText type="caption" style={{ color: palette.onPrimary, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>
                    {hasPending ? t("home.actions.jobsTitle") : t("home.actions.calendarTitle")}
                  </ThemedText>
                </View>

                {hasPending ? (
                  <>
                    <ThemedText type="heading" style={{ color: palette.onPrimary, fontSize: 32, lineHeight: 36, letterSpacing: -1 }}>
                      {t("home.actions.jobsTitle")}
                    </ThemedText>
                    <ThemedText type="bodyStrong" style={{ color: palette.onPrimary, opacity: 0.9 }}>
                      {t("jobsTab.applicationSummary", { count: pendingApplicants })}
                    </ThemedText>
                  </>
                ) : (
                  <>
                    <ThemedText type="heading" style={{ color: palette.onPrimary, fontSize: 32, lineHeight: 36, letterSpacing: -1 }}>
                      {t("home.actions.calendarTitle")}
                    </ThemedText>
                    <ThemedText type="bodyStrong" style={{ color: palette.onPrimary, opacity: 0.9 }}>
                      {t("home.actions.calendarSubtitle", { count: openJobs })}
                    </ThemedText>
                  </>
                )}
              </View>
              <View style={{
                backgroundColor: palette.onPrimary,
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center"
              }}>
                <AppSymbol name="arrow.right" tintColor={palette.primary} />
              </View>
            </View>
          </KitSurface>
        </Pressable>
      </Animated.View>

      {/* Stats Board */}
      <Animated.View entering={FadeInUp.delay(160).duration(400).springify()} style={{ gap: BrandSpacing.sm }}>
        <ThemedText type="title" style={{ fontWeight: "900", textTransform: "uppercase", letterSpacing: -0.5 }}>
          {t("home.studio.stats.openLabel")} & {t("home.studio.stats.pendingLabel")}
        </ThemedText>
        <View style={{ flexDirection: "row", gap: BrandSpacing.md }}>
          <Pressable style={{ flex: 1 }} onPress={onOpenCalendar}>
            <KitSurface tone="elevated" style={{ padding: BrandSpacing.lg, gap: 4, alignItems: "center" }}>
              <ThemedText
                style={{
                  fontSize: 48,
                  lineHeight: 50,
                  fontWeight: "900",
                  color: palette.text,
                  fontVariant: ["tabular-nums"],
                  letterSpacing: -2,
                }}
              >
                {openJobs}
              </ThemedText>
              <ThemedText type="caption" style={{ color: palette.textMuted, fontWeight: "800", textTransform: "uppercase", textAlign: "center" }}>
                {t("home.studio.stats.openLabel")}
              </ThemedText>
            </KitSurface>
          </Pressable>

          <Pressable style={{ flex: 1 }} onPress={onOpenJobs}>
            <KitSurface tone="elevated" style={{ padding: BrandSpacing.lg, gap: 4, alignItems: "center" }}>
              <ThemedText
                style={{
                  fontSize: 48,
                  lineHeight: 50,
                  fontWeight: "900",
                  color: palette.text,
                  fontVariant: ["tabular-nums"],
                  letterSpacing: -2,
                }}
              >
                {pendingApplicants}
              </ThemedText>
              <ThemedText type="caption" style={{ color: palette.textMuted, fontWeight: "800", textTransform: "uppercase", textAlign: "center" }}>
                {t("home.studio.stats.pendingLabel")}
              </ThemedText>
            </KitSurface>
          </Pressable>
        </View>
      </Animated.View>

      {/* Jobs Needing Review */}
      {jobsNeedingReview.length > 0 ? (
        <Animated.View entering={FadeInUp.delay(210).duration(400).springify()} style={{ gap: BrandSpacing.sm }}>
          <ThemedText type="title" style={{ fontWeight: "900", textTransform: "uppercase", letterSpacing: -0.5 }}>
            {t("jobsTab.studioApplicationsTitle")}
          </ThemedText>
          <View style={{ gap: BrandSpacing.sm }}>
            {jobsNeedingReview.map((job, index) => (
               <Animated.View
                key={`review-${job.jobId}`}
                entering={FadeInUp.delay(200 + index * 40).duration(400).springify()}
              >
                <Pressable onPress={onOpenJobs} style={{ position: "relative" }}>
                  <KitSurface
                    tone="elevated"
                    style={{
                      padding: BrandSpacing.lg,
                      gap: BrandSpacing.sm,
                      overflow: "hidden",
                      borderColor: palette.primary,
                      borderWidth: 1,
                    }}
                  >
                    {/* Header Row: Sport */}
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <ThemedText
                          style={{
                            fontSize: 28,
                            lineHeight: 32,
                            fontWeight: "900",
                            color: palette.text,
                            letterSpacing: -1,
                            textTransform: "uppercase",
                          }}
                        >
                          {toSportLabel(job.sport as never)}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Details Row: Time & Zone */}
                    <View style={{ gap: 6, marginVertical: 4 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <AppSymbol name="calendar.circle.fill" size={16} tintColor={palette.textMuted} />
                        <ThemedText type="caption" style={{ color: palette.textMuted, fontWeight: "600" }}>
                          {new Date(job.startTime).toLocaleDateString(locale)}
                        </ThemedText>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <AppSymbol name="mappin.circle.fill" size={16} tintColor={palette.textMuted} />
                        <ThemedText type="caption" style={{ color: palette.textMuted, fontWeight: "600" }}>
                          {getZoneLabel(job.zone, zoneLanguage)}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Footer Row: Padding/Count (Left) & Actions (Right) via flex layout */}
                    <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.border }}>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
                        <ThemedText
                          style={{
                            fontSize: 32,
                            fontWeight: "900",
                            color: palette.primary,
                            fontVariant: ["tabular-nums"],
                            letterSpacing: -1.5,
                          }}
                        >
                           {job.pendingApplicationsCount}
                        </ThemedText>
                      </View>
                      
                      {/* Push application context to the right using marginLeft auto */}
                      <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: BrandSpacing.xs }}>
                         <ThemedText style={{ color: palette.primary, fontWeight: "800", textTransform: "uppercase", fontSize: 13, letterSpacing: 0.5 }}>
                           {t("home.studio.stats.pendingLabel")}
                         </ThemedText>
                      </View>
                    </View>
                  </KitSurface>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      ) : null}

      {/* Recent Jobs List */}
      <Animated.View entering={FadeInUp.delay(240).duration(400).springify()} style={{ gap: BrandSpacing.sm, paddingBottom: BrandSpacing.xxl }}>
        <ThemedText type="title" style={{ fontWeight: "900", textTransform: "uppercase", letterSpacing: -0.5 }}>
          {t("home.studio.recentTitle")}
        </ThemedText>

        {recentJobs.length === 0 ? (
          <KitSurface tone="elevated" style={{ padding: BrandSpacing.xl, alignItems: "center", gap: BrandSpacing.sm }}>
            <AppSymbol name="bag.badge.plus" size={40} tintColor={palette.textMuted} />
            <ThemedText type="bodyStrong" style={{ color: palette.text }}>{t("home.studio.noRecent")}</ThemedText>
          </KitSurface>
        ) : (
          <View style={{ gap: BrandSpacing.md }}>
            {recentJobs.slice(0, 3).map((job, index) => (
              <Animated.View
                key={job.jobId}
                entering={FadeInUp.delay(200 + index * 40).duration(400).springify()}
              >
                <View style={{ position: "relative" }}>
                  <KitSurface
                    tone="elevated"
                    style={{
                      padding: BrandSpacing.lg,
                      gap: BrandSpacing.sm,
                      overflow: "hidden",
                    }}
                  >
                    {/* Header Row: Sport */}
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <ThemedText
                          style={{
                            fontSize: 28,
                            lineHeight: 32,
                            fontWeight: "900",
                            color: palette.text,
                            letterSpacing: -1,
                            textTransform: "uppercase",
                          }}
                        >
                          {toSportLabel(job.sport as never)}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Details Row: Time & Zone */}
                    <View style={{ gap: 6, marginVertical: 4 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <AppSymbol name="calendar.circle.fill" size={16} tintColor={palette.textMuted} />
                        <ThemedText type="caption" style={{ color: palette.textMuted, fontWeight: "600" }}>
                          {new Date(job.startTime).toLocaleDateString(locale)}
                        </ThemedText>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <AppSymbol name="mappin.circle.fill" size={16} tintColor={palette.textMuted} />
                        <ThemedText type="caption" style={{ color: palette.textMuted, fontWeight: "600" }}>
                          {getZoneLabel(job.zone, zoneLanguage)}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Footer Row: Price (Left) & Actions/Count via flex layout */}
                    <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.border }}>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
                        <ThemedText
                          style={{
                            fontSize: 32,
                            fontWeight: "900",
                            color: palette.text,
                            fontVariant: ["tabular-nums"],
                            letterSpacing: -1.5,
                          }}
                        >
                           {currencyFormatter.format(job.pay)}
                        </ThemedText>
                      </View>
                      
                      {/* Push application context to the right using marginLeft auto */}
                      <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: BrandSpacing.xs }}>
                         <ThemedText style={{ color: palette.textMuted, fontWeight: "800", textTransform: "uppercase", fontSize: 13, letterSpacing: 0.5 }}>
                           {t(`jobsTab.status.job.${job.status}`)}
                         </ThemedText>
                      </View>
                    </View>
                  </KitSurface>
                </View>
              </Animated.View>
            ))}
          </View>
        )}
      </Animated.View>
    </TabScreenScrollView>
  );
}
