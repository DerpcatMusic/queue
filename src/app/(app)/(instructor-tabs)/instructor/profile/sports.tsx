import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { LoadingScreen } from "@/components/loading-screen";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
} from "@/components/profile/profile-settings-sections";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
import { SportsMultiSelect } from "@/components/profile/sports-multi-select";
import { StatusSignal } from "@/components/profile/status-signal";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { BorderWidth } from "@/lib/design-system";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useTheme } from "@/hooks/use-theme";

export default function SportsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const { overlayBottom } = useAppInsets();
  const { currentUser } = useUser();
  useProfileSubpageSheet({
    title: t("profile.navigation.sports"),
    routeMatchPath: "/profile/sports",
  });

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
    if (!hasChanges || !draft) {
      router.back();
      return;
    }

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
    <View style={{ flex: 1, position: "relative", backgroundColor: theme.color.appBg }}>
      <ProfileSubpageScrollView
        routeKey="instructor/profile/sports"
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.inset,
          paddingBottom: overlayBottom + 92,
          gap: BrandSpacing.stackRoomy,
        }}
      >
        <View
          style={{
            gap: BrandSpacing.stackRoomy,
            borderRadius: BrandRadius.soft,
            padding: BrandSpacing.insetRoomy,
            borderWidth: BorderWidth.thin,
            borderColor: theme.color.border,
            backgroundColor: theme.color.surfaceAlt,
            borderCurve: "continuous",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: BrandSpacing.stack }}>
            <View style={{ flex: 1, gap: BrandSpacing.stackTight, minWidth: 0 }}>
              <Text style={[BrandType.radarLabel, { color: theme.color.textMuted }]}>
                {t("profile.settings.sports.title")}
              </Text>
              <Text style={[BrandType.heading, { color: theme.color.text }]}>
                {heroTitle}
              </Text>
              <Text style={[BrandType.body, { color: theme.color.textMuted }]}>
                {heroBody}
              </Text>
            </View>
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                borderRadius: BrandRadius.pill,
                backgroundColor: theme.color.primarySubtle,
                borderWidth: BorderWidth.thin,
                borderColor: theme.color.primarySubtle,
                width: BrandSpacing.avatarMd,
                height: BrandSpacing.avatarMd,
                borderCurve: "continuous",
              }}
            >
              <IconSymbol name="sparkles" size={22} color={theme.color.primary} />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: BrandSpacing.stackTight }}>
            <StatusSignal
              label={t("profile.sports.signalSelected")}
              value={t("profile.settings.sports.selected", {
                count: sports.length,
              })}
              tone="accent"
            />
            <StatusSignal
              label={t("profile.sports.signalState")}
              value={hasChanges ? t("profile.sports.stateUnsaved") : t("profile.sports.stateLive")}
            />
          </View>
        </View>

        <View style={{ gap: BrandSpacing.stackTight }}>
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
        </View>

        {errorMessage ? (
          <View
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
          </View>
        ) : null}
      </ProfileSubpageScrollView>

      <View
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
        <ActionButton
          label={t("common.cancel")}
          onPress={() => router.back()}
          tone="secondary"
          fullWidth
        />
      </View>
    </View>
  );
}
