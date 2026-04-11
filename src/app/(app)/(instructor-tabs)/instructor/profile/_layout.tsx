import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { TabSubrouteStack } from "@/components/layout/tab-subroute-stack";
import { ProfileSubpageSheetProvider } from "@/components/profile/profile-subpage-sheet";

/**
 * Profile section.
 * Sub-pages are now BottomSheets mounted at root level via SheetContext.
 * This layout just provides the ProfileSubpageSheetProvider for TopSheet headers.
 */
export default function ProfileLayout() {
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1 }}>
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
            routeMatchPath: "/profile/compliance",
            title: t("profile.navigation.compliance"),
          },
        ]}
      >
        <TabSubrouteStack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="add-account"
            options={{ title: t("profile.navigation.addAccount") }}
          />
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
          <Stack.Screen name="compliance" options={{ title: t("profile.navigation.compliance") }} />
        </TabSubrouteStack>
      </ProfileSubpageSheetProvider>
    </View>
  );
}
