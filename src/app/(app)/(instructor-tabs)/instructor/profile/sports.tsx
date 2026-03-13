import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
} from "@/components/profile/profile-settings-sections";
import { SportsMultiSelect } from "@/components/profile/sports-multi-select";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ActionButton } from "@/components/ui/action-button";
import {
  BrandRadius,
  BrandSpacing,
  BrandType,
  type BrandPalette,
} from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";

function StatusSignal({
  label,
  value,
  palette,
  tone = "surface",
}: {
  label: string;
  value: string;
  palette: BrandPalette;
  tone?: "surface" | "accent";
}) {
  const backgroundColor =
    tone === "accent"
      ? (palette.primarySubtle as string)
      : (palette.surfaceElevated as string);
  const labelColor =
    tone === "accent"
      ? (palette.primary as string)
      : (palette.textMuted as string);

  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        gap: 2,
        borderRadius: BrandRadius.card - 6,
        borderCurve: "continuous",
        backgroundColor,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <Text
        style={{
          ...BrandType.micro,
          color: labelColor,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          ...BrandType.bodyStrong,
          color: palette.text as string,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function SportsScreen() {
  const { t } = useTranslation();
  const palette = useBrand();
  const router = useRouter();
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
      ? t("profile.sports.heroReady", {
          count: sports.length,
          defaultValue: `You are live in ${String(sports.length)} sports`,
        })
      : t("profile.sports.heroEmpty", {
          defaultValue: "Build the sports board you want jobs from",
        });
  const heroBody =
    sports.length > 0
      ? t("profile.sports.heroReadyBody", {
          defaultValue:
            "Keep the board tight. Every selected sport sharpens matching, profile clarity, and job quality.",
        })
      : t("profile.sports.heroEmptyBody", {
          defaultValue:
            "Select the sports you actually teach so Queue stops looking broad and starts looking credible.",
        });

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
        error instanceof Error
          ? error.message
          : t("profile.settings.errors.saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.appBg }]}>
      <TabScreenScrollView
        routeKey="instructor/profile"
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.lg,
          paddingTop: BrandSpacing.lg,
          paddingBottom: 148,
          gap: BrandSpacing.lg,
        }}
      >
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: palette.surfaceAlt as string,
              borderColor: palette.border as string,
            },
          ]}
        >
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroCopy}>
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
              style={[
                styles.heroIconWrap,
                { backgroundColor: palette.primarySubtle as string },
              ]}
            >
              <IconSymbol
                name="sparkles"
                size={22}
                color={palette.primary as string}
              />
            </View>
          </View>

          <View style={styles.heroSignalsRow}>
            <StatusSignal
              label={t("profile.sports.signalSelected", {
                defaultValue: "Selected",
              })}
              value={t("profile.settings.sports.selected", {
                count: sports.length,
              })}
              palette={palette}
              tone="accent"
            />
            <StatusSignal
              label={t("profile.sports.signalState", {
                defaultValue: "State",
              })}
              value={
                hasChanges
                  ? t("profile.sports.stateUnsaved", {
                      defaultValue: "Unsaved changes",
                    })
                  : t("profile.sports.stateLive", {
                      defaultValue: "Live",
                    })
              }
              palette={palette}
            />
          </View>
        </View>

        <View style={{ gap: BrandSpacing.sm }}>
          <ProfileSectionHeader
            label={t("profile.sports.boardLabel", {
              defaultValue: "Sports board",
            })}
            description={t("profile.sports.boardBody", {
              defaultValue:
                "Tap to add or remove. Keep it honest and tight so the matching engine stays sharp.",
            })}
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
            style={[
              styles.errorCard,
              {
                borderColor: palette.danger as string,
                backgroundColor: palette.dangerSubtle as string,
              },
            ]}
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
      </TabScreenScrollView>

      <View
        style={[
          styles.actionRail,
          {
            bottom: overlayBottom,
            backgroundColor: palette.appBg as string,
          },
        ]}
      >
        <ActionButton
          label={
            isSaving
              ? t("profile.settings.actions.saving")
              : t("profile.settings.actions.save")
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  heroCard: {
    gap: BrandSpacing.lg,
    borderWidth: 1,
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    padding: BrandSpacing.xl,
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: BrandSpacing.md,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  heroIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  heroSignalsRow: {
    flexDirection: "row",
    gap: 10,
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: BrandRadius.button,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionRail: {
    position: "absolute",
    left: BrandSpacing.lg,
    right: BrandSpacing.lg,
    gap: 10,
  },
});
