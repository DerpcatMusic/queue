import type BottomSheet from "@gorhom/bottom-sheet";
import { useMutation, useQuery } from "convex/react";
import type { Href } from "expo-router";
import { Redirect, useRouter } from "expo-router";
import {
  type ComponentType,
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
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
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitDisclosureButtonGroup, type KitDisclosureButtonGroupOption } from "@/components/ui/kit";
import { NativeSearchField } from "@/components/ui/native-search-field";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useMinuteNow } from "@/hooks/use-minute-now";
import { useTheme } from "@/hooks/use-theme";
import { getBoostPresentation } from "@/lib/jobs-utils";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";

type SortMode = "none" | "bonus" | "pay" | "time";

// Layout transition builder type from LinearTransition.duration().reduceMotion()
type JobsLayoutTransition = ReturnType<typeof LinearTransition.duration>;

interface InstructorJobsSheetStickyHeaderProps {
  actionErrorMessage: string | null;
  jobsFilterOptions: readonly KitDisclosureButtonGroupOption<SortMode>[];
  jobsHeaderLayoutTransition: JobsLayoutTransition;
  jobsSearchQuery: string;
  jobsSortSummaryLabel: string;
  showJobsFilters: boolean;
  sortMode: SortMode;
  theme: ReturnType<typeof useTheme>;
  t: ReturnType<typeof useTranslation>["t"];
  onClearError: () => void;
  onSearchChange: (text: string) => void;
  onToggleFilters: () => void;
  onSortChange: (value: SortMode) => void;
  onToggleDirection: () => void;
}

const InstructorJobsSheetStickyHeader = memo(function InstructorJobsSheetStickyHeader({
  actionErrorMessage,
  jobsFilterOptions,
  jobsHeaderLayoutTransition,
  jobsSearchQuery,
  jobsSortSummaryLabel,
  showJobsFilters,
  sortMode,
  theme,
  t,
  onClearError,
  onSearchChange,
  onToggleFilters,
  onSortChange,
  onToggleDirection,
}: InstructorJobsSheetStickyHeaderProps) {
  return (
    <View style={{ gap: BrandSpacing.sm }}>
      <Animated.View
        layout={jobsHeaderLayoutTransition}
        style={[styles.feedIntro, { borderBottomColor: theme.jobs.line }]}
      >
        <Animated.View layout={jobsHeaderLayoutTransition} style={styles.feedIntroText}>
          <ThemedText style={[BrandType.title, { color: theme.color.text }]}>
            {t("jobsTab.availableJobsTitle")}
          </ThemedText>
        </Animated.View>
      </Animated.View>

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
            onChangeText={onSearchChange}
            placeholder={t("jobsTab.searchPlaceholder")}
            clearAccessibilityLabel={t("common.clear")}
            size="sm"
            animateLayout
            containerStyle={{ backgroundColor: theme.jobs.surface }}
          />
        </Animated.View>
        <Animated.View
          layout={jobsHeaderLayoutTransition}
          style={{ flexShrink: 0, minWidth: 0 }}
        >
          <KitDisclosureButtonGroup
            accessibilityLabel={t("jobsTab.instructorFeed.openFilters")}
            expanded={showJobsFilters}
            onToggleExpanded={onToggleFilters}
            options={jobsFilterOptions}
            value={sortMode}
            onChange={onSortChange}
            triggerIcon={
              <IconSymbol
                name="line.3.horizontal.decrease.circle"
                size={18}
                color={theme.color.text}
              />
            }
            size="sm"
            railColor={theme.jobs.surface}
            selectedColor={theme.jobs.surfaceRaised}
            labelColor={theme.color.text}
            selectedLabelColor={theme.color.tertiary}
            dividerColor={theme.jobs.line}
          />
        </Animated.View>
      </Animated.View>

      <Animated.View layout={jobsHeaderLayoutTransition}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle sort direction"
          disabled={sortMode !== "pay" && sortMode !== "time"}
          onPress={onToggleDirection}
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            paddingHorizontal: BrandSpacing.xs,
            paddingVertical: BrandSpacing.xxs,
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <ThemedText style={[BrandType.caption, { color: theme.jobs.idle }]}>
            {jobsSortSummaryLabel}
          </ThemedText>
        </Pressable>
      </Animated.View>

      {actionErrorMessage ? (
        <NoticeBanner
          tone="error"
          message={actionErrorMessage}
          onDismiss={onClearError}
        />
      ) : null}
    </View>
  );
} as ComponentType<InstructorJobsSheetStickyHeaderProps>);

export function InstructorFeed() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const locale = i18n.resolvedLanguage ?? "en";
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const liveNow = useMinuteNow();

  const [jobsSearchQuery, setJobsSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"none" | "bonus" | "pay" | "time">("bonus");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [showJobsFilters, setShowJobsFilters] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [emptyVariantIndex, setEmptyVariantIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [applyingJobId, setApplyingJobId] = useState<Id<"jobs"> | null>(null);
  const [withdrawingApplicationId, setWithdrawingApplicationId] =
    useState<Id<"jobApplications"> | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const archiveSheetRef = useRef<BottomSheet>(null);
  const deferredJobsSearchQuery = useDeferredValue(jobsSearchQuery);
  // Additional spacing on top of the base insets applied by ScreenScaffold
  // ScreenScaffold automatically applies collapsedSheetHeight, safeBottom, and progressViewOffset
  const additionalSpacing = {
    paddingTop: BrandSpacing.xl,
    paddingBottom: BrandSpacing.xl,
    paddingHorizontal: BrandSpacing.lg,
  };

  const { currentUser } = useUser();
  const applyToJob = useMutation(api.jobs.applyToJob);
  const withdrawApplication = useMutation(api.jobs.withdrawApplication);
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
  type MyApplication = NonNullable<typeof myApplications>[number];

  const applicationByJobId = useMemo(() => {
    const entries = ((myApplications ?? []) as MyApplication[]).map(
      (application: MyApplication): [string, MyApplication] => [
        String(application.jobId),
        application,
      ],
    );
    return new Map<string, MyApplication>(entries);
  }, [myApplications]);
  const jobs = useMemo(
    () =>
      ((availableJobs ?? []) as AvailableJob[]).map((job: AvailableJob) => {
        const application = applicationByJobId.get(String(job.jobId));
        if (!application) {
          return job;
        }
        return {
          ...job,
          applicationId: application.applicationId,
          applicationStatus: application.status,
        };
      }),
    [applicationByJobId, availableJobs],
  );
  const emptyVariants = [
    t("jobsTab.instructorFeed.emptyInstructorFreshOne"),
    t("jobsTab.instructorFeed.emptyInstructorFreshTwo"),
    t("jobsTab.instructorFeed.emptyInstructorFreshThree"),
  ];
  const emptyJobsCopy =
    emptyVariants[emptyVariantIndex % emptyVariants.length] ?? emptyVariants[0]!;
  const listViewportMinHeight = 240;

  const filteredAvailableJobs = useMemo(() => {
    const search = deferredJobsSearchQuery.trim().toLowerCase();
    const baseFiltered = search
      ? jobs.filter((job) => {
          const zoneLabel = getZoneLabel(job.zone, zoneLanguage).toLowerCase();
          const sportLabel = toSportLabel(job.sport as never).toLowerCase();
          const haystack =
            `${job.studioName} ${job.studioAddress ?? ""} ${job.zone} ${zoneLabel} ${sportLabel}`.toLowerCase();
          return haystack.includes(search);
        })
      : jobs;

    if (sortMode === "none") return baseFiltered;

    const sorted = [...baseFiltered].sort((a, b) => {
      const aBoost = getBoostPresentation(a.pay, a.boostPreset, a.boostBonusAmount, a.boostActive);
      const bBoost = getBoostPresentation(b.pay, b.boostPreset, b.boostBonusAmount, b.boostActive);

      if (sortMode === "bonus") {
        const boostDelta =
          Number(Boolean(bBoost.bonusAmount)) - Number(Boolean(aBoost.bonusAmount));
        if (boostDelta !== 0) return boostDelta;
        if (bBoost.totalPay !== aBoost.totalPay) return bBoost.totalPay - aBoost.totalPay;
        return a.startTime - b.startTime;
      }
      if (sortMode === "pay") {
        const payA = aBoost.totalPay;
        const payB = bBoost.totalPay;
        return sortDirection === "asc" ? payA - payB : payB - payA;
      }
      if (sortMode === "time") {
        return sortDirection === "asc" ? a.startTime - b.startTime : b.startTime - a.startTime;
      }
      return 0;
    });
    return sorted;
  }, [deferredJobsSearchQuery, jobs, sortMode, sortDirection, zoneLanguage]);
  const archiveRows = useMemo<InstructorArchiveRow[]>(
    () =>
      ((myApplications ?? []) as MyApplication[])
        .filter((application: MyApplication) => {
          if (application.jobStatus === "completed" || application.jobStatus === "cancelled") {
            return true;
          }
          if (application.status === "rejected" || application.status === "withdrawn") {
            return true;
          }
          return application.endTime <= queryNow;
        })
        .map((application: MyApplication) => ({
          applicationId: application.applicationId,
          jobId: application.jobId,
          studioId: application.studioId,
          branchId: application.branchId,
          studioName: application.studioName,
          branchName: application.branchName,
          sport: application.sport,
          zone: application.zone,
          startTime: application.startTime,
          endTime: application.endTime,
          pay: application.pay,
          appliedAt: application.appliedAt,
          jobStatus: application.jobStatus,
          applicationStatus: application.status,
          ...(application.branchAddress ? { branchAddress: application.branchAddress } : {}),
          ...(application.studioImageUrl ? { studioImageUrl: application.studioImageUrl } : {}),
          ...(application.closureReason ? { closureReason: application.closureReason } : {}),
        }))
        .sort(
          (left: InstructorArchiveRow, right: InstructorArchiveRow) =>
            right.startTime - left.startTime,
        ),
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
        { value: "none", label: "None" },
        { value: "bonus", label: "Bonus" },
        { value: "pay", label: "Pay" },
        { value: "time", label: "Time" },
      ] as const satisfies readonly KitDisclosureButtonGroupOption<
        "none" | "bonus" | "pay" | "time"
      >[],
    [],
  );
  const jobsSortSummaryLabel = useMemo(() => {
    if (sortMode === "none") return "Sorted by: None";
    if (sortMode === "bonus") return "Sorted by: Bonus";
    if (sortMode === "pay") return `Sorted by: Pay ${sortDirection === "asc" ? "↑" : "↓"}`;
    return `Sorted by: Time ${sortDirection === "asc" ? "↑" : "↓"}`;
  }, [sortDirection, sortMode]);
  const jobsHeaderLayoutTransition = useMemo(
    () => LinearTransition.duration(220).reduceMotion(ReduceMotion.System),
    [],
  );

  // Stable callbacks passed to memoized header - prevents header re-render on parent state changes
  const onClearError = useCallback(() => setActionErrorMessage(null), []);
  const onSearchChange = useCallback((text: string) => setJobsSearchQuery(text), []);
  const onToggleFilters = useCallback(
    () => setShowJobsFilters((current) => !current),
    [],
  );
  const onSortChange = useCallback((value: SortMode) => {
    setSortMode(value);
    if (value === "pay") setSortDirection("desc");
    if (value === "time") setSortDirection("asc");
    if (value === "bonus" || value === "none") setSortDirection("desc");
  }, []);
  const onToggleDirection = useCallback(() => {
    if (sortMode === "pay" || sortMode === "time") {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    }
  }, [sortMode]);

  const jobsSheetConfig = useMemo(
    () => ({
      stickyHeader: (
        <InstructorJobsSheetStickyHeader
          actionErrorMessage={actionErrorMessage}
          jobsFilterOptions={jobsFilterOptions}
          jobsHeaderLayoutTransition={jobsHeaderLayoutTransition}
          jobsSearchQuery={jobsSearchQuery}
          jobsSortSummaryLabel={jobsSortSummaryLabel}
          showJobsFilters={showJobsFilters}
          sortMode={sortMode}
          theme={theme}
          t={t}
          onClearError={onClearError}
          onSearchChange={onSearchChange}
          onToggleFilters={onToggleFilters}
          onSortChange={onSortChange}
          onToggleDirection={onToggleDirection}
        />
      ),
      padding: {
        vertical: BrandSpacing.md,
        horizontal: BrandSpacing.lg,
      },
      draggable: false,
      expandable: false,
      steps: [0.16],
      initialStep: 0,
      collapsedHeightMode: "content" as const,
      backgroundColor: theme.jobs.canvas,
      topInsetColor: theme.jobs.canvas,
    }),
    [
      actionErrorMessage,
      jobsFilterOptions,
      jobsHeaderLayoutTransition,
      jobsSearchQuery,
      jobsSortSummaryLabel,
      showJobsFilters,
      sortMode,
      t,
      theme,
      onClearError,
      onSearchChange,
      onToggleFilters,
      onSortChange,
      onToggleDirection,
    ],
  );

  const onApply = useCallback(
    async (jobId: Id<"jobs">) => {
      setActionErrorMessage(null);
      setApplyingJobId(jobId);
      try {
        await applyToJob({ jobId });
      } catch (error) {
        console.error("[jobs] apply failed", error);
        setActionErrorMessage(t("jobsTab.errors.applyError"));
      } finally {
        setApplyingJobId(null);
      }
    },
    [applyToJob, t],
  );

  const onWithdrawApplication = useCallback(
    async (applicationId: Id<"jobApplications">) => {
      setActionErrorMessage(null);
      setWithdrawingApplicationId(applicationId);
      try {
        await withdrawApplication({ applicationId });
      } catch (error) {
        console.error("[jobs] withdraw failed", error);
        setActionErrorMessage(t("jobsTab.errors.withdrawError"));
      } finally {
        setWithdrawingApplicationId(null);
      }
    },
    [t, withdrawApplication],
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
    <View style={[styles.screen, { backgroundColor: theme.jobs.canvas }]}>
      <TabScreenScrollView
        routeKey="instructor/jobs/index"
        style={styles.screen}
        contentContainerStyle={[styles.content, additionalSpacing]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.jobs.signal}
            colors={[theme.jobs.signal]}
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
              <View style={{ alignItems: "center", gap: BrandSpacing.lg }}>
                <IconSymbol name="briefcase.fill" size={32} color={theme.jobs.idle} />
                <View style={{ alignItems: "center", gap: BrandSpacing.sm }}>
                  <ThemedText style={[BrandType.title, { color: theme.color.text }]}>
                    {t("jobsTab.instructorFeed.emptyInstructorShort")}
                  </ThemedText>
                  <ThemedText
                    style={[BrandType.body, { color: theme.jobs.idle, textAlign: "center" }]}
                  >
                    {emptyJobsCopy}
                  </ThemedText>
                  <ThemedText
                    style={[BrandType.caption, { color: theme.jobs.idle, textAlign: "center" }]}
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
              <View style={{ alignItems: "center", gap: BrandSpacing.md }}>
                <IconSymbol name="magnifyingglass" size={28} color={theme.jobs.idle} />
                <ThemedText style={[BrandType.bodyMedium, { color: theme.color.text }]}>
                  {t("jobsTab.noJobsFound")}
                </ThemedText>
                <ThemedText
                  style={[BrandType.caption, { color: theme.jobs.idle, textAlign: "center" }]}
                >
                  Try a different search or sorting mode.
                </ThemedText>
              </View>
            </View>
          ) : (
            <InstructorOpenJobsList
              jobs={filteredAvailableJobs}
              locale={locale}
              zoneLanguage={zoneLanguage}
              applyingJobId={applyingJobId}
              withdrawingApplicationId={withdrawingApplicationId}
              now={liveNow}
              onApply={onApply}
              onWithdrawApplication={onWithdrawApplication}
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
          backgroundColorOverride={isArchiveOpen ? theme.jobs.signal : theme.jobs.surface}
          icon={
            <IconSymbol
              name="archivebox.fill"
              size={22}
              color={isArchiveOpen ? theme.color.onPrimary : theme.jobs.signal}
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
        locale={locale}
        zoneLanguage={zoneLanguage}
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
    paddingBottom: BrandSpacing.xl,
    gap: BrandSpacing.lg,
  },
  feedIntro: {
    paddingVertical: BrandSpacing.md,
    paddingHorizontal: BrandSpacing.xs,
    borderBottomWidth: 1,
    marginBottom: BrandSpacing.xs,
  },
  feedIntroText: {
    gap: BrandSpacing.xxs,
  },
});
