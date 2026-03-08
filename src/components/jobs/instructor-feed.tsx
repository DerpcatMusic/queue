import { useMutation, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { InstructorOpenJobsList } from "@/components/jobs/instructor/instructor-open-jobs-list";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import { EmptyState } from "@/components/ui/empty-state";
import { KitChip } from "@/components/ui/kit";
import { NativeSearchField } from "@/components/ui/native-search-field";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useBrand } from "@/hooks/use-brand";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";

const WIDE_WEB_BREAKPOINT = 1180;

function SectionHeader({
  title,
  subtitle,
  palette,
}: {
  title: string;
  subtitle: string;
  palette: ReturnType<typeof useBrand>;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text
        style={{
          ...BrandType.heading,
          fontSize: 24,
          lineHeight: 26,
          color: palette.text as string,
        }}
      >
        {title}
      </Text>
      <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>{subtitle}</Text>
    </View>
  );
}

export function InstructorFeed() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const { width } = useWindowDimensions();
  const locale = i18n.resolvedLanguage ?? "en";
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const isWideWeb = Platform.OS === "web" && width >= WIDE_WEB_BREAKPOINT;

  const [jobsSearchQuery, setJobsSearchQuery] = useState("");
  const [jobsWindowFilter, setJobsWindowFilter] = useState<"all" | "24h" | "72h">("all");
  const [applyingJobId, setApplyingJobId] = useState<Id<"jobs"> | null>(null);
  const [applyErrorMessage, setApplyErrorMessage] = useState<string | null>(null);

  const currentUser = useQuery(api.users.getCurrentUser);
  const applyToJob = useMutation(api.jobs.applyToJob);
  const studioHomeRoute = buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.home);

  const now = Date.now();
  const queryMinuteBucket = Math.floor(now / (60 * 1000));
  const queryNow = queryMinuteBucket * 60 * 1000;

  const availableJobs = useQuery(
    api.jobs.getAvailableJobsForInstructor,
    currentUser?.role === "instructor" ? { limit: 60, now: queryNow } : "skip",
  );

  if (
    currentUser === undefined ||
    (currentUser?.role === "instructor" && availableJobs === undefined)
  ) {
    return <LoadingScreen label={t("jobsTab.loading")} />;
  }

  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }

  if (!currentUser.onboardingComplete || currentUser.role === "pending") {
    return <Redirect href="/onboarding" />;
  }

  if (currentUser.role === "studio") {
    return <Redirect href={studioHomeRoute} />;
  }

  if (currentUser.role !== "instructor") {
    return <Redirect href="/onboarding" />;
  }

  const jobs = availableJobs ?? [];
  const hotNowCount = jobs.filter((job) => job.startTime <= now + 24 * 60 * 60 * 1000).length;
  const pendingCount = jobs.filter((job) => job.applicationStatus === "pending").length;
  const acceptedCount = jobs.filter((job) => job.applicationStatus === "accepted").length;

  const filteredAvailableJobs = jobs.filter((job) => {
    if (jobsWindowFilter === "24h" && job.startTime > now + 24 * 60 * 60 * 1000) return false;
    if (jobsWindowFilter === "72h" && job.startTime > now + 72 * 60 * 60 * 1000) return false;

    const search = jobsSearchQuery.trim().toLowerCase();
    if (!search) return true;
    const zoneLabel = getZoneLabel(job.zone, zoneLanguage).toLowerCase();
    const sportLabel = toSportLabel(job.sport as never).toLowerCase();
    const haystack =
      `${job.studioName} ${job.note ?? ""} ${job.zone} ${zoneLabel} ${sportLabel}`.toLowerCase();
    return haystack.includes(search);
  });

  const onApply = async (jobId: Id<"jobs">) => {
    setApplyErrorMessage(null);
    setApplyingJobId(jobId);
    try {
      await applyToJob({ jobId });
    } catch (error) {
      console.error("[jobs] apply failed", error);
      setApplyErrorMessage(
        t("jobsTab.actions.applyError", {
          defaultValue: "Couldn't apply right now. Please try again.",
        }),
      );
    } finally {
      setApplyingJobId(null);
    }
  };

  const filterOptions = [
    { key: "all", label: "Any time" },
    { key: "24h", label: "Now" },
    { key: "72h", label: "This week" },
  ] as const;

  if (isWideWeb) {
    return (
      <View style={[styles.screen, { backgroundColor: palette.appBg }]}>
        <TabScreenScrollView
          routeKey="instructor/jobs/index"
          style={styles.screen}
          contentContainerStyle={{
            paddingHorizontal: BrandSpacing.xl,
            paddingTop: BrandSpacing.xl,
            paddingBottom: BrandSpacing.xxl,
            gap: BrandSpacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flexDirection: "row", gap: BrandSpacing.xl, alignItems: "stretch" }}>
            <View
              style={{
                flex: 1.2,
                borderRadius: 34,
                borderCurve: "continuous",
                backgroundColor: palette.primary as string,
                paddingHorizontal: 22,
                paddingVertical: 22,
                gap: 12,
              }}
            >
              <Text
                style={{
                  ...BrandType.micro,
                  color: palette.onPrimary as string,
                  opacity: 0.8,
                  letterSpacing: 1.1,
                  textTransform: "uppercase",
                }}
              >
                Instructor queue
              </Text>
              <Text
                style={{
                  fontFamily: "BarlowCondensed_800ExtraBold",
                  fontSize: 42,
                  lineHeight: 40,
                  letterSpacing: -1,
                  color: palette.onPrimary as string,
                }}
              >
                Move on the best openings before the board gets noisy
              </Text>
              <Text
                style={{
                  ...BrandType.body,
                  color: palette.onPrimary as string,
                  opacity: 0.9,
                  maxWidth: 620,
                }}
              >
                Web uses a real scanning layout now: filter in one rail, compare openings in one
                line, and keep submitted jobs visible without turning them into fake buttons.
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  `${String(filteredAvailableJobs.length)} matches`,
                  hotNowCount > 0 ? `${String(hotNowCount)} hot now` : "Fresh board",
                ].map((label) => (
                  <View
                    key={label}
                    style={{
                      borderRadius: 999,
                      backgroundColor: "rgba(255,255,255,0.16)",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}
                  >
                    <Text
                      style={{
                        ...BrandType.micro,
                        color: palette.onPrimary as string,
                        letterSpacing: 0.7,
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View
              style={{
                width: 340,
                borderRadius: 34,
                borderCurve: "continuous",
                backgroundColor: palette.surfaceAlt as string,
                paddingHorizontal: 18,
                paddingVertical: 18,
                gap: 14,
              }}
            >
              {[
                { label: "Hot now", value: hotNowCount, accent: palette.primary as string },
                { label: "Pending", value: pendingCount, accent: palette.warning as string },
                { label: "Accepted", value: acceptedCount, accent: palette.success as string },
              ].map((metric) => (
                <View
                  key={metric.label}
                  style={{
                    borderRadius: 24,
                    borderCurve: "continuous",
                    backgroundColor: palette.surface as string,
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    gap: 2,
                  }}
                >
                  <Text
                    style={{
                      ...BrandType.micro,
                      color: palette.textMuted as string,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                    }}
                  >
                    {metric.label}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "BarlowCondensed_800ExtraBold",
                      fontSize: 30,
                      lineHeight: 28,
                      color: metric.accent,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {String(metric.value)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {applyErrorMessage ? (
            <NoticeBanner
              tone="error"
              message={applyErrorMessage}
              onDismiss={() => setApplyErrorMessage(null)}
              borderColor="transparent"
              backgroundColor={palette.dangerSubtle}
              textColor={palette.danger}
              iconColor={palette.danger}
            />
          ) : null}

          <View style={{ flexDirection: "row", gap: BrandSpacing.xl, alignItems: "flex-start" }}>
            <View
              style={{
                flex: 1.4,
                borderRadius: 32,
                borderCurve: "continuous",
                backgroundColor: palette.surface as string,
                paddingVertical: 18,
                gap: 12,
              }}
            >
              <View style={{ paddingHorizontal: 18 }}>
                <SectionHeader
                  title="Openings"
                  subtitle={
                    filteredAvailableJobs.length === 1
                      ? "1 opening after your current filters."
                      : `${String(filteredAvailableJobs.length)} openings after your current filters.`
                  }
                  palette={palette}
                />
              </View>

              {jobs.length === 0 ? (
                <View style={{ minHeight: 360, justifyContent: "center" }}>
                  <EmptyState icon="briefcase" title={t("jobsTab.emptyInstructor")} body="" />
                </View>
              ) : filteredAvailableJobs.length === 0 ? (
                <View style={{ minHeight: 320, justifyContent: "center" }}>
                  <EmptyState
                    icon="magnifyingglass"
                    title={t("jobsTab.noJobsFound")}
                    body={t("jobsTab.tryDifferentSearchOrTimeFilter")}
                  />
                </View>
              ) : (
                <InstructorOpenJobsList
                  jobs={filteredAvailableJobs}
                  locale={locale}
                  zoneLanguage={zoneLanguage}
                  palette={palette}
                  applyingJobId={applyingJobId}
                  onApply={(jobId) => {
                    void onApply(jobId);
                  }}
                  t={t}
                />
              )}
            </View>

            <View style={{ width: 320, gap: 16 }}>
              <View
                style={{
                  borderRadius: 30,
                  borderCurve: "continuous",
                  backgroundColor: palette.surface as string,
                  paddingHorizontal: 18,
                  paddingVertical: 18,
                  gap: 12,
                }}
              >
                <SectionHeader
                  title="Filter desk"
                  subtitle="Trim the queue without collapsing the board."
                  palette={palette}
                />
                <NativeSearchField
                  value={jobsSearchQuery}
                  onChangeText={setJobsSearchQuery}
                  placeholder={t("jobsTab.searchPlaceholder")}
                  clearAccessibilityLabel={t("common.clear", { defaultValue: "Clear search" })}
                />
                <View style={styles.segmentRow}>
                  {filterOptions.map((option) => (
                    <KitChip
                      key={option.key}
                      label={option.label}
                      selected={jobsWindowFilter === option.key}
                      onPress={() => setJobsWindowFilter(option.key)}
                    />
                  ))}
                </View>
              </View>

              <View
                style={{
                  borderRadius: 30,
                  borderCurve: "continuous",
                  backgroundColor: palette.surfaceAlt as string,
                  paddingHorizontal: 18,
                  paddingVertical: 18,
                  gap: 8,
                }}
              >
                <Text style={{ ...BrandType.heading, fontSize: 24, color: palette.text as string }}>
                  Pipeline
                </Text>
                <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                  Pending and accepted jobs remain visible as passive status states. Only the real
                  apply action reads like a button.
                </Text>
              </View>
            </View>
          </View>
        </TabScreenScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.appBg }]}>
      <TabScreenScrollView
        routeKey="instructor/jobs/index"
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: BrandSpacing.lg, gap: BrandSpacing.sm }}>
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                borderRadius: BrandRadius.card,
                borderCurve: "continuous",
                backgroundColor: palette.surfaceAlt as string,
                padding: 14,
              }}
            >
              {[
                { label: "Hot now", value: String(hotNowCount), accent: palette.primary as string },
                { label: "Pending", value: String(pendingCount) },
                {
                  label: "Accepted",
                  value: String(acceptedCount),
                  accent: palette.success as string,
                },
              ].map((item, index) => (
                <View key={item.label} style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      ...BrandType.micro,
                      color: palette.textMuted as string,
                      letterSpacing: 0.8,
                      textTransform: "uppercase",
                    }}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={{
                      ...BrandType.title,
                      color: item.accent ?? (palette.text as string),
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {item.value}
                  </Text>
                  {index < 2 ? (
                    <View
                      style={{
                        position: "absolute",
                        right: -5,
                        top: 4,
                        bottom: 4,
                        width: 1,
                        backgroundColor: palette.appBg as string,
                      }}
                    />
                  ) : null}
                </View>
              ))}
            </View>
            <View
              style={{
                gap: BrandSpacing.sm,
                borderRadius: BrandRadius.card,
                borderCurve: "continuous",
                backgroundColor: palette.surface as string,
                padding: 14,
              }}
            >
              {applyErrorMessage ? (
                <NoticeBanner
                  tone="error"
                  message={applyErrorMessage}
                  onDismiss={() => setApplyErrorMessage(null)}
                  borderColor="transparent"
                  backgroundColor={palette.dangerSubtle}
                  textColor={palette.danger}
                  iconColor={palette.danger}
                />
              ) : null}
              <NativeSearchField
                value={jobsSearchQuery}
                onChangeText={setJobsSearchQuery}
                placeholder={t("jobsTab.searchPlaceholder")}
                clearAccessibilityLabel={t("common.clear", { defaultValue: "Clear search" })}
              />
              <View style={styles.segmentRow}>
                {filterOptions.map((option) => (
                  <KitChip
                    key={option.key}
                    label={option.label}
                    selected={jobsWindowFilter === option.key}
                    onPress={() => setJobsWindowFilter(option.key)}
                  />
                ))}
              </View>
            </View>
          </View>

          {jobs.length === 0 ? (
            <View style={{ minHeight: 260, justifyContent: "center" }}>
              <EmptyState icon="briefcase" title={t("jobsTab.emptyInstructor")} body="" />
            </View>
          ) : filteredAvailableJobs.length === 0 ? (
            <View
              style={{
                minHeight: 220,
                justifyContent: "center",
                paddingHorizontal: BrandSpacing.lg,
              }}
            >
              <EmptyState
                icon="magnifyingglass"
                title={t("jobsTab.noJobsFound")}
                body={t("jobsTab.tryDifferentSearchOrTimeFilter")}
              />
            </View>
          ) : (
            <InstructorOpenJobsList
              jobs={filteredAvailableJobs}
              locale={locale}
              zoneLanguage={zoneLanguage}
              palette={palette}
              applyingJobId={applyingJobId}
              onApply={(jobId) => {
                void onApply(jobId);
              }}
              t={t}
            />
          )}
        </View>
      </TabScreenScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: BrandSpacing.lg,
    paddingBottom: BrandSpacing.xl,
    gap: BrandSpacing.md,
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
