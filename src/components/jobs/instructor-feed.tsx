import type BottomSheet from "@gorhom/bottom-sheet";
import { useMutation, useQuery } from "convex/react";
import type { Href } from "expo-router";
import { Redirect, useRouter } from "expo-router";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, StyleSheet, View } from "react-native";
import type { InstructorMarketplaceJob } from "@/components/jobs/instructor/instructor-job-card";
import {
  type InstructorArchiveRow,
  InstructorJobsArchiveSheet,
} from "@/components/jobs/instructor/instructor-jobs-archive-sheet";
import { InstructorOpenJobsList } from "@/components/jobs/instructor/instructor-open-jobs-list";
import { TabOverlayAnchor } from "@/components/layout/tab-overlay-anchor";
import { TabSceneTransition } from "@/components/layout/tab-scene-transition";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useMinuteNow } from "@/hooks/use-minute-now";
import { useTheme } from "@/hooks/use-theme";
import { getBoostPresentation } from "@/lib/jobs-utils";
import { openInstructorVerificationGate } from "@/lib/open-instructor-verification-gate";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";
import { Box } from "@/primitives";

export function InstructorFeed() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const locale = i18n.resolvedLanguage ?? "en";
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const liveNow = useMinuteNow();

  const [jobsSearchQuery] = useState("");
  const [sortMode] = useState<"none" | "bonus" | "pay" | "time">("bonus");
  const [sortDirection] = useState<"asc" | "desc">("desc");
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [emptyVariantIndex, setEmptyVariantIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [applyingJobId, setApplyingJobId] = useState<Id<"jobs"> | null>(null);
  const [withdrawingApplicationId, setWithdrawingApplicationId] =
    useState<Id<"jobApplications"> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const archiveSheetRef = useRef<BottomSheet>(null);
  const deferredJobsSearchQuery = useDeferredValue(jobsSearchQuery);
  // IMPORTANT: top/bottom/horizontal sheet padding is owned by ScreenScaffold via sheetInsets.
  // This screen must only contribute content rhythm (gap), otherwise it overrides the
  // collapsed-sheet inset contract and content renders under the top sheet.
  const additionalSpacing = {
    gap: BrandSpacing.lg,
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
  const jobs = useMemo<InstructorMarketplaceJob[]>(
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
          canApplyToJob: false,
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

  const onApply = useCallback(
    async (job: InstructorMarketplaceJob) => {
      if (!job.canApplyToJob) {
        openInstructorVerificationGate(t, {
          onVerifyNow: () => router.push("/instructor/profile/compliance" as Href),
        });
        return;
      }
      setApplyingJobId(job.jobId);
      try {
        await applyToJob({ jobId: job.jobId });
      } catch (error) {
        console.error("[jobs] apply failed", error);
      } finally {
        setApplyingJobId(null);
      }
    },
    [applyToJob, router, t],
  );

  const onWithdrawApplication = useCallback(
    async (applicationId: Id<"jobApplications">) => {
      setWithdrawingApplicationId(applicationId);
      try {
        await withdrawApplication({ applicationId });
      } catch (error) {
        console.error("[jobs] withdraw failed", error);
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
    <TabSceneTransition>
      <Box flex={1} style={{ backgroundColor: theme.jobs.canvas }}>
        <TabScreenScrollView
          routeKey="instructor/jobs/index"
          style={styles.screen}
          contentContainerStyle={[styles.content, additionalSpacing]}
          sheetInsets={{
            topSpacing: BrandSpacing.lg,
            bottomSpacing: BrandSpacing.xl,
            horizontalPadding: BrandSpacing.lg,
          }}
          topInsetTone="sheet"
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
          <Box flex={1} gap="lg">
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
          </Box>
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
      </Box>
    </TabSceneTransition>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
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
