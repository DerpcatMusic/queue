import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import {
  Icon,
  Label,
  NativeTabs,
  VectorIcon,
} from "expo-router/unstable-native-tabs";
import { useEffect, useState } from "react";
import { Pressable, Platform, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { Brand, BrandRadius, BrandShadow } from "@/constants/brand";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const { signOut } = useAuthActions();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );
  const syncCurrentUser = useMutation(api.users.syncCurrentUser);
  const [userQueryTimedOut, setUserQueryTimedOut] = useState(false);
  const [hasAttemptedSync, setHasAttemptedSync] = useState(false);
  const [isSyncingUser, setIsSyncingUser] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const colorScheme = useColorScheme() ?? "light";
  const palette = Brand[colorScheme];
  const { t } = useTranslation();

  const reloadWebApp = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.reload();
    }
  };

  useEffect(() => {
    if (!isAuthenticated || currentUser !== undefined) {
      setUserQueryTimedOut(false);
      return;
    }

    const timer = setTimeout(() => {
      setUserQueryTimedOut(true);
    }, 12000);

    return () => {
      clearTimeout(timer);
    };
  }, [currentUser, isAuthenticated]);

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
      .then(() => {
        setHasAttemptedSync(true);
      })
      .catch((error) => {
        const message =
          error instanceof Error && error.message
            ? error.message
            : t("tabsLayout.errors.syncFailedFallback");
        setSyncError(message);
        setHasAttemptedSync(true);
      })
      .finally(() => {
        setIsSyncingUser(false);
      });
  }, [
    currentUser,
    hasAttemptedSync,
    isAuthenticated,
    isSyncingUser,
    syncCurrentUser,
    t,
  ]);

  if (isConvexAuthLoading) {
    return <LoadingScreen label={t("tabsLayout.loading.negotiatingSession")} />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/sign-in" />;
  }

  if ((currentUser === undefined && !userQueryTimedOut) || isSyncingUser) {
    return <LoadingScreen label={t("tabsLayout.loading.loadingAccount")} />;
  }

  if (currentUser === undefined && userQueryTimedOut) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: palette.appBg }]}>
        <ThemedText type="title">
          {t("tabsLayout.errors.accountQueryTimeoutTitle")}
        </ThemedText>
        <ThemedText>
          {t("tabsLayout.errors.accountQueryTimeoutBody")}
        </ThemedText>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: palette.primary, borderColor: palette.primaryPressed }]}
          onPress={reloadWebApp}
        >
          <ThemedText
            type="defaultSemiBold"
            style={{ color: palette.onPrimary }}
          >
            {t("tabsLayout.actions.reload")}
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  if (currentUser === null) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: palette.appBg }]}>
        <ThemedText type="title">
          {t("tabsLayout.errors.accountSetupFailedTitle")}
        </ThemedText>
        <ThemedText>{t("tabsLayout.errors.accountSetupFailedBody")}</ThemedText>
        {syncError ? (
          <ThemedText style={{ color: palette.danger }}>{syncError}</ThemedText>
        ) : null}
        <Pressable
          style={[styles.primaryButton, { backgroundColor: palette.primary, borderColor: palette.primaryPressed }]}
          onPress={() => {
            setHasAttemptedSync(false);
            setSyncError(null);
          }}
        >
          <ThemedText
            type="defaultSemiBold"
            style={{ color: palette.onPrimary }}
          >
            {t("tabsLayout.actions.retrySync")}
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, { borderColor: palette.borderStrong, backgroundColor: palette.surfaceElevated }]}
          onPress={() => {
            void signOut();
          }}
        >
          <ThemedText type="defaultSemiBold">
            {t("tabsLayout.actions.signOut")}
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  if (!currentUser) {
    return <LoadingScreen label={t("tabsLayout.loading.loadingAccount")} />;
  }

  if (currentUser.role === "pending") {
    return <Redirect href="/onboarding" />;
  }

  const showJobsTab =
    currentUser.role === "instructor" || currentUser.role === "studio";

  return (
    <NativeTabs
      backgroundColor={palette.tabBar}
      disableTransparentOnScrollEdge
      iconColor={{ default: palette.textMuted, selected: palette.primary }}
      labelStyle={{
        default: { color: palette.textMuted, fontSize: 12, fontWeight: "600" },
        selected: { color: palette.primary, fontSize: 12, fontWeight: "700" },
      }}
      shadowColor={palette.tabBarBorder}
    >
      <NativeTabs.Trigger name="index">
        <Icon
          sf={{ default: "house", selected: "house.fill" }}
          androidSrc={<VectorIcon family={MaterialIcons} name="home" />}
        />
        <Label>{t("tabs.home")}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="calendar">
        <Icon
          sf={{ default: "calendar", selected: "calendar" }}
          androidSrc={<VectorIcon family={MaterialIcons} name="calendar-month" />}
        />
        <Label>{t("tabs.calendar")}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="jobs" hidden={!showJobsTab}>
        <Icon
          sf={{ default: "briefcase", selected: "briefcase.fill" }}
          androidSrc={<VectorIcon family={MaterialIcons} name="work" />}
        />
        <Label>{t("tabs.jobs")}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="map" hidden={currentUser.role !== "instructor"}>
        <Icon
          sf={{ default: "map", selected: "map.fill" }}
          androidSrc={<VectorIcon family={MaterialIcons} name="map" />}
        />
        <Label>{t("tabs.map")}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Icon
          sf={{
            default: "person.crop.circle",
            selected: "person.crop.circle.fill",
          }}
          androidSrc={
            <VectorIcon family={MaterialIcons} name="account-circle" />
          }
        />
        <Label>{t("tabs.profile")}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: BrandRadius.button,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: BrandShadow.soft,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: BrandRadius.button,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
