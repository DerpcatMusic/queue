import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { TabSubrouteStack } from "@/components/layout/tab-subroute-stack";
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
          routeMatchPath: "/profile/notifications",
          title: t("profile.navigation.notifications"),
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
        {
          routeMatchPath: "/profile/airwallex-onboarding",
          title: t("profile.navigation.wallet"),
        },
      ]}
    >
      <TabSubrouteStack>
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
          name="notifications"
          options={{ title: t("profile.navigation.notifications") }}
        />
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
        <Stack.Screen
          name="airwallex-onboarding"
          options={{ title: t("profile.navigation.wallet") }}
        />
      </TabSubrouteStack>
    </ProfileSubpageSheetProvider>
  );
}
