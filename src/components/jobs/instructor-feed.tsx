import { useMutation, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { InstructorOpenJobsList } from "@/components/jobs/instructor/instructor-open-jobs-list";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { EmptyState } from "@/components/ui/empty-state";
import { KitChip } from "@/components/ui/kit";
import { NativeSearchField } from "@/components/ui/native-search-field";
import { BrandSpacing } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
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

  return (
    <View style={[styles.screen, { backgroundColor: palette.appBg }]}>
      <TabScreenScrollView
        routeKey="instructor/jobs/index"
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flex: 1 }}>
          {applyErrorMessage ? (
            <View style={{ paddingHorizontal: BrandSpacing.lg, paddingBottom: BrandSpacing.sm }}>
              <NoticeBanner
                tone="error"
                message={applyErrorMessage}
                onDismiss={() => setApplyErrorMessage(null)}
                borderColor={palette.borderStrong}
                backgroundColor={palette.surface}
                textColor={palette.danger}
                iconColor={palette.danger}
              />
            </View>
          ) : null}
          <View
            style={{ paddingHorizontal: BrandSpacing.lg, gap: 2, paddingBottom: BrandSpacing.xs }}
          >
            <ThemedText type="title">{t("jobsTab.availableTitle")}</ThemedText>
          </View>
          <View
            style={{
              paddingHorizontal: BrandSpacing.lg,
              gap: BrandSpacing.sm,
              paddingBottom: BrandSpacing.sm,
            }}
          >
            <NativeSearchField
              value={jobsSearchQuery}
              onChangeText={setJobsSearchQuery}
              placeholder={t("jobsTab.searchPlaceholder")}
              clearAccessibilityLabel={t("common.clear", { defaultValue: "Clear search" })}
            />
            <View style={styles.segmentRow}>
              {(
                [
                  { key: "all", label: t("jobsTab.filters.anyTime") },
                  { key: "24h", label: t("jobsTab.filters.next24h") },
                  { key: "72h", label: t("jobsTab.filters.next72h") },
                ] as const
              ).map((option) => (
                <KitChip
                  key={option.key}
                  label={option.label}
                  selected={jobsWindowFilter === option.key}
                  onPress={() => setJobsWindowFilter(option.key)}
                />
              ))}
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
