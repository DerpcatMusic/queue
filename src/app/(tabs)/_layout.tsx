import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { Redirect, usePathname, useRouter } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform, View } from "react-native";

import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { AndroidFloatingTabBar, type FloatingTabSpec } from "@/components/layout/android-floating-tab-bar";
import { KitButton, KitSurface } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { FEATURE_FLAGS } from "@/constants/feature-flags";
import { TabBarScrollProvider } from "@/contexts/tab-bar-scroll-context";
import { useBrand } from "@/hooks/use-brand";
import { useTranslation } from "react-i18next";

type RoleTabSpec = FloatingTabSpec & {
  name: string;
  href: string;
  sfDefault: string;
  sfSelected: string;
};

function NativeTabBadge({ count }: { count: number }) {
  return (
    <NativeTabs.Trigger.Badge hidden={count <= 0}>
      {count > 99 ? "99+" : String(count)}
    </NativeTabs.Trigger.Badge>
  );
}

function resolveActiveTabKey(tabs: RoleTabSpec[], pathname: string): string {
  const normalized = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const found = [...tabs]
    .sort((a, b) => b.href.length - a.href.length)
    .find((tab) => normalized.startsWith(tab.href));
  return found?.key ?? tabs[0]?.key ?? "";
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
      {options.showNativeVisualTabs ? (
        <NativeTabs.Trigger.Icon
          sf={{ default: tab.sfDefault, selected: tab.sfSelected } as never}
          src={
            options.useVectorIcons
              ? <NativeTabs.Trigger.VectorIcon family={MaterialIcons} name={tab.iconName} />
              : undefined
          }
        />
      ) : null}
      {options.showNativeVisualTabs ? <NativeTabBadge count={options.badgeCount} /> : null}
    </NativeTabs.Trigger>
  );
}

export default function TabLayout() {
  const { signOut } = useAuthActions();
  const palette = useBrand();
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();

  const {
    currentUser,
    isAuthLoading,
    isAuthenticated,
    isSyncing,
    syncError,
    hasAttemptedSync,
    retrySync,
  } = useUser();

  const isInstructor = currentUser?.role === "instructor";
  const isStudio = currentUser?.role === "studio";
  const queryMinuteBucket = Math.floor(Date.now() / (60 * 1000));
  const badgeNow = queryMinuteBucket * 60 * 1000;

  const instructorTabCounts = useQuery(
    api.jobs.getInstructorTabCounts,
    isInstructor ? { now: badgeNow } : "skip",
  );
  const studioTabCounts = useQuery(
    api.jobs.getStudioTabCounts,
    isStudio ? { now: badgeNow } : "skip",
  );
  const unreadNotificationCount = useQuery(
    api.inbox.getMyUnreadNotificationCount,
    currentUser ? {} : "skip",
  );

  const unreadNotificationsCount = unreadNotificationCount?.count ?? 0;
  const instructorJobsBadgeCount = instructorTabCounts?.jobsBadgeCount ?? 0;
  const instructorCalendarBadgeCount = instructorTabCounts?.calendarBadgeCount ?? 0;
  const studioJobsBadgeCount = studioTabCounts?.jobsBadgeCount ?? 0;
  const studioCalendarBadgeCount = studioTabCounts?.calendarBadgeCount ?? 0;
  const useVectorIcons = Platform.OS !== "web";
  const isAndroidFloatingTabs = Platform.OS === "android" && FEATURE_FLAGS.androidFloatingTabsEnabled;
  const showNativeVisualTabs = !isAndroidFloatingTabs;
  const iosMinimizeProps = Platform.OS === "ios" && Number(Platform.Version) >= 26
    ? ({ minimizeBehavior: "onScrollDown" } as const)
    : {};

  if (isAuthLoading && currentUser === undefined) {
    return <LoadingScreen label={t("tabsLayout.loading.negotiatingSession")} />;
  }

  if (!isAuthLoading && !isAuthenticated) {
    return <Redirect href="/sign-in" />;
  }

  if (isAuthenticated && currentUser === undefined) {
    return <LoadingScreen label={t("tabsLayout.loading.loadingAccount")} />;
  }

  if (currentUser === null && hasAttemptedSync && !isSyncing) {
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
          onPress={() => void signOut()}
        />
      </ShellErrorState>
    );
  }

  if (currentUser === null && isSyncing) {
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

  const activeKey = resolveActiveTabKey(roleTabs, pathname);

  return (
    <TabBarScrollProvider>
      <View style={{ flex: 1 }}>
        <NativeTabs
          {...(iosMinimizeProps as object)}
          tintColor={palette.text}
          disableTransparentOnScrollEdge
        >
          {roleTabs.map((tab) =>
            renderNativeTabTrigger(tab, {
              showNativeVisualTabs,
              useVectorIcons,
              badgeCount: badgeByTabKey[tab.key] ?? 0,
            }),
          )}
        </NativeTabs>

        {isAndroidFloatingTabs ? (
          <AndroidFloatingTabBar
            tabs={roleTabs.map((tab) => ({
              key: tab.key,
              label: tab.label,
              iconName: tab.iconName,
              badgeCount: badgeByTabKey[tab.key] ?? 0,
            }))}
            activeKey={activeKey}
            onSelect={(key) => {
              const tab = roleTabs.find((row) => row.key === key);
              if (!tab) return;
              router.navigate(tab.href as never);
            }}
          />
        ) : null}
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
