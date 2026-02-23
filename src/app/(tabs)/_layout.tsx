import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { InteractionManager, View } from "react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { KitButton, KitSurface } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { recordPerfMetric } from "@/lib/perf-telemetry";

type KnownRole = "pending" | "instructor" | "studio" | "admin";

const ROLE_CACHE_KEY = "queue.lastKnownRole";

function isKnownRole(value: string): value is KnownRole {
  return value === "pending" || value === "instructor" || value === "studio" || value === "admin";
}

export default function TabLayout() {
  const { signOut } = useAuthActions();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );
  const syncCurrentUser = useMutation(api.users.syncCurrentUser);
  const [cachedRole, setCachedRole] = useState<KnownRole | null>(null);
  const [hasAttemptedSync, setHasAttemptedSync] = useState(false);
  const [isSyncingUser, setIsSyncingUser] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const palette = useBrand();
  const { resolvedScheme } = useThemePreference();
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    const loadCachedRole = async () => {
      try {
        const storedRole = await AsyncStorage.getItem(ROLE_CACHE_KEY);
        if (cancelled || !storedRole || !isKnownRole(storedRole)) return;
        setCachedRole(storedRole);
      } catch {
        // Ignore role cache read failures.
      }
    };

    void loadCachedRole();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const role = currentUser?.role;
    if (!role || !isKnownRole(role)) return;

    setCachedRole(role);
    void AsyncStorage.setItem(ROLE_CACHE_KEY, role).catch(() => {
      // Ignore role cache write failures.
    });
  }, [currentUser?.role]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      currentUser !== null ||
      isSyncingUser ||
      hasAttemptedSync
    ) {
      return;
    }

    setIsSyncingUser(true);
    setSyncError(null);
    void syncCurrentUser({})
      .then(() => setHasAttemptedSync(true))
      .catch((error) => {
        const message =
          error instanceof Error && error.message
            ? error.message
            : t("tabsLayout.errors.syncFailedFallback");
        setSyncError(message);
        setHasAttemptedSync(true);
      })
      .finally(() => setIsSyncingUser(false));
  }, [
    currentUser,
    hasAttemptedSync,
    isAuthenticated,
    isSyncingUser,
    syncCurrentUser,
    t,
  ]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const prewarmTasks: {
      key: string;
      delayAfterMs: number;
      load: () => Promise<unknown>;
    }[] = [
      { key: "tab.index", delayAfterMs: 350, load: () => import("./index") },
      { key: "tab.calendar", delayAfterMs: 450, load: () => import("./calendar/index") },
      { key: "tab.jobs", delayAfterMs: 450, load: () => import("./jobs/index") },
      { key: "tab.map", delayAfterMs: 650, load: () => import("./map") },
      { key: "tab.profile", delayAfterMs: 800, load: () => import("./profile/index") },
      {
        key: "screen.calendar",
        delayAfterMs: 900,
        load: () => import("@/components/calendar/calendar-tab-screen"),
      },
      {
        key: "screen.jobs.instructor",
        delayAfterMs: 1000,
        load: () => import("@/components/jobs/instructor-feed"),
      },
      {
        key: "screen.jobs.studio",
        delayAfterMs: 1200,
        load: () => import("@/components/jobs/studio-feed"),
      },
      {
        key: "screen.map",
        delayAfterMs: 0,
        load: () => import("@/components/map-tab/map-tab-screen"),
      },
    ];
    const queuePrewarm = (index: number, delayMs: number) => {
      if (cancelled || index >= prewarmTasks.length) return;
      const nextTask = prewarmTasks[index];
      if (!nextTask) return;

      const timer = setTimeout(() => {
        if (cancelled) return;
        const startedAt = performance.now();
        void nextTask
          .load()
          .then(() => {
            recordPerfMetric("tabs.prewarm_module", performance.now() - startedAt, {
              module: nextTask.key,
            });
          })
          .catch(() => {
            // Best-effort warmup only.
          })
          .finally(() => {
            queuePrewarm(index + 1, nextTask.delayAfterMs);
          });
      }, delayMs);

      timers.push(timer);
    };

    const task = InteractionManager.runAfterInteractions(() => {
      queuePrewarm(0, 850);
    });

    return () => {
      cancelled = true;
      task.cancel();
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [isAuthenticated]);

  if (isConvexAuthLoading) {
    return <LoadingScreen label={t("tabsLayout.loading.negotiatingSession")} />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser === null && (isSyncingUser || !hasAttemptedSync)) {
    return <LoadingScreen label={t("tabsLayout.loading.loadingAccount")} />;
  }

  if (
    currentUser === null &&
    hasAttemptedSync &&
    !isSyncingUser
  ) {
    return (
      <ShellErrorState
        title={t("tabsLayout.errors.accountSetupFailedTitle")}
        body={t("tabsLayout.errors.accountSetupFailedBody")}
        palette={palette}
      >
        {syncError ? (
          <ThemedText
            type="caption"
            selectable
            style={{ color: palette.danger }}
          >
            {syncError}
          </ThemedText>
        ) : null}
        <KitButton
          label={t("tabsLayout.actions.retrySync")}
          onPress={() => {
            setHasAttemptedSync(false);
            setSyncError(null);
          }}
        />
        <KitButton
          label={t("tabsLayout.actions.signOut")}
          variant="secondary"
          onPress={() => void signOut()}
        />
      </ShellErrorState>
    );
  }

  if (currentUser?.role === "pending") {
    return <Redirect href="/onboarding" />;
  }

  const effectiveRole = currentUser?.role ?? cachedRole;
  const showJobsTab =
    effectiveRole === "instructor" || effectiveRole === "studio";

  return (
    <NativeTabs
      key={resolvedScheme}
      tintColor={palette.text}
      minimizeBehavior="onScrollDown"
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="home" />}
        />
        <NativeTabs.Trigger.Label>{t("tabs.home")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="calendar/index">
        <NativeTabs.Trigger.Icon
          sf={{ default: "calendar", selected: "calendar.circle.fill" }}
          src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="calendar-month" />}
        />
        <NativeTabs.Trigger.Label>{t("tabs.calendar")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="jobs/index" hidden={!showJobsTab}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "briefcase", selected: "briefcase.fill" }}
          src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="work" />}
        />
        <NativeTabs.Trigger.Label>{t("tabs.jobs")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="map" hidden={effectiveRole !== "instructor"}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "map", selected: "map.fill" }}
          src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="map" />}
        />
        <NativeTabs.Trigger.Label>{t("tabs.map")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile/index">
        <NativeTabs.Trigger.Icon
          sf={{
            default: "person.crop.circle",
            selected: "person.crop.circle.fill",
          }}
          src={
            <NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="account-circle" />
          }
        />
        <NativeTabs.Trigger.Label>{t("tabs.profile")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
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

