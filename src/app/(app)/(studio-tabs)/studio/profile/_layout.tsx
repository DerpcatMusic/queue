import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ProfileSubpageSheetHost,
  ProfileSubpageSheetProvider,
} from "@/components/profile/profile-subpage-sheet";

/**
 * Profile section uses a nested Stack navigator so sub-screens
 * (sports, location, calendar settings) push on top of the main
 * profile settings list while the tab bar remains visible.
 */
export default function ProfileLayout() {
  const { t } = useTranslation();

  return (
    <ProfileSubpageSheetProvider>
      <ProfileSubpageSheetHost
        ownerId="profile-layout:studio"
        routes={[
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
      />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
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
