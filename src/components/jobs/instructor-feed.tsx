import { useMutation, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, View } from "react-native";
import { InstructorOpenJobsList } from "@/components/jobs/instructor/instructor-open-jobs-list";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { EmptyState } from "@/components/ui/empty-state";
import { KitChip, KitSurface } from "@/components/ui/kit";
import { NativeSearchField } from "@/components/ui/native-search-field";
import { BrandSpacing } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";
import {
  buildRoleTabRoute,
  ROLE_TAB_ROUTE_NAMES,
} from "@/navigation/role-routes";

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
      <ThemedText type="sectionTitle" style={{ color: palette.text as string }}>
        {title}
      </ThemedText>
      <ThemedText type="meta" style={{ color: palette.textMuted as string }}>
        {subtitle}
      </ThemedText>
    </View>
  );
}

export function InstructorFeed() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const { safeTop } = useAppInsets();
  const locale = i18n.resolvedLanguage ?? "en";
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const mobileContentPaddingTop =
    Platform.OS === "android" ? safeTop + BrandSpacing.sm : 0;

  const [jobsSearchQuery, setJobsSearchQuery] = useState("");
  const [jobsWindowFilter, setJobsWindowFilter] = useState<
    "all" | "24h" | "72h"
  >("all");
  const [applyingJobId, setApplyingJobId] = useState<Id<"jobs"> | null>(null);
  const [applyErrorMessage, setApplyErrorMessage] = useState<string | null>(
    null,
  );

  const currentUser = useQuery(api.users.getCurrentUser);
  const applyToJob = useMutation(api.jobs.applyToJob);
  const studioHomeRoute = buildRoleTabRoute(
    "studio",
    ROLE_TAB_ROUTE_NAMES.home,
  );

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

  type AvailableJob = NonNullable<typeof availableJobs>[number];

  const jobs = (availableJobs ?? []) as AvailableJob[];
  const hotNowCount = jobs.filter(
    (job) => job.startTime <= now + 24 * 60 * 60 * 1000,
  ).length;
  const pendingCount = jobs.filter(
    (job) => job.applicationStatus === "pending",
  ).length;
  const acceptedCount = jobs.filter(
    (job) => job.applicationStatus === "accepted",
  ).length;

  const filteredAvailableJobs = jobs.filter((job) => {
    if (jobsWindowFilter === "24h" && job.startTime > now + 24 * 60 * 60 * 1000)
      return false;
    if (jobsWindowFilter === "72h" && job.startTime > now + 72 * 60 * 60 * 1000)
      return false;

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
      setApplyErrorMessage(t("jobsTab.errors.applyError"));
    } finally {
      setApplyingJobId(null);
    }
  };

  const filterOptions = [
    { key: "all", label: t("jobsTab.instructorFeed.filterAnyTime") },
    { key: "24h", label: t("jobsTab.instructorFeed.filterNow") },
    { key: "72h", label: t("jobsTab.instructorFeed.filterThisWeek") },
  ] as const;

  return (
    <View style={[styles.screen, { backgroundColor: palette.appBg }]}>
      <TabScreenScrollView
        routeKey="instructor/jobs/index"
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: mobileContentPaddingTop,
            paddingHorizontal: BrandSpacing.lg,
          },
        ]}
        topInsetTone="sheet"
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flex: 1, gap: BrandSpacing.lg }}>
          <View style={{ gap: BrandSpacing.sm }}>
            <SectionHeader
              title={t("jobsTab.instructorFeed.title")}
              subtitle={t("jobsTab.instructorFeed.openingsFiltered", {
                count: filteredAvailableJobs.length,
              })}
              palette={palette}
            />
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
          </View>

          <KitSurface
            tone="sheet"
            padding={BrandSpacing.lg}
            gap={BrandSpacing.md}
          >
            <ThemedText
              type="meta"
              style={{ color: palette.textMuted as string }}
            >
              {[
                t("jobsTab.instructorFeed.matchesCount", {
                  count: filteredAvailableJobs.length,
                }),
                hotNowCount > 0
                  ? t("jobsTab.instructorFeed.hotNow", { count: hotNowCount })
                  : t("jobsTab.instructorFeed.freshBoard"),
                pendingCount > 0
                  ? t("jobsTab.instructorFeed.metricPending", {
                      defaultValue: "Pending",
                    }) + `: ${String(pendingCount)}`
                  : t("jobsTab.instructorFeed.metricAccepted", {
                      defaultValue: "Accepted",
                    }) + `: ${String(acceptedCount)}`,
              ].join("  •  ")}
            </ThemedText>
            <NativeSearchField
              value={jobsSearchQuery}
              onChangeText={setJobsSearchQuery}
              placeholder={t("jobsTab.searchPlaceholder")}
              clearAccessibilityLabel={t("common.clear", {
                defaultValue: "Clear search",
              })}
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
          </KitSurface>

          {jobs.length === 0 ? (
            <View style={{ minHeight: 260, justifyContent: "center" }}>
              <EmptyState
                icon="briefcase"
                title={t("jobsTab.emptyInstructor")}
                body=""
              />
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
    gap: BrandSpacing.lg,
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
