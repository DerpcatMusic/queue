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
import { getRelativeTimeLabel } from "@/components/home/home-shared";
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
    : t("home.instructor.needsPolish", { defaultValue: "Polish your profile" });
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
  const heroSecondaryLabel =
    pendingApplications > 0
      ? t("home.instructor.pendingApps", {
          defaultValue: "Pending applications",
        })
      : t("home.instructor.readyState", { defaultValue: "Ready state" });
  const heroSecondaryValue =
    pendingApplications > 0
      ? t("home.instructor.waitingCount", {
          count: pendingApplications,
          defaultValue: `${String(pendingApplications)} waiting`,
        })
      : nextSession
        ? getRelativeTimeLabel(nextSession.startTime, now, locale)
        : t("home.instructor.profileSet", { defaultValue: "Profile set" });
  const leadAction = !isVerified ? onOpenProfile : onOpenJobs;
  const leadActionHint = !isVerified
    ? t("home.actions.profileTitle", { defaultValue: "Open profile" })
    : t("home.actions.jobsTitle", { defaultValue: "Open jobs" });
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={leadActionHint}
            onPress={leadAction}
            style={({ pressed }) => ({
              opacity: pressed ? 0.94 : 1,
              transform: [{ scale: pressed ? 0.995 : 1 }],
            })}
          >
            <HomeSurface
              palette={palette}
              tone="surface"
              style={{
                padding: BrandSpacing.xl,
                gap: BrandSpacing.md,
              }}
            >
              <View style={{ gap: 6 }}>
                <Text
                  style={{
                    ...BrandType.micro,
                    color: palette.textMuted as string,
                    letterSpacing: 0.8,
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
                    fontSize: layout.isWideWeb ? 30 : 24,
                    lineHeight: layout.isWideWeb ? 32 : 26,
                    color: palette.text as string,
                  }}
                >
                  {heroTitle}
                </Text>
                <Text
                  style={{
                    ...BrandType.body,
                    color: palette.textMuted as string,
                  }}
                >
                  {nextSession
                    ? [
                        formatDateTime(nextSession.startTime, locale),
                        getZoneLabel(nextSession.zone, zoneLanguage),
                      ].join("  ·  ")
                    : t("home.instructor.heroMatches", {
                        count: openMatches,
                        defaultValue: `${String(openMatches)} open matches near you`,
                      })}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: layout.isWideWeb ? "row" : "column",
                  alignItems: layout.isWideWeb ? "center" : "stretch",
                  justifyContent: "space-between",
                  gap: BrandSpacing.md,
                }}
              >
                <Text
                  style={{
                    ...BrandType.bodyStrong,
                    color: palette.primary as string,
                  }}
                >
                  {`${heroSecondaryLabel}: ${heroSecondaryValue}`}
                </Text>
                <Text
                  style={{
                    ...BrandType.micro,
                    color: palette.textMuted as string,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                  }}
                >
                  {leadActionHint}
                </Text>
              </View>
            </HomeSurface>
          </Pressable>
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
