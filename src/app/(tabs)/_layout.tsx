import { useAuthActions } from "@convex-dev/auth/react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useQuery } from "convex/react";
import { Redirect, usePathname } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { type ColorValue, Platform, View } from "react-native";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { KitButton, KitSurface } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { useSystemUi } from "@/contexts/system-ui-context";
import { TabBarScrollProvider } from "@/contexts/tab-bar-scroll-context";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useBrand } from "@/hooks/use-brand";
import { useThemePreference } from "@/hooks/use-theme-preference";

type RoleTabSpec = {
  key: string;
  label: string;
  iconName: keyof typeof MaterialIcons.glyphMap;
  badgeCount?: number;
  name: string;
  href: string;
  sfDefault: string;
  sfSelected: string;
};

function resolveTabStatusInsetColor(
  pathname: string | null,
  palette: ReturnType<typeof useBrand>,
  resolvedScheme: "light" | "dark",
): ColorValue {
  if (!pathname) {
    return palette.appBg;
  }

  if (pathname.includes("/calendar")) {
    return resolvedScheme === "dark" ? palette.surface : palette.surfaceAlt;
  }

  if (pathname === "/instructor" || pathname === "/studio") {
    return palette.surface;
  }

  return palette.appBg;
}

function NativeTabBadge({ count }: { count: number }) {
  return (
    <NativeTabs.Trigger.Badge hidden={count <= 0}>
      {count > 99 ? "99+" : String(count)}
    </NativeTabs.Trigger.Badge>
  );
}

function renderNativeTabTrigger(
  tab: RoleTabSpec,
  options: {
    showNativeVisualTabs: boolean;
    useVectorIcons: boolean;
    badgeCount: number;
  },
) {
  return (
    <NativeTabs.Trigger key={tab.key} name={tab.name}>
      <NativeTabs.Trigger.Label>
        {options.showNativeVisualTabs ? tab.label : " "}
      </NativeTabs.Trigger.Label>
      <NativeTabs.Trigger.Icon
        sf={{ default: tab.sfDefault, selected: tab.sfSelected } as never}
        src={
          options.useVectorIcons ? (
            <NativeTabs.Trigger.VectorIcon family={MaterialIcons} name={tab.iconName} />
          ) : undefined
        }
      />
      {options.showNativeVisualTabs ? <NativeTabBadge count={options.badgeCount} /> : null}
    </NativeTabs.Trigger>
  );
}

function warmRoleTabModules(role: "instructor" | "studio") {
  if (role === "instructor") {
    void import("@/components/jobs/instructor-feed");
    return;
  }

  void import("@/components/jobs/studio-feed");
}

export default function TabLayout() {
  const authActions = useAuthActions();
  const signOut = authActions?.signOut;
  const palette = useBrand();
  const { resolvedScheme } = useThemePreference();
  const pathname = usePathname();
  const { setTopInsetBackgroundColor } = useSystemUi();
  const { t } = useTranslation();
  const tabStatusInsetColor = resolveTabStatusInsetColor(pathname, palette, resolvedScheme);

  useEffect(() => {
    setTopInsetBackgroundColor(tabStatusInsetColor);
    return () => {
      setTopInsetBackgroundColor(null);
    };
  }, [setTopInsetBackgroundColor, tabStatusInsetColor]);

  const {
    currentUser,
    effectiveRole,
    isAuthLoading,
    isAuthenticated,
    isSyncing,
    syncError,
    hasAttemptedSync,
    retrySync,
  } = useUser();

  const resolvedRole = currentUser?.role ?? (isAuthenticated ? effectiveRole : null);
  const isInstructor = resolvedRole === "instructor";
  const isStudio = resolvedRole === "studio";
  const queryMinuteBucket = Math.floor(Date.now() / (60 * 1000));
  const badgeNow = queryMinuteBucket * 60 * 1000;
  const canQueryRoleCounts =
    !!currentUser &&
    isAuthenticated &&
    !isAuthLoading &&
    !isSyncing &&
    currentUser.role !== "pending";

  const instructorTabCounts = useQuery(
    api.jobs.getInstructorTabCounts,
    canQueryRoleCounts && currentUser.role === "instructor" ? { now: badgeNow } : "skip",
  );
  const studioTabCounts = useQuery(
    api.jobs.getStudioTabCounts,
    canQueryRoleCounts && currentUser.role === "studio" ? { now: badgeNow } : "skip",
  );
  const unreadNotificationCount = useQuery(
    api.inbox.getMyUnreadNotificationCount,
    canQueryRoleCounts ? {} : "skip",
  );

  const unreadNotificationsCount = unreadNotificationCount?.count ?? 0;
  const instructorJobsBadgeCount = instructorTabCounts?.jobsBadgeCount ?? 0;
  const instructorCalendarBadgeCount = instructorTabCounts?.calendarBadgeCount ?? 0;
  const studioJobsBadgeCount = studioTabCounts?.jobsBadgeCount ?? 0;
  const studioCalendarBadgeCount = studioTabCounts?.calendarBadgeCount ?? 0;
  const useVectorIcons = Platform.OS !== "web";
  const iosMinimizeProps =
    Platform.OS === "ios" && Number(Platform.Version) >= 26
      ? ({ minimizeBehavior: "onScrollDown" } as const)
      : {};

  useEffect(() => {
    if (!isInstructor && !isStudio) {
      return;
    }

    let cancelled = false;
    const warmInBackground = async () => {
      if (typeof globalThis.requestIdleCallback === "function") {
        await new Promise<void>((resolve) => {
          globalThis.requestIdleCallback(() => resolve(), { timeout: 1200 });
        });
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      if (cancelled) return;
      warmRoleTabModules(isInstructor ? "instructor" : "studio");
    };

    void warmInBackground();
    return () => {
      cancelled = true;
    };
  }, [isInstructor, isStudio]);

  if (isAuthLoading) {
    return <LoadingScreen label={t("tabsLayout.loading.loadingAccount")} />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser === undefined && !resolvedRole) {
    return <LoadingScreen label={t("tabsLayout.loading.loadingAccount")} />;
  }

  if (currentUser === null && !resolvedRole && hasAttemptedSync && !isSyncing) {
    return (
      <ShellErrorState
        title={t("tabsLayout.errors.accountSetupFailedTitle")}
        body={t("tabsLayout.errors.accountSetupFailedBody")}
        palette={palette}
      >
        {syncError ? (
          <ThemedText type="caption" selectable style={{ color: palette.danger }}>
            {syncError}
          </ThemedText>
        ) : null}
        <KitButton label={t("tabsLayout.actions.retrySync")} onPress={retrySync} />
        <KitButton
          label={t("tabsLayout.actions.signOut")}
          variant="secondary"
          onPress={() => {
            if (!signOut) return;
            void signOut();
          }}
        />
      </ShellErrorState>
    );
  }

  if (currentUser === null && !resolvedRole && isSyncing) {
    return <LoadingScreen label={t("tabsLayout.loading.loadingAccount")} />;
  }

  if (currentUser?.role === "pending") {
    return <Redirect href="/onboarding" />;
  }

  if (!isInstructor && !isStudio) {
    return <Redirect href="/onboarding" />;
  }

  const roleTabs: RoleTabSpec[] = isInstructor
    ? [
        {
          key: "instructor/index",
          name: "instructor/index",
          href: "/instructor",
          label: t("tabs.home"),
          iconName: "home",
          sfDefault: "house",
          sfSelected: "house.fill",
        },
        {
          key: "instructor/calendar/index",
          name: "instructor/calendar/index",
          href: "/instructor/calendar",
          label: t("tabs.calendar"),
          iconName: "calendar-month",
          sfDefault: "calendar",
          sfSelected: "calendar.circle.fill",
        },
        {
          key: "instructor/jobs/index",
          name: "instructor/jobs/index",
          href: "/instructor/jobs",
          label: t("tabs.jobs"),
          iconName: "work",
          sfDefault: "briefcase",
          sfSelected: "briefcase.fill",
        },
        {
          key: "instructor/profile",
          name: "instructor/profile",
          href: "/instructor/profile",
          label: t("tabs.profile"),
          iconName: "account-circle",
          sfDefault: "person.crop.circle",
          sfSelected: "person.crop.circle.fill",
        },
        {
          key: "instructor/map/index",
          name: "instructor/map/index",
          href: "/instructor/map",
          label: t("tabs.map"),
          iconName: "map",
          sfDefault: "map",
          sfSelected: "map.fill",
        },
      ]
    : [
        {
          key: "studio/index",
          name: "studio/index",
          href: "/studio",
          label: t("tabs.home"),
          iconName: "home",
          sfDefault: "house",
          sfSelected: "house.fill",
        },
        {
          key: "studio/calendar/index",
          name: "studio/calendar/index",
          href: "/studio/calendar",
          label: t("tabs.calendar"),
          iconName: "calendar-month",
          sfDefault: "calendar",
          sfSelected: "calendar.circle.fill",
        },
        {
          key: "studio/jobs/index",
          name: "studio/jobs/index",
          href: "/studio/jobs",
          label: t("tabs.jobs"),
          iconName: "work",
          sfDefault: "briefcase",
          sfSelected: "briefcase.fill",
        },
        {
          key: "studio/profile",
          name: "studio/profile",
          href: "/studio/profile",
          label: t("tabs.profile"),
          iconName: "account-circle",
          sfDefault: "person.crop.circle",
          sfSelected: "person.crop.circle.fill",
        },
      ];

  const badgeByTabKey: Record<string, number> = {
    "instructor/calendar/index": instructorCalendarBadgeCount,
    "instructor/jobs/index": instructorJobsBadgeCount,
    "instructor/profile": unreadNotificationsCount,
    "studio/calendar/index": studioCalendarBadgeCount,
    "studio/jobs/index": studioJobsBadgeCount,
    "studio/profile": unreadNotificationsCount,
  };

  return (
    <TabBarScrollProvider>
      <View style={{ flex: 1 }}>
        <NativeTabs
          {...(iosMinimizeProps as object)}
          tintColor={palette.primary}
          disableTransparentOnScrollEdge
        >
          {roleTabs.map((tab) =>
            renderNativeTabTrigger(tab, {
              showNativeVisualTabs: false,
              useVectorIcons,
              badgeCount: badgeByTabKey[tab.key] ?? 0,
            }),
          )}
        </NativeTabs>
      </View>
    </TabBarScrollProvider>
  );
}

function ShellErrorState({
  title,
  body,
  palette,
  children,
}: {
  title: string;
  body: string;
  palette: ReturnType<typeof useBrand>;
  children?: import("react").ReactNode;
}) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: BrandSpacing.lg,
        backgroundColor: palette.appBg,
      }}
    >
      <KitSurface tone="elevated" style={{ gap: BrandSpacing.md }}>
        <ThemedText type="heading">{title}</ThemedText>
        <ThemedText type="body" style={{ color: palette.textMuted }}>
          {body}
        </ThemedText>
        <View style={{ gap: BrandSpacing.sm }}>{children}</View>
      </KitSurface>
    </View>
  );
}
