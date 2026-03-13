import type { TFunction } from "i18next";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedRef,
  useScrollViewOffset,
} from "react-native-reanimated";

import {
  HomeSectionHeading,
  HomeSurface,
  useHomeDashboardLayout,
} from "@/components/home/home-dashboard-layout";
import {
  getHomeHeaderScrollTopPadding,
  HomeHeaderSheet,
} from "@/components/home/home-header-sheet";
import {
  getRelativeTimeLabel,
  HomeSignalTile,
} from "@/components/home/home-shared";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import type { BrandPalette } from "@/constants/brand";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { toSportLabel } from "@/convex/constants";
import { useAppInsets } from "@/hooks/use-app-insets";
import { formatDateTime } from "@/lib/jobs-utils";

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
  profileImageUrl?: string | null | undefined;
  isVerified?: boolean;
  locale: string;
  openMatches: number;
  pendingApplications: number;
  palette: BrandPalette;
  currencyFormatter: Intl.NumberFormat;
  t: TFunction;
  upcomingSessions: UpcomingSession[];

  onOpenJobs: () => void;
  onOpenProfile: () => void;
};

export function InstructorHomeContent({
  displayName,
  profileImageUrl,
  isVerified = false,
  locale,
  openMatches,
  pendingApplications,
  palette,
  currencyFormatter,
  t,
  upcomingSessions,
  onOpenJobs,
  onOpenProfile,
}: InstructorHomeContentProps) {
  const now = useMemo(() => Date.now(), []);
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const { safeTop } = useAppInsets();
  const layout = useHomeDashboardLayout();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef);

  const nextSession = upcomingSessions[0] ?? null;
  const readinessLabel = isVerified
    ? t("home.instructor.verified", { defaultValue: "Verified and ready" })
    : t("home.instructor.needsPolish", {
        defaultValue: "Polish your profile",
      });
  const heroTitle = nextSession
    ? t("home.instructor.heroSession", {
        sport: toSportLabel(nextSession.sport as never),
        studio: nextSession.studioName,
        defaultValue: `${toSportLabel(nextSession.sport as never)} at ${nextSession.studioName}`,
      })
    : t("home.instructor.heroMatches", {
        count: openMatches,
        defaultValue: `${String(openMatches)} open matches near you`,
      });
  const heroSummary = nextSession
    ? [
        formatDateTime(nextSession.startTime, locale),
        getZoneLabel(nextSession.zone, zoneLanguage),
      ].join("  ·  ")
    : readinessLabel;
  const heroSecondaryValue =
    pendingApplications > 0
      ? t("home.instructor.waitingCount", {
          count: pendingApplications,
          defaultValue: `${String(pendingApplications)} waiting`,
        })
      : nextSession
        ? getRelativeTimeLabel(nextSession.startTime, now, locale)
        : t("home.instructor.profileSet", { defaultValue: "Profile set" });
  const visibleSessions = upcomingSessions.slice(0, layout.isWideWeb ? 6 : 4);

  return (
    <View
      collapsable={false}
      style={{ flex: 1, backgroundColor: palette.appBg }}
    >
      <HomeHeaderSheet
        displayName={displayName}
        subtitle={readinessLabel}
        profileImageUrl={profileImageUrl}
        scrollY={scrollY}
        palette={palette}
        isVerified={isVerified}
        onPressAvatar={onOpenProfile}
      />
      <TabScreenScrollView
        animatedRef={scrollRef}
        routeKey="instructor/index"
        style={{ flex: 1 }}
        topInsetTone="sheet"
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.xl,
          paddingTop: getHomeHeaderScrollTopPadding(safeTop),
          paddingBottom: BrandSpacing.xxl,
          gap: BrandSpacing.xl,
        }}
      >
        <Animated.View entering={FadeInUp.delay(80).duration(280)}>
          <HomeSurface
            palette={palette}
            tone="primary"
            style={{
              padding: BrandSpacing.xl,
              gap: BrandSpacing.lg,
            }}
          >
            <View style={{ gap: 6 }}>
              <Text
                style={{
                  ...BrandType.micro,
                  color: palette.onPrimary as string,
                  letterSpacing: 0.8,
                  opacity: 0.76,
                }}
              >
                {nextSession
                  ? t("home.instructor.eyebrowNext", {
                      defaultValue: "NEXT LESSON",
                    })
                  : t("home.instructor.eyebrowBoard", {
                      defaultValue: "JOBS BOARD",
                    })}
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
                  opacity: 0.84,
                }}
              >
                {heroSummary}
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <HomeSignalTile
                label={t("home.actions.jobsTitle", {
                  defaultValue: "Open jobs",
                })}
                value={String(openMatches)}
                detail={t("home.instructor.heroMatches", {
                  count: openMatches,
                  defaultValue: `${String(openMatches)} live now`,
                })}
                palette={palette}
              />
              <HomeSignalTile
                label={t("home.instructor.pendingApps", {
                  defaultValue: "Pending applications",
                })}
                value={heroSecondaryValue}
                detail={readinessLabel}
                palette={palette}
                tone="accent"
              />
            </View>

            <View
              style={{
                flexDirection: layout.isWideWeb ? "row" : "column",
                gap: 10,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("home.actions.jobsTitle", {
                  defaultValue: "Open jobs",
                })}
                onPress={onOpenJobs}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 50,
                  borderRadius: 18,
                  borderCurve: "continuous",
                  backgroundColor: palette.surface as string,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 16,
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <Text
                  style={{
                    ...BrandType.bodyStrong,
                    color: palette.text as string,
                  }}
                >
                  {t("home.actions.jobsTitle", { defaultValue: "Open jobs" })}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("home.actions.profileTitle", {
                  defaultValue: "Open profile",
                })}
                onPress={onOpenProfile}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 50,
                  borderRadius: 18,
                  borderCurve: "continuous",
                  backgroundColor: palette.primarySubtle as string,
                  borderWidth: 1,
                  borderColor: palette.borderStrong as string,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 16,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text
                  style={{
                    ...BrandType.bodyStrong,
                    color: palette.primary as string,
                  }}
                >
                  {t("home.actions.profileTitle", {
                    defaultValue: "Open profile",
                  })}
                </Text>
              </Pressable>
            </View>
          </HomeSurface>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(180).duration(320)}
          style={{ gap: 12 }}
        >
          <HomeSectionHeading
            title={t("home.instructor.nextTitle")}
            eyebrow={t("home.instructor.scheduleEyebrow", {
              defaultValue: "SCHEDULE",
            })}
            palette={palette}
          />
          {upcomingSessions.length === 0 ? (
            <HomeSurface palette={palette} style={{ padding: 18, gap: 6 }}>
              <Text
                style={{ ...BrandType.title, color: palette.text as string }}
              >
                {t("home.instructor.noUpcoming")}
              </Text>
              <Text
                style={{
                  ...BrandType.caption,
                  color: palette.textMuted as string,
                }}
              >
                {t("home.instructor.emptySchedule", {
                  defaultValue:
                    "The jobs board is live when you want the next one.",
                })}
              </Text>
            </HomeSurface>
          ) : (
            <View
              style={{
                flexDirection: layout.isWideWeb ? "row" : "column",
                flexWrap: layout.isWideWeb ? "wrap" : "nowrap",
                gap: 10,
              }}
            >
              {visibleSessions.map((session, index) => (
                <Animated.View
                  key={session.applicationId}
                  entering={FadeInUp.delay(220 + index * 35)
                    .duration(260)
                    .springify()
                    .damping(18)}
                  style={{ width: layout.isWideWeb ? "48.9%" : "100%" }}
                >
                  <HomeSurface
                    palette={palette}
                    style={{
                      flexDirection: "row",
                      alignItems: "stretch",
                      gap: 12,
                      padding: 16,
                    }}
                  >
                    <View
                      style={{
                        width: 72,
                        justifyContent: "space-between",
                        paddingVertical: 2,
                      }}
                    >
                      <Text
                        style={{
                          ...BrandType.micro,
                          color: palette.primary as string,
                          letterSpacing: 0.6,
                          textTransform: "uppercase",
                        }}
                      >
                        {t("home.instructor.scheduleEyebrow", {
                          defaultValue: "Schedule",
                        })}
                      </Text>
                      <Text
                        selectable
                        style={{
                          ...BrandType.heading,
                          fontSize: 24,
                          lineHeight: 24,
                          color: palette.text as string,
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {new Date(session.startTime).toLocaleTimeString(
                          locale,
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </Text>
                      <Text
                        style={{
                          ...BrandType.micro,
                          color: palette.textMuted as string,
                        }}
                      >
                        {getRelativeTimeLabel(session.startTime, now, locale)}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text
                            style={{
                              ...BrandType.title,
                              color: palette.text as string,
                            }}
                            numberOfLines={1}
                          >
                            {toSportLabel(session.sport as never)}
                          </Text>
                          <Text
                            style={{
                              ...BrandType.micro,
                              color: palette.primary as string,
                            }}
                            numberOfLines={1}
                          >
                            {session.studioName}
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
                          {currencyFormatter.format(session.pay)}
                        </Text>
                      </View>
                      <Text
                        style={{
                          ...BrandType.caption,
                          color: palette.textMuted as string,
                        }}
                      >
                        {[
                          formatDateTime(session.startTime, locale),
                          getZoneLabel(session.zone, zoneLanguage),
                        ].join("  ·  ")}
                      </Text>
                    </View>
                  </HomeSurface>
                </Animated.View>
              ))}
            </View>
          )}
        </Animated.View>
      </TabScreenScrollView>
    </View>
  );
}
