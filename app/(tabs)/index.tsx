import { api } from "@/convex/_generated/api";
import { toSportLabel } from "@/convex/constants";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { Brand, BrandRadius, BrandShadow } from "@/constants/brand";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useNativeTabLayout } from "@/hooks/use-native-tab-layout";
import { useQuery } from "convex/react";
import { Redirect, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { BrandSurface } from "@/components/ui/brand-surface";

const CONTENT_VERTICAL_PADDING = 20;

type StatTileProps = {
  label: string;
  value: string;
  hint: string;
  borderColor: string;
  valueColor: string;
  backgroundColor: string;
};

function StatTile({
  label,
  value,
  hint,
  borderColor,
  valueColor,
  backgroundColor,
}: StatTileProps) {
  return (
    <View style={[styles.statTile, { borderColor, backgroundColor }]}>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
      <ThemedText
        type="subtitle"
        selectable
        style={[styles.statValue, { color: valueColor }]}
      >
        {value}
      </ThemedText>
      <ThemedText style={styles.statHint}>{hint}</ThemedText>
    </View>
  );
}

type QuickActionCardProps = {
  title: string;
  subtitle: string;
  onPress: () => void;
  borderColor: string;
  backgroundColor: string;
};

function QuickActionCard({
  title,
  subtitle,
  onPress,
  borderColor,
  backgroundColor,
}: QuickActionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickActionCard,
        {
          borderColor,
          backgroundColor,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      <ThemedText type="defaultSemiBold">{title}</ThemedText>
      <ThemedText style={styles.quickActionSubtitle}>{subtitle}</ThemedText>
    </Pressable>
  );
}

type IntlWithOptionalRelativeTimeFormat = typeof Intl & {
  RelativeTimeFormat?: typeof Intl.RelativeTimeFormat;
};

type RelativeUnit = "minute" | "hour" | "day";

function getRelativeTimeFormatter(locale: string) {
  const relativeTimeFormatCtor = (Intl as IntlWithOptionalRelativeTimeFormat)
    .RelativeTimeFormat;
  if (typeof relativeTimeFormatCtor !== "function") return null;
  try {
    return new relativeTimeFormatCtor(locale, { numeric: "auto" });
  } catch {
    return null;
  }
}

function formatRelativeFallback(
  targetTime: number,
  deltaDays: number,
  locale: string,
) {
  if (Math.abs(deltaDays) < 1) {
    return new Date(targetTime).toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return new Date(targetTime).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

function getRelativeTimeLabel(targetTime: number, now: number, locale: string) {
  const formatter = getRelativeTimeFormatter(locale);
  const deltaMs = targetTime - now;
  const deltaMinutesRaw = deltaMs / (60 * 1000);
  const deltaMinutes =
    deltaMinutesRaw < 0
      ? Math.ceil(deltaMinutesRaw)
      : Math.floor(deltaMinutesRaw);

  const formatValue = (value: number, unit: RelativeUnit, deltaDays: number) =>
    formatter?.format(value, unit) ??
    formatRelativeFallback(targetTime, deltaDays, locale);

  if (Math.abs(deltaMinutes) < 60) {
    return formatValue(deltaMinutes, "minute", deltaMinutes / (60 * 24));
  }

  const deltaHoursRaw = deltaMinutes / 60;
  const deltaHours =
    deltaHoursRaw < 0 ? Math.ceil(deltaHoursRaw) : Math.floor(deltaHoursRaw);
  if (Math.abs(deltaHours) < 48) {
    return formatValue(deltaHours, "hour", deltaHours / 24);
  }

  const deltaDaysRaw = deltaHours / 24;
  const deltaDays =
    deltaDaysRaw < 0 ? Math.ceil(deltaDaysRaw) : Math.floor(deltaDaysRaw);
  return formatValue(deltaDays, "day", deltaDays);
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const colorScheme = useColorScheme() ?? "light";
  const palette = Brand[colorScheme];
  const locale = i18n.resolvedLanguage ?? "en";
  const tabLayout = useNativeTabLayout();
  const router = useRouter();

  const currentUser = useQuery(api.users.getCurrentUser);
  const myApplications = useQuery(
    api.jobs.getMyApplications,
    currentUser?.role === "instructor" ? { limit: 250 } : "skip",
  );
  const availableJobs = useQuery(
    api.jobs.getAvailableJobsForInstructor,
    currentUser?.role === "instructor" ? { limit: 80 } : "skip",
  );
  const myStudioJobs = useQuery(
    api.jobs.getMyStudioJobs,
    currentUser?.role === "studio" ? { limit: 150 } : "skip",
  );

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "ILS",
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale),
    [locale],
  );

  if (currentUser === undefined) {
    return <LoadingScreen label={t("home.loading")} />;
  }

  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }

  if (!currentUser.onboardingComplete || currentUser.role === "pending") {
    return <Redirect href="/onboarding" />;
  }

  const firstName = currentUser.fullName?.trim().split(/\s+/)[0];
  const displayName =
    firstName && firstName.length > 0
      ? firstName
      : t("home.shared.unknownName");
  const memberSince = new Date(currentUser.createdAt).toLocaleDateString(
    locale,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );

  if (currentUser.role === "instructor") {
    if (myApplications === undefined || availableJobs === undefined) {
      return <LoadingScreen label={t("home.loading")} />;
    }

    const now = Date.now();
    const acceptedApplications = myApplications.filter(
      (row) => row.status === "accepted",
    );
    const completedApplications = acceptedApplications.filter(
      (row) => row.jobStatus === "completed",
    );
    const pendingApplications = myApplications.filter(
      (row) => row.status === "pending",
    );
    const upcomingSessions = acceptedApplications
      .filter((row) => row.startTime > now)
      .sort((a, b) => a.startTime - b.startTime)
      .slice(0, 3);
    const openMatches = availableJobs.filter(
      (row) => !row.applicationStatus,
    ).length;

    const jobsTaken = acceptedApplications.length;
    const earnedAmount = completedApplications.reduce(
      (sum, row) => sum + row.pay,
      0,
    );
    const acceptanceRate =
      myApplications.length === 0
        ? 0
        : Math.round((jobsTaken / myApplications.length) * 100);
    const openMatchesSubtitleKey =
      openMatches >= 80
        ? "home.actions.jobsSubtitleOverflow"
        : "home.actions.jobsSubtitle";

    return (
      <ScrollView
        style={[styles.screen, { backgroundColor: palette.appBg }]}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(tabLayout.topInset, CONTENT_VERTICAL_PADDING),
            paddingBottom: tabLayout.bottomInset,
          },
        ]}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.headerBlock}>
          <ThemedText type="title">{t("home.instructor.title")}</ThemedText>
          <ThemedText style={{ color: palette.textMuted }}>
            {t("home.instructor.subtitle")}
          </ThemedText>
        </View>

        <BrandSurface
          style={[
            styles.heroCard,
            {
              backgroundColor: palette.primarySubtle,
              borderColor: palette.primary,
              boxShadow: BrandShadow.raised,
            },
          ]}
        >
          <View
            style={[
              styles.heroBubbleLarge,
              { backgroundColor: palette.primary },
            ]}
          />
          <View
            style={[
              styles.heroBubbleSmall,
              { backgroundColor: palette.focusRing },
            ]}
          />

          <ThemedText type="defaultSemiBold" style={styles.heroTitle}>
            {t("home.instructor.greeting", { name: displayName })}
          </ThemedText>
          <ThemedText style={[styles.heroBody, { color: palette.textMuted }]}>
            {t("home.shared.memberSince", { date: memberSince })}
          </ThemedText>
        </BrandSurface>

        <View style={styles.quickActionRow}>
          <QuickActionCard
            title={t("home.actions.jobsTitle")}
            subtitle={t(openMatchesSubtitleKey, {
              count: openMatches,
            })}
            onPress={() => {
              router.push("/(tabs)/jobs");
            }}
            borderColor={palette.border}
            backgroundColor={palette.surface}
          />
          <QuickActionCard
            title={t("home.actions.calendarTitle")}
            subtitle={t("home.actions.calendarSubtitle", {
              count: upcomingSessions.length,
            })}
            onPress={() => {
              router.push("/(tabs)/calendar");
            }}
            borderColor={palette.border}
            backgroundColor={palette.surface}
          />
        </View>

        <View style={styles.statGrid}>
          <StatTile
            label={t("home.instructor.stats.jobsTakenLabel")}
            value={numberFormatter.format(jobsTaken)}
            hint={t("home.instructor.stats.jobsTakenHint")}
            borderColor={palette.border}
            valueColor={palette.text}
            backgroundColor={palette.surface}
          />
          <StatTile
            label={t("home.instructor.stats.earnedLabel")}
            value={currencyFormatter.format(earnedAmount)}
            hint={t("home.instructor.stats.earnedHint")}
            borderColor={palette.border}
            valueColor={palette.success}
            backgroundColor={palette.surface}
          />
          <StatTile
            label={t("home.instructor.stats.pendingLabel")}
            value={numberFormatter.format(pendingApplications.length)}
            hint={t("home.instructor.stats.pendingHint")}
            borderColor={palette.border}
            valueColor={palette.primary}
            backgroundColor={palette.surface}
          />
          <StatTile
            label={t("home.instructor.stats.matchesLabel")}
            value={numberFormatter.format(openMatches)}
            hint={t("home.instructor.stats.acceptanceHint", {
              rate: numberFormatter.format(acceptanceRate),
            })}
            borderColor={palette.border}
            valueColor={palette.text}
            backgroundColor={palette.surface}
          />
        </View>

        <BrandSurface>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">
              {t("home.instructor.nextTitle")}
            </ThemedText>
            <ThemedText style={{ color: palette.textMuted }}>
              {t("home.instructor.nextSubtitle")}
            </ThemedText>
          </View>

          {upcomingSessions.length === 0 ? (
            <ThemedText style={{ color: palette.textMuted }}>
              {t("home.instructor.noUpcoming")}
            </ThemedText>
          ) : (
            upcomingSessions.map((session) => (
              <View
                key={session.applicationId}
                style={[styles.sessionRow, { borderColor: palette.border }]}
              >
                <View style={styles.sessionHeader}>
                  <ThemedText type="defaultSemiBold">
                    {toSportLabel(session.sport as never)}
                  </ThemedText>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        borderColor: palette.primary,
                        backgroundColor: palette.primarySubtle,
                      },
                    ]}
                  >
                    <ThemedText
                      type="defaultSemiBold"
                      style={[
                        styles.statusPillText,
                        { color: palette.primary },
                      ]}
                    >
                      {getRelativeTimeLabel(session.startTime, now, locale)}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.sessionHeader}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={{ color: palette.success }}
                    selectable
                  >
                    {currencyFormatter.format(session.pay)}
                  </ThemedText>
                  <ThemedText style={{ color: palette.textMuted }}>
                    {new Date(session.startTime).toLocaleString(locale)}
                  </ThemedText>
                </View>
                <ThemedText style={{ color: palette.textMuted }}>
                  {session.studioName} • {session.zone}
                </ThemedText>
              </View>
            ))
          )}
        </BrandSurface>
      </ScrollView>
    );
  }

  if (myStudioJobs === undefined) {
    return <LoadingScreen label={t("home.loading")} />;
  }

  const openJobs = myStudioJobs.filter((row) => row.status === "open").length;
  const pendingApplicants = myStudioJobs.reduce(
    (sum, row) => sum + row.pendingApplicationsCount,
    0,
  );
  const openBudget = myStudioJobs
    .filter((row) => row.status === "open")
    .reduce((sum, row) => sum + row.pay, 0);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.appBg }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(tabLayout.topInset, CONTENT_VERTICAL_PADDING),
          paddingBottom: tabLayout.bottomInset,
        },
      ]}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.headerBlock}>
        <ThemedText type="title">{t("home.studio.title")}</ThemedText>
        <ThemedText style={{ color: palette.textMuted }}>
          {t("home.studio.subtitle")}
        </ThemedText>
      </View>

      <BrandSurface
        style={[
          styles.heroCard,
          {
            backgroundColor: palette.surfaceAlt,
            borderColor: palette.borderStrong,
          },
        ]}
      >
        <ThemedText type="defaultSemiBold" style={styles.heroTitle}>
          {t("home.studio.greeting", { name: displayName })}
        </ThemedText>
        <ThemedText style={[styles.heroBody, { color: palette.textMuted }]}>
          {t("home.shared.memberSince", { date: memberSince })}
        </ThemedText>
      </BrandSurface>

      <View style={styles.quickActionRow}>
        <QuickActionCard
          title={t("home.actions.jobsTitle")}
          subtitle={t("home.actions.studioJobsSubtitle", {
            count: openJobs,
          })}
          onPress={() => {
            router.push("/(tabs)/jobs");
          }}
          borderColor={palette.border}
          backgroundColor={palette.surface}
        />
        <QuickActionCard
          title={t("home.actions.calendarTitle")}
          subtitle={t("home.actions.calendarSubtitle", {
            count: myStudioJobs.length,
          })}
          onPress={() => {
            router.push("/(tabs)/calendar");
          }}
          borderColor={palette.border}
          backgroundColor={palette.surface}
        />
      </View>

      <View style={styles.statGrid}>
        <StatTile
          label={t("home.studio.stats.postedLabel")}
          value={numberFormatter.format(myStudioJobs.length)}
          hint={t("home.studio.stats.postedHint")}
          borderColor={palette.border}
          valueColor={palette.text}
          backgroundColor={palette.surface}
        />
        <StatTile
          label={t("home.studio.stats.openLabel")}
          value={numberFormatter.format(openJobs)}
          hint={t("home.studio.stats.openHint")}
          borderColor={palette.border}
          valueColor={palette.primary}
          backgroundColor={palette.surface}
        />
        <StatTile
          label={t("home.studio.stats.pendingLabel")}
          value={numberFormatter.format(pendingApplicants)}
          hint={t("home.studio.stats.pendingHint")}
          borderColor={palette.border}
          valueColor={palette.text}
          backgroundColor={palette.surface}
        />
        <StatTile
          label={t("home.studio.stats.budgetLabel")}
          value={currencyFormatter.format(openBudget)}
          hint={t("home.studio.stats.budgetHint")}
          borderColor={palette.border}
          valueColor={palette.success}
          backgroundColor={palette.surface}
        />
      </View>

      <BrandSurface>
        <ThemedText type="subtitle">{t("home.studio.recentTitle")}</ThemedText>
        {myStudioJobs.length === 0 ? (
          <ThemedText style={{ color: palette.textMuted }}>
            {t("home.studio.noRecent")}
          </ThemedText>
        ) : (
          myStudioJobs.slice(0, 3).map((job) => (
            <View
              key={job.jobId}
              style={[styles.sessionRow, { borderColor: palette.border }]}
            >
              <View style={styles.sessionHeader}>
                <ThemedText type="defaultSemiBold">
                  {toSportLabel(job.sport as never)}
                </ThemedText>
                <View
                  style={[
                    styles.statusPill,
                    {
                      borderColor:
                        job.status === "open"
                          ? palette.primary
                          : job.status === "cancelled"
                            ? palette.danger
                            : job.status === "completed" ||
                                job.status === "filled"
                              ? palette.success
                              : palette.border,
                      backgroundColor:
                        job.status === "open"
                          ? palette.primarySubtle
                          : job.status === "cancelled"
                            ? `${palette.danger}20`
                            : job.status === "completed" ||
                                job.status === "filled"
                              ? `${palette.success}22`
                              : palette.surfaceAlt,
                    },
                  ]}
                >
                  <ThemedText
                    type="defaultSemiBold"
                    style={[
                      styles.statusPillText,
                      {
                        color:
                          job.status === "open"
                            ? palette.primary
                            : job.status === "cancelled"
                              ? palette.danger
                              : job.status === "completed" ||
                                  job.status === "filled"
                                ? palette.success
                                : palette.textMuted,
                      },
                    ]}
                  >
                    {t(`jobsTab.status.job.${job.status}`)}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.sessionHeader}>
                <ThemedText type="defaultSemiBold" selectable>
                  {currencyFormatter.format(job.pay)}
                </ThemedText>
                <ThemedText style={{ color: palette.textMuted }}>
                  {new Date(job.startTime).toLocaleString(locale)}
                </ThemedText>
              </View>
              <ThemedText style={{ color: palette.textMuted }}>
                {job.zone}
              </ThemedText>
            </View>
          ))
        )}
      </BrandSurface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  headerBlock: {
    gap: 4,
  },
  heroCard: {
    overflow: "hidden",
    position: "relative",
  },
  heroBubbleLarge: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    top: -70,
    right: -25,
    opacity: 0.2,
  },
  heroBubbleSmall: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    bottom: -25,
    right: 45,
    opacity: 0.18,
  },
  heroTitle: {
    fontSize: 20,
    lineHeight: 28,
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statTile: {
    flexGrow: 1,
    minWidth: 155,
    borderWidth: 1,
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    padding: 14,
    gap: 3,
    boxShadow: BrandShadow.soft,
  },
  statLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  statValue: {
    fontSize: 26,
    lineHeight: 30,
    fontVariant: ["tabular-nums"],
  },
  statHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  sectionHeader: {
    gap: 2,
  },
  quickActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickActionCard: {
    borderWidth: 1,
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    flex: 1,
    gap: 4,
    minHeight: 76,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  quickActionSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  sessionRow: {
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: "continuous",
    padding: 12,
    gap: 4,
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: BrandRadius.pill,
    borderCurve: "continuous",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 11,
    lineHeight: 14,
  },
});
