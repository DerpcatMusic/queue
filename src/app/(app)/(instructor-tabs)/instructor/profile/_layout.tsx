import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useBrand } from "@/hooks/use-brand";

/**
 * Profile section uses a nested Stack navigator so sub-screens
 * (sports, location, calendar settings) push on top of the main
 * profile settings list while the tab bar remains visible.
 */
export default function ProfileLayout() {
  const { t } = useTranslation();
  const palette = useBrand();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: palette.text as string,
        headerTitleStyle: { color: palette.text as string },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="edit"
        options={{ title: t("profile.navigation.edit"), presentation: "modal" }}
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
    </Stack>
  );
}
