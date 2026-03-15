import { useMutation, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { InstructorOpenJobsList } from "@/components/jobs/instructor/instructor-open-jobs-list";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { TopSheet } from "@/components/layout/top-sheet";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { EmptyState } from "@/components/ui/empty-state";
import { KitChip } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useBrand } from "@/hooks/use-brand";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";

export function InstructorFeed() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const locale = i18n.resolvedLanguage ?? "en";
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";

  const [jobsSearchQuery, setJobsSearchQuery] = useState("");
  const [jobsWindowFilter, setJobsWindowFilter] = useState<"all" | "24h" | "72h">("all");
  const [applyingJobId, setApplyingJobId] = useState<Id<"jobs"> | null>(null);
  const [applyErrorMessage, setApplyErrorMessage] = useState<string | null>(null);
  const deferredJobsSearchQuery = useDeferredValue(jobsSearchQuery);

  const { currentUser } = useUser();
  const applyToJob = useMutation(api.jobs.applyToJob);
  const studioHomeRoute = buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.home);

  const now = Date.now();
  const queryMinuteBucket = Math.floor(Date.now() / (60 * 1000));
  const queryNow = queryMinuteBucket * 60 * 1000;

  const availableJobs = useQuery(
    api.jobs.getAvailableJobsForInstructor,
    currentUser?.role === "instructor" ? { limit: 60, now: queryNow } : "skip",
  );

  type AvailableJob = NonNullable<typeof availableJobs>[number];

  const jobs = (availableJobs ?? []) as AvailableJob[];
  const hotNowCount = jobs.filter((job) => job.startTime <= now + 24 * 60 * 60 * 1000).length;

  const filteredAvailableJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (jobsWindowFilter === "24h" && job.startTime > now + 24 * 60 * 60 * 1000) return false;
      if (jobsWindowFilter === "72h" && job.startTime > now + 72 * 60 * 60 * 1000) return false;

      const search = deferredJobsSearchQuery.trim().toLowerCase();
      if (!search) return true;
      const zoneLabel = getZoneLabel(job.zone, zoneLanguage).toLowerCase();
      const sportLabel = toSportLabel(job.sport as never).toLowerCase();
      const haystack =
        `${job.studioName} ${job.note ?? ""} ${job.zone} ${zoneLabel} ${sportLabel}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [deferredJobsSearchQuery, jobs, jobsWindowFilter, now, zoneLanguage]);

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
      {/* Top Sheet with Search Bar and Stats - purple inset, surface content */}
      <TopSheet
        backgroundColor={palette.surface as string}
        topInsetColor={palette.primary}
        padding={{ vertical: BrandSpacing.sm, horizontal: BrandSpacing.lg }}
      >
        <View style={{ gap: BrandSpacing.sm }}>
          <TopSheet.SearchBar
            value={jobsSearchQuery}
            onChangeText={setJobsSearchQuery}
            placeholder={t("jobsTab.searchPlaceholder")}
            palette={palette}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View>
              <ThemedText type="sectionTitle" style={{ color: palette.text as string }}>
                {filteredAvailableJobs.length} {filteredAvailableJobs.length === 1 ? "job" : "jobs"}{" "}
                available
              </ThemedText>
              <ThemedText type="meta" style={{ color: palette.textMuted as string }}>
                {hotNowCount > 0
                  ? `${hotNowCount} starting soon`
                  : "Check back later for new shifts"}
              </ThemedText>
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
        </View>
      </TopSheet>

      <TabScreenScrollView
        routeKey="instructor/jobs/index"
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: BrandSpacing.xl,
            paddingHorizontal: BrandSpacing.lg,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flex: 1, gap: BrandSpacing.lg }}>
          {/* Filter Chips */}
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
    gap: BrandSpacing.lg,
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
