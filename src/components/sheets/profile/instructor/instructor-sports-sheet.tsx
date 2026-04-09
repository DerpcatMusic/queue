/**
 * Instructor Sports Sheet - allows instructors to select which sports they teach.
 */

import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
} from "@/components/profile/profile-settings-sections";
import { SportsMultiSelect } from "@/components/profile/sports-multi-select";
import { StatusSignal } from "@/components/profile/status-signal";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useContentReveal } from "@/hooks/use-content-reveal";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth } from "@/lib/design-system";
import { Box } from "@/primitives";

interface InstructorSportsSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function InstructorSportsSheet({ visible, onClose }: InstructorSportsSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
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
  const { animatedStyle } = useContentReveal(isLoading);

  // Only access instructorSettings when not loading
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
    if (draft === null) {
      return false;
    }
    const sorted = [...draft].sort();
    const serverSorted = [...serverSports].sort();
    return JSON.stringify(sorted) !== JSON.stringify(serverSorted);
  })();

  const heroTitle =
    sports.length > 0
      ? t("profile.sports.heroReady", { count: sports.length })
      : t("profile.sports.heroEmpty");
  const heroBody =
    sports.length > 0 ? t("profile.sports.heroReadyBody") : t("profile.sports.heroEmptyBody");

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
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <View style={[styles.content, { paddingBottom: overlayBottom + 92 }]}>
          <Box
            style={{
              gap: BrandSpacing.stackRoomy,
              borderRadius: BrandRadius.soft,
              padding: BrandSpacing.insetRoomy,
              borderWidth: BorderWidth.thin,
              borderColor: theme.color.border,
              backgroundColor: theme.color.surfaceElevated,
              borderCurve: "continuous",
            }}
          >
            <Box
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: BrandSpacing.stack,
              }}
            >
              <Box style={{ flex: 1, gap: BrandSpacing.stackTight, minWidth: 0 }}>
                <Text style={[BrandType.radarLabel, { color: theme.color.textMuted }]}>
                  {t("profile.settings.sports.title")}
                </Text>
                <Text style={[BrandType.heading, { color: theme.color.text }]}>{heroTitle}</Text>
                <Text style={[BrandType.body, { color: theme.color.textMuted }]}>{heroBody}</Text>
              </Box>
              <Box
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: BrandRadius.pill,
                  backgroundColor: theme.color.primarySubtle,
                  borderWidth: BorderWidth.thin,
                  borderColor: theme.color.primarySubtle,
                  width: BrandSpacing.avatarXl,
                  height: BrandSpacing.avatarXl,
                  borderCurve: "continuous",
                }}
              >
                <IconSymbol
                  name="sparkles"
                  size={BrandSpacing.iconLg}
                  color={theme.color.primary}
                />
              </Box>
            </Box>

            <Box style={{ flexDirection: "row", gap: BrandSpacing.stackTight }}>
              <StatusSignal
                label={t("profile.sports.signalSelected")}
                value={t("profile.settings.sports.selected", {
                  count: sports.length,
                })}
                tone="accent"
              />
              <StatusSignal
                label={t("profile.sports.signalState")}
                value={
                  hasChanges ? t("profile.sports.stateUnsaved") : t("profile.sports.stateLive")
                }
              />
            </Box>
          </Box>

          <Box style={{ gap: BrandSpacing.stackTight }}>
            <ProfileSectionHeader
              label={t("profile.sports.boardLabel")}
              description={t("profile.sports.boardBody")}
              icon="sparkles"
              flush
            />
            <ProfileSectionCard style={{ marginHorizontal: 0 }}>
              <SportsMultiSelect
                selectedSports={sports}
                onToggleSport={toggleSport}
                searchPlaceholder={t("profile.settings.sports.searchPlaceholder")}
                title={t("profile.settings.sports.title")}
                emptyHint={t("profile.settings.sports.none")}
                defaultOpen
                variant="content"
              />
            </ProfileSectionCard>
          </Box>

          {errorMessage ? (
            <Box
              style={{
                borderRadius: BrandRadius.md,
                paddingHorizontal: BrandSpacing.controlX,
                paddingVertical: BrandSpacing.controlY,
                borderWidth: BorderWidth.thin,
                borderColor: theme.color.danger,
                backgroundColor: theme.color.dangerSubtle,
                borderCurve: "continuous",
              }}
            >
              <Text selectable style={[BrandType.bodyMedium, { color: theme.color.danger }]}>
                {errorMessage}
              </Text>
            </Box>
          ) : null}
        </View>

        <Box
          style={{
            position: "absolute",
            left: BrandSpacing.inset,
            right: BrandSpacing.inset,
            gap: BrandSpacing.stackTight,
            backgroundColor: theme.color.appBg,
            bottom: overlayBottom,
          }}
        >
          <ActionButton
            label={
              isSaving ? t("profile.settings.actions.saving") : t("profile.settings.actions.save")
            }
            onPress={() => {
              void onSave();
            }}
            disabled={isSaving || !hasChanges}
            fullWidth
          />
          <ActionButton label={t("common.cancel")} onPress={onClose} tone="secondary" fullWidth />
        </Box>
      </Animated.View>
    </BaseProfileSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: BrandSpacing.stackRoomy,
    paddingHorizontal: BrandSpacing.inset,
    paddingTop: BrandSpacing.lg,
  },
});
