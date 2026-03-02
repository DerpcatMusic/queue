import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Platform, StyleSheet, View } from "react-native";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitButton, KitListItem } from "@/components/ui/kit";
import { NativeSearchField } from "@/components/ui/native-search-field";
import { BrandSpacing } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { SPORT_TYPES, toSportLabel } from "@/convex/constants";
import { useBrand } from "@/hooks/use-brand";
import { useNativeTabLayout } from "@/hooks/use-native-tab-layout";

export default function SportsScreen() {
  const { t } = useTranslation();
  const palette = useBrand();
  const router = useRouter();
  const navigation = useNavigation();
  const { safeBottomInset } = useNativeTabLayout();
  const { currentUser } = useUser();

  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const saveSettings = useMutation(api.users.updateMyInstructorSettings);

  const [draft, setDraft] = useState<string[] | null>(null);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isHeaderSearchSupported = Platform.OS === "ios";

  const headerSearchOptions = useMemo(
    () => ({
      placeholder: t("mapTab.searchPlaceholder"),
      hideWhenScrolling: false,
      autoCapitalize: "none" as const,
      onChangeText: (event: { nativeEvent: { text: string } }) => {
        setSearch(event.nativeEvent.text ?? "");
      },
      onCancelButtonPress: () => {
        setSearch("");
      },
    }),
    [t],
  );

  useEffect(() => {
    if (!isHeaderSearchSupported) {
      return;
    }
    navigation.setOptions({
      headerSearchBarOptions: headerSearchOptions,
    });
  }, [headerSearchOptions, isHeaderSearchSupported, navigation]);

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
    } catch {
      // handled silently
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = SPORT_TYPES.filter((sport) =>
    toSportLabel(sport).toLowerCase().includes(search.toLowerCase().trim()),
  );

  return (
    <View style={[styles.screen, { backgroundColor: palette.appBg }]}>
      <FlatList
        data={filtered}
        keyExtractor={(sport) => sport}
        contentContainerStyle={{ paddingBottom: hasChanges ? 120 : 100 }}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        renderItem={({ item: sport }) => {
          const selected = sports.includes(sport);
          return (
            <KitListItem
              title={toSportLabel(sport)}
              onPress={() => toggleSport(sport)}
              accessory={
                selected ? (
                  <IconSymbol name="checkmark.circle.fill" size={22} color={palette.primary} />
                ) : (
                  <IconSymbol name="circle" size={22} color={palette.borderStrong} />
                )
              }
            />
          );
        }}
        ListHeaderComponent={
          <View style={{ paddingTop: 16, gap: BrandSpacing.sm }}>
            <View style={styles.countRow}>
              <ThemedText type="caption" style={{ color: palette.textMuted }}>
                {sports.length > 0
                  ? t("profile.settings.sports.selected", { count: sports.length })
                  : t("profile.settings.sports.none")}
              </ThemedText>
            </View>
            {!isHeaderSearchSupported ? (
              <View style={styles.searchWrap}>
                <NativeSearchField
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t("mapTab.searchPlaceholder")}
                />
              </View>
            ) : null}
          </View>
        }
        ListFooterComponent={<View style={{ height: BrandSpacing.md }} />}
        ItemSeparatorComponent={() => (
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: palette.border,
              marginLeft: 16,
            }}
          />
        )}
      />

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
  countRow: {
    paddingHorizontal: 16,
    paddingBottom: 2,
  },
  searchWrap: {
    paddingHorizontal: 16,
  },
  saveFabArea: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 20,
  },
});
