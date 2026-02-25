import { toSportLabel } from "@/convex/constants";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { KitSurface } from "@/components/ui/kit";
import { ThemedText } from "@/components/themed-text";
import { BrandSpacing, BrandRadius } from "@/constants/brand";
import type { BrandPalette } from "@/constants/brand";
import {
  CONTENT_VERTICAL_PADDING,
  getRelativeTimeLabel,
} from "@/components/home/home-shared";
import { formatDateTime } from "@/lib/jobs-utils";
import { getZoneLabel } from "@/constants/zones";
import { AppSymbol } from "@/components/ui/app-symbol";
import type { TFunction } from "i18next";
import { View, Pressable } from "react-native";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";

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
  memberSince: string;
  locale: string;
  openMatches: number;
  pendingApplications: number;
  palette: BrandPalette;
  currencyFormatter: Intl.NumberFormat;
  t: TFunction;
  upcomingSessions: UpcomingSession[];
  onOpenCalendar: () => void;
  onOpenJobs: () => void;
  isDataLoading: boolean;
};

export function InstructorHomeContent({
  displayName,
  memberSince,
  locale,
  openMatches,
  pendingApplications,
  palette,
  currencyFormatter,
  t,
  upcomingSessions,
  onOpenCalendar,
  onOpenJobs,
  isDataLoading,
}: InstructorHomeContentProps) {
  const now = Date.now();
  const focusSession = upcomingSessions[0] ?? null;

  return (
    <TabScreenScrollView
      routeKey="instructor/index"
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

      {/* Massive Bold Next Action / Session Banner */}
      <Animated.View entering={FadeInUp.delay(100).duration(400).springify()}>
        <Pressable onPress={focusSession ? onOpenCalendar : onOpenJobs}>
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
                  <AppSymbol name={focusSession ? "calendar.circle.fill" : "briefcase.fill"} tintColor={palette.onPrimary} size={24} />
                  <ThemedText type="caption" style={{ color: palette.onPrimary, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>
                    {focusSession ? t("home.actions.calendarTitle") : t("home.actions.jobsTitle")}
                  </ThemedText>
                </View>

                {focusSession ? (
                  <>
                    <ThemedText type="heading" style={{ color: palette.onPrimary, fontSize: 32, lineHeight: 36, letterSpacing: -1 }}>
                      {toSportLabel(focusSession.sport as never)}
                    </ThemedText>
                    <ThemedText type="bodyStrong" style={{ color: palette.onPrimary, opacity: 0.9 }}>
                      {getRelativeTimeLabel(focusSession.startTime, now, locale)}
                    </ThemedText>
                  </>
                ) : (
                  <>
                    <ThemedText type="heading" style={{ color: palette.onPrimary, fontSize: 32, lineHeight: 36, letterSpacing: -1 }}>
                      {t("home.actions.jobsTitle")}
                    </ThemedText>
                    <ThemedText type="bodyStrong" style={{ color: palette.onPrimary, opacity: 0.9 }}>
                      {pendingApplications > 0
                        ? t("jobsTab.applicationSummary", { count: pendingApplications })
                        : t("home.actions.jobsSubtitle", { count: openMatches })}
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
          {t("home.instructor.stats.matchesLabel")} & {t("home.instructor.stats.pendingLabel")}
        </ThemedText>
        <View style={{ flexDirection: "row", gap: BrandSpacing.md }}>
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
                {openMatches}
              </ThemedText>
              <ThemedText type="caption" style={{ color: palette.textMuted, fontWeight: "800", textTransform: "uppercase" }}>
                {t("home.instructor.stats.matchesLabel")}
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
                {pendingApplications}
              </ThemedText>
              <ThemedText type="caption" style={{ color: palette.textMuted, fontWeight: "800", textTransform: "uppercase" }}>
                {t("home.instructor.stats.pendingLabel")}
              </ThemedText>
            </KitSurface>
          </Pressable>
        </View>
      </Animated.View>

      {/* Upcoming Sessions List */}
      <Animated.View entering={FadeInUp.delay(220).duration(400).springify()} style={{ gap: BrandSpacing.sm, paddingBottom: BrandSpacing.xxl }}>
        <ThemedText type="title" style={{ fontWeight: "900", textTransform: "uppercase", letterSpacing: -0.5 }}>
          {t("home.instructor.nextTitle")}
        </ThemedText>

        {upcomingSessions.length === 0 ? (
          <KitSurface tone="elevated" style={{ padding: BrandSpacing.xl, alignItems: "center", gap: BrandSpacing.sm }}>
            <AppSymbol name="calendar.badge.exclamationmark" size={40} tintColor={palette.textMuted} />
            <ThemedText type="bodyStrong" style={{ color: palette.text }}>{t("home.instructor.noUpcoming")}</ThemedText>
            <ThemedText type="caption" style={{ color: palette.textMuted }}>{t("home.actions.jobsSubtitle", { count: openMatches })}</ThemedText>
          </KitSurface>
        ) : (
          <View style={{ gap: BrandSpacing.md }}>
            {upcomingSessions.map((session, index) => (
               <Animated.View
                key={session.applicationId}
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
                          {toSportLabel(session.sport as never)}
                        </ThemedText>
                        <ThemedText
                          type="bodyStrong"
                          style={{ color: palette.primary, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 }}
                        >
                          {session.studioName}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Details Row: Time & Zone */}
                    <View style={{ gap: 6, marginVertical: 4 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <AppSymbol name="calendar.circle.fill" size={16} tintColor={palette.textMuted} />
                        <ThemedText type="caption" style={{ color: palette.textMuted, fontWeight: "600" }}>
                          {formatDateTime(session.startTime, locale)}
                        </ThemedText>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <AppSymbol name="mappin.circle.fill" size={16} tintColor={palette.textMuted} />
                        <ThemedText type="caption" style={{ color: palette.textMuted, fontWeight: "600" }}>
                          {getZoneLabel(session.zone, locale.startsWith("he") ? "he" : "en")}
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
                           {currencyFormatter.format(session.pay)}
                        </ThemedText>
                      </View>
                      
                      {/* Push application context to the right using marginLeft auto */}
                      <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: BrandSpacing.xs }}>
                        <ThemedText style={{ color: palette.primary, fontWeight: "800", textTransform: "uppercase" }}>
                           {getRelativeTimeLabel(session.startTime, now, locale)}
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
