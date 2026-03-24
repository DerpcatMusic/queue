import type BottomSheet from "@gorhom/bottom-sheet";
import { useMutation, useQuery } from "convex/react";
import type { Href } from "expo-router";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, StyleSheet, View } from "react-native";
import Animated, { LinearTransition, ReduceMotion } from "react-native-reanimated";
import {
  type InstructorArchiveRow,
  InstructorJobsArchiveSheet,
} from "@/components/jobs/instructor/instructor-jobs-archive-sheet";
import { InstructorOpenJobsList } from "@/components/jobs/instructor/instructor-open-jobs-list";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { TabOverlayAnchor } from "@/components/layout/tab-overlay-anchor";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { useTopSheetContentInsets } from "@/components/layout/use-top-sheet-content-insets";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitDisclosureButtonGroup, type KitDisclosureButtonGroupOption } from "@/components/ui/kit";
import { NativeSearchField } from "@/components/ui/native-search-field";
import { BrandSpacing } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useBrand } from "@/hooks/use-brand";
import { useMinuteNow } from "@/hooks/use-minute-now";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";

export function InstructorFeed() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const router = useRouter();
  const locale = i18n.resolvedLanguage ?? "en";
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const liveNow = useMinuteNow();

  const [jobsSearchQuery, setJobsSearchQuery] = useState("");
  const [jobsWindowFilter, setJobsWindowFilter] = useState<"all" | "24h" | "72h">("all");
  const [showJobsFilters, setShowJobsFilters] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [emptyVariantIndex, setEmptyVariantIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [applyingJobId, setApplyingJobId] = useState<Id<"jobs"> | null>(null);
  const [applyErrorMessage, setApplyErrorMessage] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const archiveSheetRef = useRef<BottomSheet>(null);
  const deferredJobsSearchQuery = useDeferredValue(jobsSearchQuery);
  const { contentContainerStyle: sheetContentInsets, progressViewOffset } =
    useTopSheetContentInsets({
      topSpacing: BrandSpacing.xl,
      bottomSpacing: BrandSpacing.xl,
      horizontalPadding: BrandSpacing.lg,
    });

  const { currentUser } = useUser();
  const applyToJob = useMutation(api.jobs.applyToJob);
  const studioHomeRoute = buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.home);

  // Stable time ref: only recomputes when queryMinuteBucket changes (once/minute)
  // This avoids Filter re-computation on every render while keeping the 24h/72h window current
  const queryNow = Math.floor(liveNow / (60 * 1000)) * 60 * 1000;

  const availableJobs = useQuery(
    api.jobs.getAvailableJobsForInstructor,
    currentUser?.role === "instructor" ? { limit: 60, now: queryNow } : "skip",
  );
  const myApplications = useQuery(
    api.jobs.getMyApplications,
    currentUser?.role === "instructor" ? { limit: 120 } : "skip",
  );

  type AvailableJob = NonNullable<typeof availableJobs>[number];

  const jobs = (availableJobs ?? []) as AvailableJob[];
  const emptyVariants = [
    t("jobsTab.instructorFeed.emptyInstructorFreshOne"),
    t("jobsTab.instructorFeed.emptyInstructorFreshTwo"),
    t("jobsTab.instructorFeed.emptyInstructorFreshThree"),
  ];
  const emptyJobsCopy =
    emptyVariants[emptyVariantIndex % emptyVariants.length] ?? emptyVariants[0]!;
  const listViewportMinHeight = 240;

  const filteredAvailableJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (jobsWindowFilter === "24h" && job.startTime > queryNow + 24 * 60 * 60 * 1000)
        return false;
      if (jobsWindowFilter === "72h" && job.startTime > queryNow + 72 * 60 * 60 * 1000)
        return false;

      const search = deferredJobsSearchQuery.trim().toLowerCase();
      if (!search) return true;
      const zoneLabel = getZoneLabel(job.zone, zoneLanguage).toLowerCase();
      const sportLabel = toSportLabel(job.sport as never).toLowerCase();
      const haystack =
        `${job.studioName} ${job.studioAddress ?? ""} ${job.zone} ${zoneLabel} ${sportLabel}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [deferredJobsSearchQuery, jobs, jobsWindowFilter, queryNow, zoneLanguage]);
  const archiveRows = useMemo<InstructorArchiveRow[]>(
    () =>
      (myApplications ?? [])
        .filter((application) => {
          if (application.jobStatus === "completed" || application.jobStatus === "cancelled") {
            return true;
          }
          if (application.status === "rejected" || application.status === "withdrawn") {
            return true;
          }
          return application.endTime <= queryNow;
        })
        .map((application) => ({
          applicationId: application.applicationId,
          jobId: application.jobId,
          studioId: application.studioId,
          studioName: application.studioName,
          sport: application.sport,
          zone: application.zone,
          startTime: application.startTime,
          endTime: application.endTime,
          pay: application.pay,
          appliedAt: application.appliedAt,
          jobStatus: application.jobStatus,
          applicationStatus: application.status,
          ...(application.studioImageUrl ? { studioImageUrl: application.studioImageUrl } : {}),
          ...(application.closureReason ? { closureReason: application.closureReason } : {}),
        }))
        .sort((left, right) => right.startTime - left.startTime),
    [myApplications, queryNow],
  );

  const handleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    setShowJobsFilters(false);
    setEmptyVariantIndex((current) => (current + 1) % emptyVariants.length);
    setRefreshing(true);
    refreshTimerRef.current = setTimeout(() => {
      setRefreshing(false);
      refreshTimerRef.current = null;
    }, 320);
  }, [emptyVariants.length]);

  useEffect(
    () => () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    },
    [],
  );

  const jobsFilterOptions = useMemo(
    () =>
      [
        { value: "all", label: t("jobsTab.instructorFeed.filterAnyTime") },
        { value: "24h", label: t("jobsTab.instructorFeed.filterNow") },
        { value: "72h", label: t("jobsTab.instructorFeed.filterThisWeek") },
      ] as const satisfies readonly KitDisclosureButtonGroupOption<"all" | "24h" | "72h">[],
    [t],
  );
  const jobsHeaderLayoutTransition = useMemo(
    () => LinearTransition.duration(220).reduceMotion(ReduceMotion.System),
    [],
  );

  const jobsSheetConfig = useMemo(
    () => ({
      stickyHeader: (
        <View style={{ gap: BrandSpacing.xs }}>
          <Animated.View
            layout={jobsHeaderLayoutTransition}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: BrandSpacing.sm,
            }}
          >
            <Animated.View
              layout={jobsHeaderLayoutTransition}
              style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }}
            >
              <NativeSearchField
                value={jobsSearchQuery}
                onChangeText={setJobsSearchQuery}
                placeholder={t("jobsTab.searchPlaceholder")}
                clearAccessibilityLabel={t("common.clear")}
                size="sm"
                animateLayout
                containerStyle={{ backgroundColor: String(palette.surface) }}
              />
            </Animated.View>
            <Animated.View
              layout={jobsHeaderLayoutTransition}
              style={{ flexShrink: 0, minWidth: 0 }}
            >
              <KitDisclosureButtonGroup
                accessibilityLabel={t("jobsTab.instructorFeed.openFilters")}
                expanded={showJobsFilters}
                onToggleExpanded={() => setShowJobsFilters((current) => !current)}
                options={jobsFilterOptions}
                value={jobsWindowFilter}
                onChange={(value) => {
                  setJobsWindowFilter(value);
                }}
                triggerIcon={
                  <IconSymbol
                    name="line.3.horizontal.decrease.circle"
                    size={18}
                    color={String(palette.text)}
                  />
                }
                size="sm"
                railColor={String(palette.surface)}
                selectedColor={String(palette.primarySubtle)}
                labelColor={String(palette.text)}
                selectedLabelColor={String(palette.primaryPressed)}
                dividerColor={String(palette.border)}
              />
            </Animated.View>
          </Animated.View>
          {applyErrorMessage ? (
            <NoticeBanner
              tone="error"
              message={applyErrorMessage}
              onDismiss={() => setApplyErrorMessage(null)}
            />
          ) : null}
        </View>
      ),
      padding: {
        vertical: BrandSpacing.sm,
        horizontal: BrandSpacing.xl,
      },
      draggable: false,
      expandable: false,
      steps: [0.16],
      initialStep: 0,
      backgroundColor: palette.primary as string,
      topInsetColor: palette.primary as string,
    }),
    [
      applyErrorMessage,
      jobsFilterOptions,
      jobsWindowFilter,
      jobsHeaderLayoutTransition,
      jobsSearchQuery,
      palette,
      showJobsFilters,
      t,
    ],
  );

  const onApply = useCallback(
    async (jobId: Id<"jobs">) => {
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
    },
    [applyToJob, t],
  );

  const onOpenStudio = useCallback(
    (studioId: Id<"studioProfiles">, jobId: Id<"jobs">) => {
      router.push(
        `/instructor/jobs/studios/${encodeURIComponent(String(studioId))}?jobId=${encodeURIComponent(String(jobId))}` as Href,
      );
    },
    [router],
  );

  useGlobalTopSheet("jobs", jobsSheetConfig, "jobs:instructor-feed");

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

  return (
    <View style={styles.screen}>
      <TabScreenScrollView
        routeKey="instructor/jobs/index"
        style={styles.screen}
        contentContainerStyle={[styles.content, sheetContentInsets]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={palette.primary as string}
            colors={[palette.primary as string]}
            progressViewOffset={progressViewOffset}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flex: 1, gap: BrandSpacing.lg }}>
          {jobs.length === 0 ? (
            <View
              style={{
                minHeight: listViewportMinHeight,
                justifyContent: "center",
                alignItems: "center",
                paddingHorizontal: BrandSpacing.lg,
              }}
            >
              <View style={{ alignItems: "center", gap: BrandSpacing.md }}>
                <IconSymbol name="briefcase.fill" size={30} color={palette.textMuted as string} />
                <View style={{ alignItems: "center", gap: BrandSpacing.xs }}>
                  <ThemedText type="meta" style={{ color: palette.textMuted as string }}>
                    {t("jobsTab.instructorFeed.emptyInstructorShort")}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{
                      color: palette.textMuted as string,
                      textAlign: "center",
                    }}
                  >
                    {emptyJobsCopy}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{
                      color: palette.textMuted as string,
                      textAlign: "center",
                    }}
                  >
                    {t("jobsTab.instructorFeed.emptyRefreshHint")}
                  </ThemedText>
                </View>
              </View>
            </View>
          ) : filteredAvailableJobs.length === 0 ? (
            <View
              style={{
                minHeight: Math.max(220, listViewportMinHeight * 0.75),
                justifyContent: "center",
                alignItems: "center",
                paddingHorizontal: BrandSpacing.lg,
              }}
            >
              <View style={{ alignItems: "center", gap: BrandSpacing.sm }}>
                <IconSymbol name="magnifyingglass" size={24} color={palette.textMuted as string} />
                <ThemedText type="meta" style={{ color: palette.textMuted as string }}>
                  {t("jobsTab.noJobsFound")}
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: palette.textMuted as string, textAlign: "center" }}
                >
                  {t("jobsTab.tryDifferentSearchOrTimeFilter")}
                </ThemedText>
              </View>
            </View>
          ) : (
            <InstructorOpenJobsList
              jobs={filteredAvailableJobs}
              locale={locale}
              zoneLanguage={zoneLanguage}
              palette={palette}
              applyingJobId={applyingJobId}
              now={liveNow}
              onApply={onApply}
              onOpenStudio={onOpenStudio}
              t={t}
            />
          )}
        </View>
      </TabScreenScrollView>
      <TabOverlayAnchor side="right" offset={BrandSpacing.lg} style={{ zIndex: 60 }}>
        <IconButton
          accessibilityLabel={t("jobsTab.instructorFeed.openArchive")}
          onPress={() => {
            if (isArchiveOpen) {
              setIsArchiveOpen(false);
              archiveSheetRef.current?.close();
              return;
            }
            setIsArchiveOpen(true);
            archiveSheetRef.current?.expand();
          }}
          tone={isArchiveOpen ? "primary" : "secondary"}
          size={58}
          floating
          backgroundColorOverride={String(isArchiveOpen ? palette.primary : palette.surface)}
          icon={
            <IconSymbol
              name="archivebox.fill"
              size={22}
              color={String(isArchiveOpen ? palette.onPrimary : palette.primary)}
            />
          }
        />
      </TabOverlayAnchor>
      <InstructorJobsArchiveSheet
        innerRef={archiveSheetRef}
        onDismissed={() => {
          setIsArchiveOpen(false);
        }}
        onOpenStateChange={setIsArchiveOpen}
        rows={archiveRows}
        palette={palette}
        locale={locale}
        zoneLanguage={zoneLanguage}
        onOpenStudio={onOpenStudio}
      />
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
});
