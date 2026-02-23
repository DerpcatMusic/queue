import { toSportLabel } from "@/convex/constants";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeList, NativeListItem } from "@/components/ui/native-list";
import { ThemedText } from "@/components/themed-text";
import { BrandSpacing } from "@/constants/brand";
import type { BrandPalette } from "@/constants/brand";
import {
  CONTENT_VERTICAL_PADDING,
  getRelativeTimeLabel,
  HeroBlock,
  PrimaryActionCard,
  StatusPill,
} from "@/components/home/home-shared";
import type { TFunction } from "i18next";
import { ScrollView, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

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
  const openMatchesSubtitleKey =
    openMatches >= 80 ? "home.actions.jobsSubtitleOverflow" : "home.actions.jobsSubtitle";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.appBg }}
      contentContainerStyle={{
        paddingHorizontal: BrandSpacing.lg,
        paddingVertical: CONTENT_VERTICAL_PADDING,
        gap: BrandSpacing.lg,
      }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <HeroBlock
        title={t("home.instructor.greeting", { name: displayName })}
        subtitle={isDataLoading ? t("home.loading") : memberSince}
        palette={palette}
        metrics={[
          { label: t("home.instructor.stats.matchesLabel"), value: openMatches },
          { label: t("home.instructor.stats.pendingLabel"), value: pendingApplications },
          { label: t("home.actions.calendarTitle"), value: upcomingSessions.length },
        ]}
      />

      {upcomingSessions.length > 0 ? (
        <PrimaryActionCard
          title={t("home.actions.calendarTitle")}
          subtitle={t("home.actions.calendarSubtitle", { count: upcomingSessions.length })}
          icon="calendar.circle.fill"
          onPress={onOpenCalendar}
          palette={palette}
        />
      ) : openMatches > 0 ? (
        <PrimaryActionCard
          title={t("home.actions.jobsTitle")}
          subtitle={t(openMatchesSubtitleKey, { count: openMatches })}
          icon="briefcase.fill"
          onPress={onOpenJobs}
          palette={palette}
        />
      ) : null}

      <Animated.View entering={FadeInUp.delay(220).duration(360).springify()}>
        <View style={{ gap: BrandSpacing.xs, marginBottom: BrandSpacing.sm, paddingHorizontal: BrandSpacing.xs }}>
          <ThemedText type="title">{t("home.instructor.nextTitle")}</ThemedText>
          <ThemedText type="caption" style={{ color: palette.textMuted }}>
            {t("home.instructor.nextSubtitle")}
          </ThemedText>
        </View>

        {upcomingSessions.length === 0 ? (
          <EmptyState
            icon="calendar.badge.exclamationmark"
            title={t("home.instructor.noUpcoming")}
            body={t(openMatchesSubtitleKey, { count: openMatches })}
            action={{
              label: t("home.actions.jobsTitle"),
              icon: "briefcase",
              onPress: onOpenJobs,
            }}
          />
        ) : (
          <NativeList inset>
            {upcomingSessions.map((session) => (
              <NativeListItem
                key={session.applicationId}
                title={toSportLabel(session.sport as never)}
                accessory={
                  <StatusPill
                    label={getRelativeTimeLabel(session.startTime, now, locale)}
                    status="upcoming"
                    palette={palette}
                  />
                }
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
                  <ThemedText type="caption" style={{ color: palette.textMuted }} numberOfLines={1}>
                    {session.studioName} • {session.zone}
                  </ThemedText>
                  <ThemedText type="bodyStrong" style={{ color: palette.success, fontVariant: ["tabular-nums"] }}>
                    {currencyFormatter.format(session.pay)}
                  </ThemedText>
                </View>
              </NativeListItem>
            ))}
          </NativeList>
        )}
      </Animated.View>
    </ScrollView>
  );
}
