import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { View } from "react-native";
import { TabSubrouteStack } from "@/components/layout/tab-subroute-stack";
import { ProfileSubpageSheetProvider } from "@/components/profile/profile-subpage-sheet";
import { useSystemUi } from "@/contexts/system-ui-context";

/**
 * Profile section for Studio.
 * Sub-pages are now BottomSheets mounted at root level via SheetContext.
 * This layout just provides the ProfileSubpageSheetProvider for TopSheet headers.
 */
export default function ProfileLayout() {
  const { t } = useTranslation();
  const { setTopInsetBackgroundColor, setTopInsetTone, setTopInsetVisible } = useSystemUi();

  useEffect(() => {
    setTopInsetVisible(false);
    setTopInsetBackgroundColor("transparent");
    setTopInsetTone("app");

    return () => {
      setTopInsetVisible(true);
      setTopInsetBackgroundColor(null);
      setTopInsetTone("app");
    };
  }, [setTopInsetBackgroundColor, setTopInsetTone, setTopInsetVisible]);

  return (
    <View style={{ flex: 1 }}>
      <ProfileSubpageSheetProvider
        routes={[
          {
            routeMatchPath: "/profile/add-account",
            title: t("profile.navigation.addAccount"),
          },
          {
            routeMatchPath: "/profile/branches",
            title: t("profile.navigation.branches"),
          },
          {
            routeMatchPath: "/profile/notifications",
            title: t("profile.navigation.notifications"),
          },
          {
            routeMatchPath: "/profile/calendar-settings",
            title: t("profile.navigation.calendar"),
          },
          {
            routeMatchPath: "/profile/compliance",
            title: t("profile.navigation.studioCompliance"),
          },
          {
            routeMatchPath: "/profile/edit",
            title: t("profile.navigation.edit"),
          },
          {
            routeMatchPath: "/profile/payments",
            title: t("profile.navigation.studioChargeActivity"),
          },
        ]}
      >
        <TabSubrouteStack initialRouteName="index">
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="branches" options={{ title: t("profile.navigation.branches") }} />
          <Stack.Screen
            name="add-account"
            options={{ title: t("profile.navigation.addAccount") }}
          />
          <Stack.Screen
            name="notifications"
            options={{ title: t("profile.navigation.notifications") }}
          />
          <Stack.Screen
            name="calendar-settings"
            options={{ title: t("profile.navigation.calendar") }}
          />
          <Stack.Screen
            name="compliance"
            options={{ title: t("profile.navigation.studioCompliance") }}
          />
          <Stack.Screen
            name="edit"
            options={{
              title: t("profile.navigation.edit"),
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="payments"
            options={{ title: t("profile.navigation.studioChargeActivity") }}
          />
        </TabSubrouteStack>
      </ProfileSubpageSheetProvider>
    </View>
  );
}
