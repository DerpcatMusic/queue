import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Platform, Text, View } from "react-native";
import { FilterImage, type Filters } from "react-native-svg/filter-image";
import { DotStatusPill } from "@/components/home/home-shared";
import { InstructorJobCard } from "@/components/jobs/instructor/instructor-job-card";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { LoadingScreen } from "@/components/loading-screen";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useMinuteNow } from "@/hooks/use-minute-now";
import { useTheme } from "@/hooks/use-theme";
import { FontFamily, FontSize, LetterSpacing, LineHeight } from "@/lib/design-system";

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
  const queryNow = Math.floor(now / (60 * 1000)) * 60 * 1000;
  const applyToJob = useMutation(api.jobs.applyToJob);
  const withdrawApplication = useMutation(api.jobs.withdrawApplication);
  const studioProfile = useQuery(
    api.jobs.getStudioProfileForInstructor,
    studioId ? { studioId: studioId as Id<"studioProfiles">, now: queryNow } : "skip",
  );
  const myApplications = useQuery(api.jobs.getMyApplications, { limit: 120 });

  const onApply = useCallback(
    async (nextJobId: Id<"jobs">) => {
      setActionErrorMessage(null);
      setApplyingJobId(nextJobId);
      try {
        await applyToJob({ jobId: nextJobId });
      } catch (error) {
        console.error("[studio-profile] apply failed", error);
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
        console.error("[studio-profile] withdraw failed", error);
        setActionErrorMessage(t("jobsTab.errors.withdrawError"));
      } finally {
        setWithdrawingApplicationId(null);
      }
    },
    [t, withdrawApplication],
  );

  const sortedJobs = useMemo(() => {
    if (!studioProfile?.jobs) return [];
    const applicationByJobId = new Map(
      (myApplications ?? []).map((application) => [String(application.jobId), application]),
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

  const sportsLabels = useMemo(
    () => (studioProfile?.sports ?? []).map((sport) => toSportLabel(sport as never)),
    [studioProfile?.sports],
  );

  const jobsSheetConfig = useMemo(() => {
    if (!studioProfile || !pathname?.startsWith("/instructor/jobs/studios/")) {
      return null;
    }

    return {
      content: (
        <View
          style={{
            justifyContent: "space-between",
            overflow: "hidden",
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            borderCurve: "continuous",
            backgroundColor: palette.primary,
            paddingBottom: BrandSpacing.xl,
            minHeight: 0,
          }}
        >
          {studioProfile.studioImageUrl ? (
            <>
              <FilterImage
                source={{ uri: studioProfile.studioImageUrl }}
                resizeMode="cover"
                {...(Platform.OS === "web" ? {} : { filters: STUDIO_HEADER_NATIVE_FILTERS })}
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  ...(Platform.OS === "web"
                    ? { filter: "grayscale(100%) contrast(118%) brightness(78%)" }
                    : {}),
                }}
              />
            </>
          ) : null}
          <View
            style={{
              paddingHorizontal: BrandSpacing.lg,
              paddingTop: BrandSpacing.md,
            }}
          >
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
          </View>
          <View
            style={{
              paddingHorizontal: BrandSpacing.xl,
              paddingBottom: BrandSpacing.xxl,
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: FontFamily.display,
                fontSize: FontSize.heading,
                lineHeight: LineHeight.heading,
                letterSpacing: LetterSpacing.heading,
                color: palette.onPrimary,
                includeFontPadding: false,
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 4,
              }}
            >
              {studioProfile.studioName}
            </Text>
            <Text
              style={{
                ...BrandType.body,
                color: palette.onPrimary,
                includeFontPadding: false,
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
              }}
            >
              {studioProfile.studioAddress}
            </Text>
          </View>
        </View>
      ),
      padding: {
        vertical: 0,
        horizontal: 0,
      },
       steps: [0],
       initialStep: 0,
       draggable: false,
       expandable: false,
      collapsedHeightMode: "content" as const,
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
      sheetInsets={{
        topSpacing: BrandSpacing.xs,
        bottomSpacing: BrandSpacing.xxl,
        horizontalPadding: BrandSpacing.xl,
      }}
      contentContainerStyle={[
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
                {sportsLabels.map((label) => (
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
