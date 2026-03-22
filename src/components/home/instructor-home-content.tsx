import type { TFunction } from "i18next";
import { useMemo } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { HomeAgendaWidget } from "@/components/home/home-agenda-widget";
import { HomeSurface, useHomeDashboardLayout } from "@/components/home/home-dashboard-layout";
import { getHomeHeaderScrollTopPadding } from "@/components/home/home-header-sheet";
import { getRelativeTimeLabel, HomeSignalTile } from "@/components/home/home-shared";
import { useScrollSheetBindings } from "@/components/layout/scroll-sheet-provider";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
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
  isVerified?: boolean;
  currencyFormatter: Intl.NumberFormat;
  locale: string;
  lessonsCompleted: number;
  openMatches: number;
  pendingApplications: number;
  palette: BrandPalette;
  t: TFunction;
  totalEarningsAgorot: number;
  upcomingSessions: UpcomingSession[];
  onOpenJobs: () => void;
  onOpenProfile: () => void;
};

export function InstructorHomeContent({
  isVerified = false,
  currencyFormatter,
  locale,
  lessonsCompleted,
  openMatches,
  pendingApplications,
  palette,
  t,
  totalEarningsAgorot,
  upcomingSessions,
  onOpenJobs,
  onOpenProfile,
}: InstructorHomeContentProps) {
  const now = useMemo(() => Date.now(), []);
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const { safeTop } = useAppInsets();
  const layout = useHomeDashboardLayout();
  const { scrollRef, onScroll } = useScrollSheetBindings();

  const nextSession = upcomingSessions[0] ?? null;
  const earningsLabel = currencyFormatter.format(totalEarningsAgorot / 100);
  const completionLabel = String(lessonsCompleted);
  const verificationLabel = isVerified
    ? t("home.instructor.verified")
    : t("home.instructor.needsPolish");
  const focusTitle = nextSession
    ? toSportLabel(nextSession.sport as never)
    : t("home.instructor.heroMatches", { count: openMatches });
  const focusSubtitle = nextSession ? nextSession.studioName : verificationLabel;
  const focusMeta = nextSession
    ? [
        getRelativeTimeLabel(nextSession.startTime, now, locale),
        getZoneLabel(nextSession.zone, zoneLanguage),
      ].join("  ·  ")
    : t("home.instructor.pendingApps", { count: pendingApplications });

  return (
    <View collapsable={false} style={{ flex: 1, backgroundColor: palette.appBg }}>
      <TabScreenScrollView
        animatedRef={scrollRef}
        onScroll={onScroll}
        routeKey="instructor/index"
        style={{ flex: 1 }}
        topInsetTone="sheet"
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.xl,
          paddingTop: getHomeHeaderScrollTopPadding(safeTop),
          paddingBottom: BrandSpacing.xxl,
          gap: layout.sectionGap,
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
          <HomeSurface
            palette={palette}
            tone="primary"
            style={{
              flex: layout.heroFlex,
              paddingHorizontal: BrandSpacing.xl,
              paddingVertical: BrandSpacing.lg,
              gap: BrandSpacing.md,
            }}
          >
            <View style={{ gap: 6 }}>
              <Text
                style={{
                  ...BrandType.micro,
                  color: palette.onPrimary as string,
                  opacity: 0.72,
                  letterSpacing: 0.8,
                }}
              >
                {nextSession ? t("home.instructor.eyebrowNext") : t("home.instructor.eyebrowBoard")}
              </Text>
              <View style={{ gap: 2 }}>
                <Text
                  style={{
                    ...BrandType.heading,
                    fontSize: layout.isWideWeb ? 34 : 28,
                    lineHeight: layout.isWideWeb ? 34 : 28,
                    color: palette.onPrimary as string,
                  }}
                >
                  {focusTitle}
                </Text>
                <Text
                  style={{
                    ...BrandType.bodyStrong,
                    color: palette.onPrimary as string,
                    opacity: 0.88,
                  }}
                >
                  {focusSubtitle}
                </Text>
                <Text
                  style={{
                    ...BrandType.caption,
                    color: palette.onPrimary as string,
                    opacity: 0.72,
                  }}
                >
                  {focusMeta}
                </Text>
              </View>
            </View>

            {nextSession ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  gap: 12,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      ...BrandType.micro,
                      color: palette.onPrimary as string,
                      opacity: 0.66,
                      letterSpacing: 0.5,
                    }}
                  >
                    {t("home.instructor.nextTitle")}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      ...BrandType.bodyStrong,
                      color: palette.onPrimary as string,
                    }}
                  >
                    {formatDateTime(nextSession.startTime, locale)}
                  </Text>
                </View>
                <Text
                  style={{
                    ...BrandType.bodyStrong,
                    color: palette.onPrimary as string,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {currencyFormatter.format(nextSession.pay)}
                </Text>
              </View>
            ) : null}

            <View style={{ flexDirection: "row", gap: BrandSpacing.sm }}>
              <View style={{ flex: 1 }}>
                <ActionButton
                  accessibilityLabel={t("home.actions.jobsTitle")}
                  label={t("home.actions.jobsTitle")}
                  onPress={onOpenJobs}
                  palette={palette}
                  tone="secondary"
                  fullWidth
                />
              </View>
              <View style={{ flex: 1 }}>
                <ActionButton
                  accessibilityLabel={t("home.actions.profileTitle")}
                  label={t("home.actions.profileTitle")}
                  onPress={onOpenProfile}
                  palette={palette}
                  tone="secondary"
                  fullWidth
                />
              </View>
            </View>
          </HomeSurface>

          <View style={{ flex: layout.chartFlex, gap: BrandSpacing.sm }}>
            <View style={{ flexDirection: "row", gap: BrandSpacing.sm }}>
              <HomeSignalTile
                label={t("home.actions.jobsTitle")}
                value={String(openMatches)}
                detail={t("home.instructor.heroMatches", { count: openMatches })}
                palette={palette}
                tone="accent"
                icon="briefcase.fill"
              />
              <HomeSignalTile
                label={t("home.instructor.pendingApps")}
                value={String(pendingApplications)}
                detail={verificationLabel}
                palette={palette}
                icon="clock.badge.checkmark"
              />
            </View>
            <View style={{ flexDirection: "row", gap: BrandSpacing.sm }}>
              <HomeSignalTile
                label={t("profile.earnings.title")}
                value={earningsLabel}
                detail={t("profile.earnings.totalPaid")}
                palette={palette}
                icon="banknote"
              />
              <HomeSignalTile
                label={t("home.studio.filled")}
                value={completionLabel}
                detail={t("home.agenda.title")}
                palette={palette}
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

          <HomeSurface
            palette={palette}
            tone="surface"
            style={{
              flex: 1,
              minHeight: layout.isWideWeb ? 360 : undefined,
              padding: BrandSpacing.lg,
              gap: BrandSpacing.md,
              justifyContent: "space-between",
            }}
          >
            <View style={{ gap: BrandSpacing.sm }}>
              <Text
                style={{
                  ...BrandType.micro,
                  color: palette.textMuted as string,
                  letterSpacing: 0.8,
                }}
              >
                {t("home.shared.title")}
              </Text>
              <Text
                style={{
                  ...BrandType.heading,
                  fontSize: 24,
                  lineHeight: 26,
                  color: palette.text as string,
                }}
              >
                {isVerified ? t("home.instructor.verified") : t("home.instructor.needsPolish")}
              </Text>
              <Text
                style={{
                  ...BrandType.body,
                  color: palette.textMuted as string,
                }}
              >
                {nextSession
                  ? t("home.instructor.waitingCount", { count: pendingApplications })
                  : t("home.instructor.profileSet")}
              </Text>
            </View>

            <View style={{ gap: BrandSpacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <IconSymbol name="sparkles" size={16} color={palette.primary as string} />
                <Text style={{ ...BrandType.bodyMedium, color: palette.text as string }}>
                  {verificationLabel}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <IconSymbol
                  name="calendar.badge.clock"
                  size={16}
                  color={palette.primary as string}
                />
                <Text style={{ ...BrandType.bodyMedium, color: palette.text as string }}>
                  {nextSession
                    ? getRelativeTimeLabel(nextSession.startTime, now, locale)
                    : t("home.instructor.noUpcoming")}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <IconSymbol name="location.circle" size={16} color={palette.primary as string} />
                <Text style={{ ...BrandType.bodyMedium, color: palette.text as string }}>
                  {nextSession
                    ? getZoneLabel(nextSession.zone, zoneLanguage)
                    : t("home.actions.profileTitle")}
                </Text>
              </View>
            </View>
          </HomeSurface>
        </Animated.View>
      </TabScreenScrollView>
    </View>
  );
}
