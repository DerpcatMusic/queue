import { api } from "@/convex/_generated/api";
import { SPORT_TYPES, toSportLabel } from "@/convex/constants";
import { BrandSpacing } from "@/constants/brand";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitButton, KitListItem } from "@/components/ui/kit";
import { ThemedText } from "@/components/themed-text";
import { LoadingScreen } from "@/components/loading-screen";
import { RoleRouteGate } from "@/components/auth/role-route-gate";
import { useUser } from "@/contexts/user-context";
import { useBrand } from "@/hooks/use-brand";
import { useNativeTabLayout } from "@/hooks/use-native-tab-layout";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  FlatList,
} from "react-native";

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
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (searchExpanded) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [searchExpanded]);

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
        ...(instructorSettings.hourlyRateExpectation !== undefined ? { hourlyRateExpectation: instructorSettings.hourlyRateExpectation } : {}),
        ...(instructorSettings.address !== undefined ? { address: instructorSettings.address } : {}),
        ...(instructorSettings.latitude !== undefined ? { latitude: instructorSettings.latitude } : {}),
        ...(instructorSettings.longitude !== undefined ? { longitude: instructorSettings.longitude } : {}),
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
    <RoleRouteGate
      requiredRole="instructor"
      redirectHref="/(tabs)/studio/profile"
      loadingLabel={t("profile.settings.loading")}
    >
      <View style={[styles.screen, { backgroundColor: palette.appBg }]}>
      {/* Count badge */}
      <View style={[styles.countRow, { paddingTop: 16 }]}>
        <ThemedText type="caption" style={{ color: palette.textMuted }}>
          {sports.length > 0
            ? t("profile.settings.sports.selected", { count: sports.length })
            : t("profile.settings.sports.none")}
        </ThemedText>
      </View>

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
                  <IconSymbol
                    name="checkmark.circle.fill"
                    size={22}
                    color={palette.primary}
                  />
                ) : (
                  <IconSymbol
                    name="circle"
                    size={22}
                    color={palette.borderStrong}
                  />
                )
              }
            />
          );
        }}
        ListHeaderComponent={<View style={{ height: BrandSpacing.md }} />}
        ListFooterComponent={<View style={{ height: BrandSpacing.md }} />}
        ItemSeparatorComponent={() => (
           <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: palette.border, marginLeft: 16 }} />
        )}
      />

      {/* Floating Action Buttons Area */}
      <View
        style={[
          styles.fabArea,
          { bottom: Math.max(safeBottomInset, 24) },
          hasChanges && { bottom: Math.max(safeBottomInset, 80) },
          searchExpanded && { left: 16 }
        ]}
      >
        {searchExpanded ? (
          <View
            style={[
              styles.expandedSearchContainer,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,

              },
            ]}
          >
            <IconSymbol name="magnifyingglass" size={20} color={palette.textMuted} />
            <TextInput
              ref={searchInputRef}
              value={search}
              onChangeText={setSearch}
              placeholder={t("mapTab.searchPlaceholder")}
              placeholderTextColor={palette.textMuted}
              style={[
                styles.expandedSearchInput,
                { color: palette.text },
              ]}
              autoFocus={Platform.OS !== "web"}
              onBlur={() => {
                if (!search.trim()) setSearchExpanded(false);
              }}
            />
            {search.length > 0 ? (
              <Pressable
                onPress={() => {
                  setSearch("");
                  searchInputRef.current?.focus();
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <IconSymbol name="xmark.circle.fill" size={20} color={palette.textMuted} />
              </Pressable>
            ) : (
               <Pressable
                onPress={() => setSearchExpanded(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <IconSymbol name="xmark" size={20} color={palette.textMuted} />
              </Pressable>
            )}
          </View>
        ) : (
          <Pressable
            style={[
              styles.fabButton,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,

              },
            ]}
            onPress={() => {
              if (process.env.EXPO_OS === "ios") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSearchExpanded(true);
            }}
          >
            <IconSymbol name="magnifyingglass" size={24} color={palette.primary} />
          </Pressable>
        )}
      </View>

      {/* Save FAB */}
      {hasChanges ? (
        <View style={[styles.saveFabArea, { bottom: Math.max(safeBottomInset, 16) }]}>
          <KitButton
            label={isSaving ? t("profile.settings.actions.saving") : t("profile.settings.actions.save")}
            onPress={() => {
              void onSave();
            }}
            disabled={isSaving}
          />
        </View>
      ) : null}
      </View>
    </RoleRouteGate>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  countRow: {
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 4,
  },
  fabArea: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    alignItems: "flex-end",
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 16, // Rounded square
    borderWidth: 1,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",




  },
  expandedSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderCurve: "continuous",
    paddingHorizontal: 16,




    minWidth: 280,
  },
  expandedSearchInput: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    height: "100%",
  },
  saveFabArea: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 20,
  },
});



