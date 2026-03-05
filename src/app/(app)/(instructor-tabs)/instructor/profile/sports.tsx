import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import { SportsMultiSelect } from "@/components/profile/sports-multi-select";
import { ThemedText } from "@/components/themed-text";
import { KitButton } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useBrand } from "@/hooks/use-brand";
import { useNativeTabLayout } from "@/hooks/use-native-tab-layout";

export default function SportsScreen() {
  const { t } = useTranslation();
  const palette = useBrand();
  const router = useRouter();
  const { safeBottomInset } = useNativeTabLayout();
  const { currentUser } = useUser();

  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const saveSettings = useMutation(api.users.updateMyInstructorSettings);

  const [draft, setDraft] = useState<string[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (instructorSettings === undefined) {
    return <LoadingScreen label={t("profile.settings.loading")} />;
  }
  if (instructorSettings === null) {
    return <LoadingScreen label={t("profile.settings.unavailable")} />;
  }

  const serverSports = instructorSettings.sports;
  const sports = draft ?? serverSports;

  const toggleSport = (sport: string) => {
    if (process.env.EXPO_OS === "ios") {
      void Haptics.selectionAsync();
    }
    setDraft((prev) => {
      const current = prev ?? serverSports;
      if (current.includes(sport)) {
        return current.filter((s: string) => s !== sport);
      }
      return [...current, sport];
    });
  };

  const hasChanges = (() => {
    if (draft === null) return false;
    const sorted = [...draft].sort();
    const serverSorted = [...serverSports].sort();
    return JSON.stringify(sorted) !== JSON.stringify(serverSorted);
  })();

  const onSave = async () => {
    if (!hasChanges || !draft) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await saveSettings({
        notificationsEnabled: instructorSettings.notificationsEnabled,
        sports: draft,
        calendarProvider: instructorSettings.calendarProvider,
        calendarSyncEnabled: instructorSettings.calendarSyncEnabled,
        ...(instructorSettings.hourlyRateExpectation !== undefined
          ? { hourlyRateExpectation: instructorSettings.hourlyRateExpectation }
          : {}),
        ...(instructorSettings.address !== undefined
          ? { address: instructorSettings.address }
          : {}),
        ...(instructorSettings.latitude !== undefined
          ? { latitude: instructorSettings.latitude }
          : {}),
        ...(instructorSettings.longitude !== undefined
          ? { longitude: instructorSettings.longitude }
          : {}),
      });
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("profile.settings.errors.saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.appBg }]}>
      <TabScreenScrollView
        routeKey="instructor/profile"
        contentContainerStyle={{ padding: 16, paddingBottom: hasChanges ? 120 : 100, gap: 12 }}
      >
        <ThemedText type="caption" style={{ color: palette.textMuted }}>
          {sports.length > 0
            ? t("profile.settings.sports.selected", { count: sports.length })
            : t("profile.settings.sports.none")}
        </ThemedText>
        <SportsMultiSelect
          palette={palette}
          selectedSports={sports}
          onToggleSport={toggleSport}
          searchPlaceholder={t("mapTab.searchPlaceholder")}
          title={t("profile.settings.sports.title")}
          emptyHint={t("profile.settings.sports.none")}
        />
        {errorMessage ? (
          <ThemedText selectable style={{ color: palette.danger }}>
            {errorMessage}
          </ThemedText>
        ) : null}
        <View style={{ height: BrandSpacing.md }} />
      </TabScreenScrollView>

      {/* Save FAB */}
      {hasChanges ? (
        <View style={[styles.saveFabArea, { bottom: Math.max(safeBottomInset, 16) }]}>
          <KitButton
            label={
              isSaving ? t("profile.settings.actions.saving") : t("profile.settings.actions.save")
            }
            onPress={() => {
              void onSave();
            }}
            disabled={isSaving}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  saveFabArea: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 20,
  },
});
