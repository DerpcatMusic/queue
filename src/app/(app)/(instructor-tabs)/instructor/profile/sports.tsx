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
import { BrandSpacing, BrandType } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";

export default function SportsScreen() {
  const { t } = useTranslation();
  const palette = useBrand();
  const router = useRouter();
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
    <View className="flex-1 relative" style={{ backgroundColor: palette.appBg }}>
      <ProfileSubpageScrollView
        routeKey="instructor/profile/sports"
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.inset,
          paddingBottom: overlayBottom + 92,
          gap: BrandSpacing.stackRoomy,
        }}
      >
        <View
          className="gap-stack-roomy rounded-soft p-inset-roomy"
          style={{
            borderWidth: 1,
            borderCurve: "continuous",
            backgroundColor: palette.surfaceAlt as string,
            borderColor: palette.border as string,
          }}
        >
          <View className="flex-row items-start gap-stack">
            <View className="flex-1 gap-stack-tight min-w-0">
              <Text
                style={{
                  ...BrandType.micro,
                  color: palette.textMuted as string,
                  letterSpacing: 0.8,
                }}
              >
                {t("profile.settings.sports.title").toUpperCase()}
              </Text>
              <Text
                style={{
                  ...BrandType.heading,
                  color: palette.text as string,
                }}
              >
                {heroTitle}
              </Text>
              <Text
                style={{
                  ...BrandType.body,
                  color: palette.textMuted as string,
                }}
              >
                {heroBody}
              </Text>
            </View>
            <View
              className="items-center justify-center rounded-pill"
              style={{
                width: BrandSpacing.avatarMd,
                height: BrandSpacing.avatarMd,
                borderWidth: 1,
                borderCurve: "continuous",
                backgroundColor: palette.primarySubtle as string,
                borderColor: palette.primarySubtle as string,
              }}
            >
              <IconSymbol name="sparkles" size={22} color={palette.primary as string} />
            </View>
          </View>

          <View className="flex-row gap-stack-tight">
            <StatusSignal
              label={t("profile.sports.signalSelected")}
              value={t("profile.settings.sports.selected", {
                count: sports.length,
              })}
              palette={palette}
              tone="accent"
            />
            <StatusSignal
              label={t("profile.sports.signalState")}
              value={hasChanges ? t("profile.sports.stateUnsaved") : t("profile.sports.stateLive")}
              palette={palette}
            />
          </View>
        </View>

        <View className="gap-stack-tight">
          <ProfileSectionHeader
            label={t("profile.sports.boardLabel")}
            description={t("profile.sports.boardBody")}
            icon="sparkles"
            palette={palette}
            flush
          />
          <ProfileSectionCard palette={palette} style={{ marginHorizontal: 0 }}>
            <SportsMultiSelect
              palette={palette}
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
            className="rounded-medium px-control-x py-control-y"
            style={{
              borderWidth: 1,
              borderCurve: "continuous",
              borderColor: palette.danger as string,
              backgroundColor: palette.dangerSubtle as string,
            }}
          >
            <Text
              selectable
              style={{
                ...BrandType.bodyMedium,
                color: palette.danger as string,
              }}
            >
              {errorMessage}
            </Text>
          </View>
        ) : null}
      </ProfileSubpageScrollView>

      <View
        className="absolute left-inset right-inset gap-stack-tight"
        style={{
          bottom: overlayBottom,
          backgroundColor: palette.appBg as string,
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
          palette={palette}
          fullWidth
        />
        <ActionButton
          label={t("common.cancel")}
          onPress={() => router.back()}
          palette={palette}
          tone="secondary"
          fullWidth
        />
      </View>
    </View>
  );
}
