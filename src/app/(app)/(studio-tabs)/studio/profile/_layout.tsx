import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { ProfileSubpageSheetProvider } from "@/components/profile/profile-subpage-sheet";

/**
 * Profile section uses a nested Stack navigator so sub-screens
 * (sports, location, calendar settings) push on top of the main
 * profile settings list while the tab bar remains visible.
 */
export default function ProfileLayout() {
  const { t } = useTranslation();

  return (
    <ProfileSubpageSheetProvider
      ownerId="profile-layout:studio"
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
          routeMatchPath: "/profile/calendar-settings",
          title: t("profile.navigation.calendar"),
        },
        {
          routeMatchPath: "/profile/edit",
          title: t("profile.navigation.edit"),
        },
        {
          routeMatchPath: "/profile/payments",
          title: t("profile.navigation.paymentsPayouts"),
        },
      ]}
    >
      <Stack
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="branches"
          options={{ title: t("profile.navigation.branches") }}
        />
        <Stack.Screen
          name="add-account"
          options={{ title: t("profile.navigation.addAccount") }}
        />
        <Stack.Screen
          name="calendar-settings"
          options={{ title: t("profile.navigation.calendar") }}
        />
        <Stack.Screen
          name="edit"
          options={{ title: t("profile.navigation.edit"), presentation: "modal" }}
        />
        <Stack.Screen
          name="payments"
          options={{ title: t("profile.navigation.paymentsPayouts") }}
        />
      </Stack>
    </ProfileSubpageSheetProvider>
  );
}
