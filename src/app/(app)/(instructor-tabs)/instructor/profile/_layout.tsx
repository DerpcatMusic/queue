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
      ownerId="profile-layout:instructor"
      routes={[
        {
          routeMatchPath: "/profile/add-account",
          title: t("profile.navigation.addAccount"),
        },
        {
          routeMatchPath: "/profile/edit",
          title: t("profile.navigation.edit"),
        },
        {
          routeMatchPath: "/profile/sports",
          title: t("profile.navigation.sports"),
        },
        {
          routeMatchPath: "/profile/location",
          title: t("profile.navigation.location"),
        },
        {
          routeMatchPath: "/profile/calendar-settings",
          title: t("profile.navigation.calendar"),
        },
        {
          routeMatchPath: "/profile/payments",
          title: t("profile.navigation.wallet"),
        },
        {
          routeMatchPath: "/profile/identity-verification",
          title: t("profile.navigation.identityVerification"),
        },
        {
          routeMatchPath: "/profile/compliance",
          title: t("profile.navigation.compliance"),
        },
      ]}
    >
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="add-account" options={{ title: t("profile.navigation.addAccount") }} />
        <Stack.Screen
          name="edit"
          options={{
            title: t("profile.navigation.edit"),
            presentation: "modal",
          }}
        />
        <Stack.Screen name="sports" options={{ title: t("profile.navigation.sports") }} />
        <Stack.Screen name="location" options={{ title: t("profile.navigation.location") }} />
        <Stack.Screen
          name="calendar-settings"
          options={{ title: t("profile.navigation.calendar") }}
        />
        <Stack.Screen name="payments" options={{ title: t("profile.navigation.wallet") }} />
        <Stack.Screen
          name="identity-verification"
          options={{ title: t("profile.navigation.identityVerification") }}
        />
        <Stack.Screen name="compliance" options={{ title: t("profile.navigation.compliance") }} />
      </Stack>
    </ProfileSubpageSheetProvider>
  );
}
