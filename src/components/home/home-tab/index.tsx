import { useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useWindowDimensions, View } from "react-native";
import { getHomeHeaderExpandedHeight, HomeHeaderSheet } from "@/components/home/home-header-sheet";
import {
  HomeRoleContent,
  type HomeRoleContentProps,
} from "@/components/home/home-tab/home-role-content";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { useDeferredTabMount } from "@/components/layout/use-deferred-tab-mount";
import { LoadingScreen } from "@/components/loading-screen";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";

const HOME_STUDIO_JOBS_LIMIT = 36;
const BOTTOM_TABS_ESTIMATE = 80;

function HomeBodyPlaceholder({ backgroundColor }: { backgroundColor: string }) {
  return (
    <TabScreenRoot mode="static" topInsetTone="sheet" style={{ backgroundColor }}>
      <View style={{ flex: 1, backgroundColor }} />
    </TabScreenRoot>
  );
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const locale = i18n.resolvedLanguage ?? "en";
  const { safeTop } = useAppInsets();
  const { height: screenHeight } = useWindowDimensions();

  const { currentUser, isAuthLoading, isAuthenticated } = useUser();
  const requestedRole = currentUser?.role;
  const homeBodyReady = useDeferredTabMount(
    requestedRole === "instructor" || requestedRole === "studio",
  );
  const canQueryInstructor =
    homeBodyReady && !isAuthLoading && isAuthenticated && currentUser?.role === "instructor";
  const canQueryStudio =
    homeBodyReady && !isAuthLoading && isAuthenticated && currentUser?.role === "studio";

  const myStudioJobs = useQuery(
    api.jobs.getMyStudioJobs,
    canQueryStudio ? { limit: HOME_STUDIO_JOBS_LIMIT } : "skip",
  );
  const instructorHomeStats = useQuery(
    api.home.getMyInstructorHomeStats,
    canQueryInstructor ? {} : "skip",
  );
  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    canQueryInstructor ? {} : "skip",
  );
  const studioSettings = useQuery(api.users.getMyStudioSettings, canQueryStudio ? {} : "skip");

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "ILS",
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  const activeRole = currentUser?.role ?? null;
  const fallbackDisplayName =
    currentUser?.fullName?.trim().split(/\s+/)[0] || t("home.shared.unknownName");
  const homeDisplayName =
    activeRole === "instructor"
      ? (instructorSettings?.displayName ?? fallbackDisplayName)
      : activeRole === "studio"
        ? (studioSettings?.studioName ?? fallbackDisplayName)
        : fallbackDisplayName;
  const homeProfileImageUrl =
    activeRole === "instructor"
      ? (instructorSettings?.profileImageUrl ?? currentUser?.image)
      : activeRole === "studio"
        ? (studioSettings?.profileImageUrl ?? currentUser?.image)
        : currentUser?.image;
  const homeSubtitle =
    activeRole === "instructor"
      ? instructorHomeStats?.isVerified
        ? t("home.instructor.verified")
        : t("home.instructor.needsPolish")
      : activeRole === "studio"
        ? t("home.studio.role")
        : undefined;
  const homeHeaderHeight = useMemo(() => getHomeHeaderExpandedHeight(safeTop), [safeTop]);
  const homeSheetStep = useMemo(() => {
    const availableHeight = Math.max(1, screenHeight - safeTop - BOTTOM_TABS_ESTIMATE);
    return Math.max(0.1, Math.min(0.4, homeHeaderHeight / availableHeight));
  }, [homeHeaderHeight, safeTop, screenHeight]);
  const homeSheetContent = useMemo(
    () =>
      activeRole === "instructor" || activeRole === "studio" ? (
        <HomeHeaderSheet
          displayName={homeDisplayName}
          profileImageUrl={homeProfileImageUrl}
          palette={palette}
          isVerified={
            activeRole === "instructor" ? (instructorHomeStats?.isVerified ?? false) : false
          }
          {...(homeSubtitle ? { subtitle: homeSubtitle } : {})}
        />
      ) : null,
    [
      activeRole,
      homeDisplayName,
      homeProfileImageUrl,
      homeSubtitle,
      instructorHomeStats?.isVerified,
      palette,
    ],
  );

  const homeSheetConfig = useMemo(
    () =>
      activeRole === "instructor" || activeRole === "studio"
        ? {
            content: homeSheetContent,
            steps: [homeSheetStep],
            initialStep: 0,
            padding: {
              vertical: 0,
              horizontal: 0,
            },
            backgroundColor: palette.primary as string,
            topInsetColor: palette.primary as string,
          }
        : null,
    [activeRole, homeSheetContent, homeSheetStep, palette],
  );

  useGlobalTopSheet("index", homeSheetConfig);

  if (isAuthLoading) {
    return <LoadingScreen label={t("home.loading")} />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser === undefined) {
    return <LoadingScreen label={t("home.loading")} />;
  }

  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser && (!currentUser.onboardingComplete || currentUser.role === "pending")) {
    return <Redirect href="/onboarding" />;
  }

  if (activeRole === "pending") {
    return <Redirect href="/onboarding" />;
  }

  if (activeRole !== "instructor" && activeRole !== "studio") {
    return <LoadingScreen label={t("home.loading")} />;
  }

  if (
    (activeRole === "instructor" && !homeBodyReady) ||
    (activeRole === "studio" && !homeBodyReady)
  ) {
    return <HomeBodyPlaceholder backgroundColor={palette.appBg as string} />;
  }

  return (
    <HomeRoleContent
      activeRole={activeRole}
      homeBodyReady={homeBodyReady}
      locale={locale}
      palette={palette}
      currencyFormatter={currencyFormatter}
      t={t}
      instructorHomeStats={instructorHomeStats}
      myStudioJobs={myStudioJobs as HomeRoleContentProps["myStudioJobs"]}
    />
  );
}
