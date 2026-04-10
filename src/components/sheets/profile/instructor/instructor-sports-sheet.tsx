/**
 * Instructor Sports Sheet - allows instructors to select which sports they teach.
 *
 * Deliberately flat: SportsMultiSelect renders directly inside the sheet.
 * No ProfileSectionCard, no nested Boxes, no Animated wrappers.
 * The search + scroll are handled by SportsMultiSelect's own ScrollView.
 */

import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View, Text } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { SportsMultiSelect } from "@/components/profile/sports-multi-select";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useAppInsets } from "@/hooks/use-app-insets";

interface InstructorSportsSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function InstructorSportsSheet({ visible, onClose }: InstructorSportsSheetProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { overlayBottom } = useAppInsets();
  const { currentUser } = useUser();

  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const saveSettings = useMutation(api.users.updateMyInstructorSettings);

  const [draft, setDraft] = useState<string[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isLoading = instructorSettings === undefined || instructorSettings === null;
  const serverSports = isLoading ? [] : instructorSettings!.sports;
  const sports = isLoading ? [] : (draft ?? serverSports);

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
    if (!hasChanges || !draft || !instructorSettings) {
      onClose();
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    const settings = instructorSettings;
    try {
      await saveSettings({
        notificationsEnabled: settings!.notificationsEnabled,
        sports: draft,
        calendarProvider: settings!.calendarProvider,
        calendarSyncEnabled: settings!.calendarSyncEnabled,
        ...(settings!.hourlyRateExpectation !== undefined
          ? { hourlyRateExpectation: settings!.hourlyRateExpectation }
          : {}),
        ...(settings!.address !== undefined ? { address: settings!.address } : {}),
        ...(settings!.latitude !== undefined ? { latitude: settings!.latitude } : {}),
        ...(settings!.longitude !== undefined ? { longitude: settings!.longitude } : {}),
      });
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("profile.settings.errors.saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BaseProfileSheet visible={visible} onClose={onClose}>
      {/* Minimal header — icon + count + unsaved badge */}
      <View style={s.header}>
        <View style={[s.headerIcon, { backgroundColor: theme.color.primarySubtle }]}>
          <IconSymbol name="sparkles" size={20} color={theme.color.primary} />
        </View>
        <Text style={[BrandType.heading, { color: theme.color.text, flex: 1 }]}>
          {sports.length > 0
            ? t("profile.sports.heroReady", { count: sports.length })
            : t("profile.sports.heroEmpty")}
        </Text>
        {hasChanges && (
          <View style={[s.badge, { backgroundColor: theme.color.primarySubtle }]}>
            <Text style={[BrandType.caption, { color: theme.color.primary }]}>
              {t("profile.sports.stateUnsaved")}
            </Text>
          </View>
        )}
      </View>

      {/* Error banner */}
      {errorMessage && (
        <View
          style={[
            s.errorBanner,
            {
              backgroundColor: theme.color.dangerSubtle,
              borderColor: theme.color.danger,
            },
          ]}
        >
          <IconSymbol name="exclamationmark.triangle.fill" size={18} color={theme.color.danger} />
          <Text style={[BrandType.bodyMedium, { color: theme.color.danger, flex: 1 }]}>
            {errorMessage}
          </Text>
        </View>
      )}

      {/* The actual sports selector — no nesting, no card wrappers */}
      <SportsMultiSelect
        selectedSports={sports}
        onToggleSport={toggleSport}
        searchPlaceholder={t("profile.settings.sports.searchPlaceholder")}
        title={t("profile.settings.sports.title")}
        emptyHint={t("profile.settings.sports.none")}
        defaultOpen
        variant="content"
      />

      {/* Sticky save bar */}
      <View style={[s.saveBar, { bottom: overlayBottom }]}>
        <ActionButton
          label={
            isSaving ? t("profile.settings.actions.saving") : t("profile.settings.actions.save")
          }
          onPress={() => void onSave()}
          disabled={isSaving || !hasChanges}
          fullWidth
        />
      </View>
    </BaseProfileSheet>
  );
}

const s = StyleSheet.create(() => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.md,
    paddingBottom: BrandSpacing.sm,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    borderRadius: BrandRadius.pill,
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.xs,
  },
  errorBanner: {
    borderRadius: BrandRadius.md,
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.sm,
    borderWidth: 1,
    borderCurve: "continuous",
    borderLeftWidth: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.md,
  },
  saveBar: {
    position: "absolute",
    left: BrandSpacing.inset,
    right: BrandSpacing.inset,
  },
}));
