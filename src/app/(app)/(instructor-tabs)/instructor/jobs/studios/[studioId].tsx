import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Image, Text, useWindowDimensions, View } from "react-native";
import { DotStatusPill } from "@/components/home/home-shared";
import { InstructorJobCard } from "@/components/jobs/instructor/instructor-job-card";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { useTopSheetContentInsets } from "@/components/layout/use-top-sheet-content-insets";
import { LoadingScreen } from "@/components/loading-screen";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";
import { useMinuteNow } from "@/hooks/use-minute-now";

export default function InstructorStudioProfileRoute() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const router = useRouter();
  const pathname = usePathname();
  const now = useMinuteNow();
  const { height: screenHeight } = useWindowDimensions();
  const { safeTop } = useAppInsets();
  const locale = i18n.resolvedLanguage ?? "en";
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";
  const { studioId, jobId } = useLocalSearchParams<{
    studioId?: string;
    jobId?: string;
  }>();
  const [applyingJobId, setApplyingJobId] = useState<Id<"jobs"> | null>(null);
  const [applyErrorMessage, setApplyErrorMessage] = useState<string | null>(null);
  const { contentContainerStyle } = useTopSheetContentInsets({
    topSpacing: BrandSpacing.xs,
    bottomSpacing: BrandSpacing.xxl,
    horizontalPadding: BrandSpacing.xl,
  });

  const queryNow = Math.floor(now / (60 * 1000)) * 60 * 1000;
  const applyToJob = useMutation(api.jobs.applyToJob);
  const studioProfile = useQuery(
    api.jobs.getStudioProfileForInstructor,
    studioId ? { studioId: studioId as Id<"studioProfiles">, now: queryNow } : "skip",
  );

  const onApply = useCallback(
    async (nextJobId: Id<"jobs">) => {
      setApplyErrorMessage(null);
      setApplyingJobId(nextJobId);
      try {
        await applyToJob({ jobId: nextJobId });
      } catch (error) {
        console.error("[studio-profile] apply failed", error);
        setApplyErrorMessage(t("jobsTab.errors.applyError"));
      } finally {
        setApplyingJobId(null);
      }
    },
    [applyToJob, t],
  );

  const sortedJobs = useMemo(() => {
    if (!studioProfile?.jobs) return [];
    const selectedJobId = jobId ? String(jobId) : null;
    return [...studioProfile.jobs].sort((left, right) => {
      if (selectedJobId) {
        const leftSelected = String(left.jobId) === selectedJobId;
        const rightSelected = String(right.jobId) === selectedJobId;
        if (leftSelected && !rightSelected) return -1;
        if (!leftSelected && rightSelected) return 1;
      }
      return left.startTime - right.startTime;
    });
  }, [jobId, studioProfile?.jobs]);

  const sportsLabels = useMemo(
    () => (studioProfile?.sports ?? []).map((sport) => toSportLabel(sport as never)),
    [studioProfile?.sports],
  );

  const jobsSheetConfig = useMemo(() => {
    if (!studioProfile || !pathname?.startsWith("/instructor/jobs/studios/")) {
      return null;
    }
    const headerHeight = 284;
    const availableHeight = Math.max(1, screenHeight - safeTop - 80);
    const collapsedStep = Math.max(0.24, Math.min(0.42, headerHeight / availableHeight));

    return {
      content: (
        <View
          style={{
            height: headerHeight,
            justifyContent: "space-between",
            overflow: "hidden",
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            borderCurve: "continuous",
            backgroundColor: palette.primary as string,
          }}
        >
          {studioProfile.studioImageUrl ? (
            <Image
              source={{ uri: studioProfile.studioImageUrl }}
              resizeMode="cover"
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
              }}
            />
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
              backgroundColorOverride={palette.surface as string}
              accessibilityLabel={t("common.back")}
              onPress={() => router.back()}
              icon={
                <IconSymbol
                  name="chevron.right"
                  size={20}
                  color={palette.text as string}
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
                ...BrandType.heading,
                color: palette.onPrimary as string,
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 4,
              }}
            >
              {studioProfile.studioName}
            </Text>
            <Text
              style={{
                ...BrandType.body,
                color: palette.onPrimary as string,
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
      steps: [collapsedStep],
      initialStep: 0,
      draggable: false,
      expandable: false,
      backgroundColor: palette.primary as string,
      topInsetColor: palette.primary as string,
    };
  }, [
    palette.onPrimary,
    palette.primary,
    palette.surface,
    palette.text,
    router,
    safeTop,
    screenHeight,
    studioProfile,
    pathname,
    t,
  ]);

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
        contentContainerStyle,
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
            backgroundColor: palette.surface as string,
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
                    backgroundColor={palette.primarySubtle as string}
                    color={palette.primary as string}
                    label={label}
                  />
                ))}
              </View>
            ) : null}
            {studioProfile.bio ? (
              <Text
                style={{
                  ...BrandType.body,
                  color: palette.textMuted as string,
                }}
              >
                {studioProfile.bio}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {applyErrorMessage ? (
        <NoticeBanner
          tone="error"
          message={applyErrorMessage}
          onDismiss={() => setApplyErrorMessage(null)}
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
            palette={palette}
            applyingJobId={applyingJobId}
            now={now}
            onApply={onApply}
            t={t}
            variant="studioDetail"
          />
        ))}
      </View>
    </TabScreenScrollView>
  );
}
