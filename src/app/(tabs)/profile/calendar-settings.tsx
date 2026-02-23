import { api } from "@/convex/_generated/api";
import {
  KitButton,
  KitHeader,
  KitList,
  KitListItem,
  KitSegmentedToggle,
  KitSwitchRow,
} from "@/components/ui/kit";
import { LoadingScreen } from "@/components/loading-screen";
import { BrandSpacing } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";

const CALENDAR_PROVIDER_KEYS = {
  none: "profile.settings.calendar.provider.none",
  google: "profile.settings.calendar.provider.google",
  apple: "profile.settings.calendar.provider.apple",
} as const;

type CalendarProvider = keyof typeof CALENDAR_PROVIDER_KEYS;

export default function CalendarSettingsScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const router = useRouter();

  const instructorSettings = useQuery(api.users.getMyInstructorSettings);
  const saveSettings = useMutation(api.users.updateMyInstructorSettings);

  const [provider, setProvider] = useState<CalendarProvider>("none");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (instructorSettings && !seeded) {
      setProvider((instructorSettings.calendarProvider as CalendarProvider) ?? "none");
      setSyncEnabled(instructorSettings.calendarSyncEnabled ?? false);
      setSeeded(true);
    }
  }, [instructorSettings, seeded]);

  if (instructorSettings === undefined) {
    return <LoadingScreen label={t("profile.settings.loading")} />;
  }
  if (instructorSettings === null) {
    return <LoadingScreen label={t("profile.settings.unavailable")} />;
  }

  const hasChanges =
    provider !== (instructorSettings.calendarProvider ?? "none") ||
    syncEnabled !== (instructorSettings.calendarSyncEnabled ?? false);

  const onSave = async () => {
    setIsSaving(true);
    try {
      await saveSettings({
        notificationsEnabled: instructorSettings.notificationsEnabled,
        sports: instructorSettings.sports,
        calendarProvider: provider,
        calendarSyncEnabled: syncEnabled,
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
    } catch {
      // silently handled
    } finally {
      setIsSaving(false);
    }
  };

  const connectedDate = instructorSettings.calendarConnectedAt
    ? new Date(instructorSettings.calendarConnectedAt).toLocaleDateString(
        i18n.resolvedLanguage ?? "en",
        { month: "short", day: "numeric", year: "numeric" },
      )
    : null;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.appBg }]}
      contentInsetAdjustmentBehavior="automatic"
    >
      <KitHeader
        title={t("profile.settings.calendar.title")}
        subtitle={t("profile.settings.calendar.description")}
        compact
      />

      <KitList inset>
        <KitListItem title={t("profile.settings.calendar.provider.none")}>
          <View style={{ marginTop: 8 }}>
            <KitSegmentedToggle<CalendarProvider>
              value={provider}
              onChange={(next) => {
                setProvider(next);
                if (next === "none") setSyncEnabled(false);
              }}
              options={(Object.keys(CALENDAR_PROVIDER_KEYS) as CalendarProvider[]).map((key) => ({
                value: key,
                label: t(CALENDAR_PROVIDER_KEYS[key]),
              }))}
            />
          </View>
        </KitListItem>
      </KitList>

      <View style={{ paddingTop: 8 }}>
        <KitList inset>
          <KitSwitchRow
            title={t("profile.settings.calendar.autoSync")}
            value={syncEnabled}
            disabled={provider === "none"}
            onValueChange={setSyncEnabled}
            description={t("profile.settings.calendar.futureNote")}
          />
          {connectedDate ? (
            <KitListItem
              title={t("profile.settings.calendar.lastConnected", {
                date: connectedDate,
              })}
            />
          ) : null}
        </KitList>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: BrandSpacing.md, gap: 10 }}>
        <KitButton
          label={
            isSaving
              ? t("profile.settings.actions.saving")
              : t("profile.settings.actions.save")
          }
          onPress={() => {
            void onSave();
          }}
          disabled={isSaving || !hasChanges}
        />
        <KitButton
          label={t("common.cancel")}
          variant="secondary"
          onPress={() => router.back()}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});


