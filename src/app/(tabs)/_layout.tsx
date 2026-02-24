import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { View } from "react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { KitButton, KitSurface } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import { useThemePreference } from "@/hooks/use-theme-preference";

type KnownRole = "pending" | "instructor" | "studio" | "admin";

const ROLE_CACHE_KEY = "queue.lastKnownRole";

function isKnownRole(value: string): value is KnownRole {
  return value === "pending" || value === "instructor" || value === "studio" || value === "admin";
}

export default function TabLayout() {
  const { signOut } = useAuthActions();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(api.users.getCurrentUser);
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

  if (isConvexAuthLoading && currentUser === undefined && !cachedRole) {
    return <LoadingScreen label={t("tabsLayout.loading.negotiatingSession")} />;
  }

  if (!isConvexAuthLoading && !isAuthenticated) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser === undefined && !cachedRole) {
    return <LoadingScreen label={t("tabsLayout.loading.loadingAccount")} />;
  }

  if (currentUser === null && (isSyncingUser || !hasAttemptedSync) && !cachedRole) {
    return <LoadingScreen label={t("tabsLayout.loading.loadingAccount")} />;
  }

  if (
    currentUser === null &&
    hasAttemptedSync &&
    !isSyncingUser &&
    !cachedRole
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

      <NativeTabs.Trigger name="profile">
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

