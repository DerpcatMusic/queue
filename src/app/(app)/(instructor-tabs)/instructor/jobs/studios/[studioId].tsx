import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Platform, StyleSheet, Text, View } from "react-native";
import { FilterImage, type Filters } from "react-native-svg/filter-image";
import { DotStatusPill } from "@/components/home/home-shared";
import {
  InstructorJobCard,
  type InstructorMarketplaceJob,
} from "@/components/jobs/instructor/instructor-job-card";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { LoadingScreen } from "@/components/loading-screen";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useMinuteNow } from "@/hooks/use-minute-now";
import { useTheme } from "@/hooks/use-theme";
import { FontFamily, FontSize, LetterSpacing, LineHeight } from "@/lib/design-system";
import { openInstructorVerificationGate } from "@/lib/open-instructor-verification-gate";
import { Box } from "@/primitives";

const STUDIO_HEADER_NATIVE_FILTERS: Filters = [
  { name: "feColorMatrix", type: "saturate", values: 0 },
  {
    name: "feColorMatrix",
    type: "matrix",
    values: [1.15, 0, 0, 0, -0.07, 0, 1.15, 0, 0, -0.07, 0, 0, 1.15, 0, -0.07, 0, 0, 0, 1, 0],
  },
];

export default function InstructorStudioProfileRoute() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const now = useMinuteNow();
  const { color: palette } = useTheme();
  const locale = i18n.resolvedLanguage ?? "en";
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const { studioId, jobId } = useLocalSearchParams<{
    studioId?: string;
    jobId?: string;
  }>();
  const [applyingJobId, setApplyingJobId] = useState<Id<"jobs"> | null>(null);
  const [withdrawingApplicationId, setWithdrawingApplicationId] =
    useState<Id<"jobApplications"> | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  // Additional spacing on top of the base insets applied by ScreenScaffold
  // ScreenScaffold automatically applies collapsedSheetHeight and safeBottom
  const additionalSpacing = {
    paddingTop: BrandSpacing.xs,
    paddingBottom: BrandSpacing.xxl,
    paddingHorizontal: BrandSpacing.xl,
  };

  const queryNow = Math.floor(now / (60 * 1000)) * 60 * 1000;
  const applyToJob = useMutation(api.jobs.applyToJob);
  const withdrawApplication = useMutation(api.jobs.withdrawApplication);
  const studioProfile = useQuery(
    api.jobs.getStudioProfileForInstructor,
    studioId ? { studioId: studioId as Id<"studioProfiles">, now: queryNow } : "skip",
  );
  const myApplications = useQuery(api.jobs.getMyApplications, { limit: 120 });

  const onApply = useCallback(
    async (job: InstructorMarketplaceJob) => {
      if (!job.canApplyToJob) {
        openInstructorVerificationGate(t, {
          onVerifyNow: () => router.push("/instructor/profile/compliance"),
        });
        return;
      }
      setActionErrorMessage(null);
      setApplyingJobId(job.jobId);
      try {
        await applyToJob({ jobId: job.jobId });
      } catch (error) {
        console.error("[studio-profile] apply failed", error);
        setActionErrorMessage(t("jobsTab.errors.applyError"));
      } finally {
        setApplyingJobId(null);
      }
    },
    [applyToJob, router, t],
  );

  const onWithdrawApplication = useCallback(
    async (applicationId: Id<"jobApplications">) => {
      setActionErrorMessage(null);
      setWithdrawingApplicationId(applicationId);
      try {
        await withdrawApplication({ applicationId });
      } catch (error) {
        console.error("[studio-profile] withdraw failed", error);
        setActionErrorMessage(t("jobsTab.errors.withdrawError"));
      } finally {
        setWithdrawingApplicationId(null);
      }
    },
    [t, withdrawApplication],
  );

  const sortedJobs = useMemo<InstructorMarketplaceJob[]>(() => {
    if (!studioProfile?.jobs) return [];
    const applications: Array<{
      applicationId: Id<"jobApplications">;
      jobId: Id<"jobs">;
      status: NonNullable<InstructorMarketplaceJob["applicationStatus"]>;
    }> = (myApplications ?? []).map((application) => ({
      applicationId: application.applicationId,
      jobId: application.jobId,
      status: application.status,
    }));
    const applicationByJobId = new Map(
      applications.map((application) => [String(application.jobId), application] as const),
    );
    const selectedJobId = jobId ? String(jobId) : null;
    return [...studioProfile.jobs]
      .map((job) => {
        const application = applicationByJobId.get(String(job.jobId));
        if (!application) {
          return job;
        }
        return {
          ...job,
          applicationId: application.applicationId,
          applicationStatus: application.status,
        };
      })
      .sort((left, right) => {
        if (selectedJobId) {
          const leftSelected = String(left.jobId) === selectedJobId;
          const rightSelected = String(right.jobId) === selectedJobId;
          if (leftSelected && !rightSelected) return -1;
          if (!leftSelected && rightSelected) return 1;
        }
        return left.startTime - right.startTime;
      });
  }, [jobId, myApplications, studioProfile?.jobs]);

  const sportsLabels = useMemo<string[]>(
    () =>
      (studioProfile?.sports ?? []).map((sport: string) => toSportLabel(sport as never)),
    [studioProfile?.sports],
  );

  const jobsSheetConfig = useMemo(() => {
    if (!studioProfile || !pathname?.startsWith("/instructor/jobs/studios/")) {
      return null;
    }

    return {
      content: (
        <Box
          flex={1}
          style={{
            overflow: "hidden",
            borderBottomLeftRadius: BrandRadius.xl,
            borderBottomRightRadius: BrandRadius.xl,
            borderCurve: "continuous",
            backgroundColor: palette.primary,
          }}
        >
          {/* Banner image - fills entire sheet with cover fit */}
          {studioProfile.studioImageUrl ? (
            <Box
              style={{
                ...StyleSheet.absoluteFillObject,
                zIndex: 0,
              }}
            >
              <FilterImage
                source={{ uri: studioProfile.studioImageUrl }}
                resizeMode="cover"
                {...(Platform.OS === "web" ? {} : { filters: STUDIO_HEADER_NATIVE_FILTERS })}
                style={StyleSheet.absoluteFillObject}
              />
            </Box>
          ) : (
            <Box
              style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: palette.primary,
              }}
            />
          )}

          {/* Dark gradient overlay for text readability */}
          <Box
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: "rgba(0,0,0,0.35)",
              zIndex: 1,
            }}
          />

          {/* Content overlay - flexbox column */}
          <Box flex={1} justifyContent="space-between" zIndex={2}>
            {/* Top row - back button */}
            <Box px="lg" pt="md">
              <IconButton
                size={42}
                tone="secondary"
                backgroundColorOverride={palette.surface}
                accessibilityLabel={t("common.back")}
                onPress={() => router.back()}
                icon={
                  <IconSymbol
                    name="chevron.right"
                    size={20}
                    color={palette.text}
                    style={{
                      transform: [{ rotate: I18nManager.isRTL ? "0deg" : "180deg" }],
                    }}
                  />
                }
              />
            </Box>

            {/* Bottom row - studio info */}
            <Box px="xl" pb="xxl" gap="xs">
              <Text
                style={{
                  fontFamily: FontFamily.display,
                  fontSize: FontSize.heading,
                  lineHeight: LineHeight.heading,
                  letterSpacing: LetterSpacing.heading,
                  color: "#FFFFFF",
                  includeFontPadding: false,
                }}
              >
                {studioProfile.studioName}
              </Text>
              {studioProfile.studioAddress ? (
                <Text
                  style={{
                    ...BrandType.body,
                    color: "rgba(255,255,255,0.85)",
                    includeFontPadding: false,
                  }}
                >
                  {studioProfile.studioAddress}
                </Text>
              ) : null}
            </Box>
          </Box>
        </Box>
      ),
      padding: {
        vertical: 0,
        horizontal: 0,
      },
      // Fixed step height like calendar tab (~18%) - NOT content-based
      // This ensures consistent banner size regardless of content
      steps: [0.18],
      initialStep: 0,
      draggable: false,
      expandable: false,
      collapsedHeightMode: "step" as const,
      backgroundColor: palette.primary,
      topInsetColor: palette.primary,
    };
  }, [router, studioProfile, pathname, t, palette]);

  useGlobalTopSheet("jobs", jobsSheetConfig, "jobs:studio-profile");

  if (!studioId) {
    return <LoadingScreen label={t("jobsTab.loading")} />;
  }

  if (studioProfile === undefined) {
    return <LoadingScreen label={t("jobsTab.loading")} />;
  }

  if (studioProfile === null) {
    return <LoadingScreen label={t("jobsTab.loading")} />;
  }

  return (
    <TabScreenScrollView
      style={{ flex: 1, backgroundColor: palette.appBg }}
      topInsetTone="sheet"
      contentContainerStyle={[
        additionalSpacing,
        {
          gap: BrandSpacing.lg,
        },
      ]}
    >
      {sportsLabels.length > 0 || studioProfile.bio ? (
        <View
          style={{
            borderRadius: 32,
            borderCurve: "continuous",
            backgroundColor: palette.surface,
          }}
        >
          <View
            style={{
              paddingHorizontal: BrandSpacing.xl,
              paddingVertical: BrandSpacing.lg,
              gap: BrandSpacing.md,
            }}
          >
            {sportsLabels.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {sportsLabels.map((label: string) => (
                  <DotStatusPill
                    key={label}
                    backgroundColor={palette.primarySubtle}
                    color={palette.primary}
                    label={label}
                  />
                ))}
              </View>
            ) : null}
            {studioProfile.bio ? (
              <Text
                style={{
                  ...BrandType.body,
                  color: palette.textMuted,
                  includeFontPadding: false,
                }}
              >
                {studioProfile.bio}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {actionErrorMessage ? (
        <NoticeBanner
          tone="error"
          message={actionErrorMessage}
          onDismiss={() => setActionErrorMessage(null)}
          borderColor={palette.danger}
          backgroundColor={palette.dangerSubtle}
          textColor={palette.danger}
          iconColor={palette.danger}
        />
      ) : null}

      <View style={{ gap: BrandSpacing.sm }}>
        {sortedJobs.map((job) => (
          <InstructorJobCard
            key={job.jobId}
            job={job}
            locale={locale}
            zoneLanguage={zoneLanguage}
            applyingJobId={applyingJobId}
            withdrawingApplicationId={withdrawingApplicationId}
            now={now}
            onApply={onApply}
            onWithdrawApplication={onWithdrawApplication}
            t={t}
            variant="studioDetail"
          />
        ))}
      </View>
    </TabScreenScrollView>
  );
}
