import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { SPORT_TYPES, toSportLabel } from "@/convex/constants";
import { Brand, BrandRadius } from "@/constants/brand";
import { ZONE_OPTIONS } from "@/constants/zones";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useLocationResolution } from "@/hooks/use-location-resolution";
import { useNativeTabLayout } from "@/hooks/use-native-tab-layout";
import { getLocationResolveErrorMessage } from "@/lib/location-error-message";
import { type ResolvedLocation } from "@/lib/location-zone";
import { omitUndefined } from "@/lib/omit-undefined";
import { setThemePreference } from "@/lib/theme-preference";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/themed-text";
import { BrandButton } from "@/components/ui/brand-button";
import { BrandSurface } from "@/components/ui/brand-surface";

const ROLE_TRANSLATION_KEYS = {
  pending: "profile.roles.pending",
  instructor: "profile.roles.instructor",
  studio: "profile.roles.studio",
  admin: "profile.roles.admin",
} as const;

const CALENDAR_PROVIDER_KEYS = {
  none: "profile.settings.calendar.provider.none",
  google: "profile.settings.calendar.provider.google",
  apple: "profile.settings.calendar.provider.apple",
} as const;

type CalendarProvider = keyof typeof CALENDAR_PROVIDER_KEYS;

type AccountSummaryRowProps = {
  label: string;
  value: string;
  mutedTextColor: string;
};

function AccountSummaryRow({
  label,
  value,
  mutedTextColor,
}: AccountSummaryRowProps) {
  return (
    <View style={styles.summaryRow}>
      <ThemedText style={{ color: mutedTextColor }}>{label}</ThemedText>
      <ThemedText type="defaultSemiBold" selectable>
        {value}
      </ThemedText>
    </View>
  );
}

type LanguageOptionProps = {
  isActive: boolean;
  label: string;
  onPress: () => void;
  borderColor: string;
  activeBorderColor: string;
  activeBackgroundColor: string;
};

function LanguageOption({
  isActive,
  label,
  onPress,
  borderColor,
  activeBorderColor,
  activeBackgroundColor,
}: LanguageOptionProps) {
  return (
    <Pressable
      style={[
        styles.languageButton,
        {
          borderColor: isActive ? activeBorderColor : borderColor,
          backgroundColor: isActive ? activeBackgroundColor : undefined,
        },
      ]}
      onPress={() => {
        if (process.env.EXPO_OS === "ios") {
          void Haptics.selectionAsync();
        }
        onPress();
      }}
    >
      <ThemedText type="defaultSemiBold">{label}</ThemedText>
    </Pressable>
  );
}

type SelectChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  borderColor: string;
  selectedBorderColor: string;
  selectedBackgroundColor: string;
  selectedTextColor: string;
};

function SelectChip({
  label,
  selected,
  onPress,
  borderColor,
  selectedBorderColor,
  selectedBackgroundColor,
  selectedTextColor,
}: SelectChipProps) {
  return (
    <Pressable
      style={[
        styles.chip,
        {
          borderColor: selected ? selectedBorderColor : borderColor,
          backgroundColor: selected ? selectedBackgroundColor : undefined,
        },
      ]}
      onPress={() => {
        if (process.env.EXPO_OS === "ios") {
          void Haptics.selectionAsync();
        }
        onPress();
      }}
    >
      <ThemedText
        type="defaultSemiBold"
        style={{ color: selected ? selectedTextColor : undefined }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

function normalizeSports(sports: string[]): string[] {
  return [...new Set(sports)].sort();
}

function findZoneLabel(zoneId: string, language: "en" | "he"): string {
  const zone = ZONE_OPTIONS.find((item) => item.id === zoneId);
  if (!zone) return zoneId;
  return zone.label[language];
}

function buildInstructorSignature(input: {
  notificationsEnabled: boolean;
  hourlyRateInput: string;
  sportsDraft: string[];
  addressInput: string;
  latitude: number | undefined;
  longitude: number | undefined;
  includeDetectedZone: boolean;
  calendarProvider: CalendarProvider;
  calendarSyncEnabled: boolean;
}) {
  return [
    input.notificationsEnabled ? "1" : "0",
    input.hourlyRateInput.trim(),
    normalizeSports(input.sportsDraft).join("|"),
    input.addressInput.trim(),
    input.latitude === undefined ? "" : String(input.latitude),
    input.longitude === undefined ? "" : String(input.longitude),
    input.includeDetectedZone ? "1" : "0",
    input.calendarProvider,
    input.calendarSyncEnabled ? "1" : "0",
  ].join("::");
}

function buildStudioSignature(input: {
  studioNameInput: string;
  studioAddressInput: string;
  studioContactPhoneInput: string;
  studioZoneInput: string | null;
  studioLatitude: number | undefined;
  studioLongitude: number | undefined;
}) {
  return [
    input.studioNameInput.trim(),
    input.studioAddressInput.trim(),
    input.studioContactPhoneInput.trim(),
    input.studioZoneInput ?? "",
    input.studioLatitude === undefined ? "" : String(input.studioLatitude),
    input.studioLongitude === undefined ? "" : String(input.studioLongitude),
  ].join("::");
}

export default function ProfileScreen() {
  const { signOut } = useAuthActions();
  const currentUser = useQuery(api.users.getCurrentUser);
  const { language, setLanguage } = useAppLanguage();
  const saveInstructorSettings = useMutation(api.users.updateMyInstructorSettings);
  const saveStudioSettings = useMutation(api.users.updateMyStudioSettings);
  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const studioSettings = useQuery(
    api.users.getMyStudioSettings,
    currentUser?.role === "studio" ? {} : "skip",
  );

  const colorScheme = useColorScheme() ?? "light";
  const palette = Brand[colorScheme];
  const { t, i18n } = useTranslation();
  const tabLayout = useNativeTabLayout();
  const languageCode = i18n.resolvedLanguage?.startsWith("he") ? "he" : "en";

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [hourlyRateInput, setHourlyRateInput] = useState("");
  const [sportsDraft, setSportsDraft] = useState<string[]>([]);
  const [instructorAddressInput, setInstructorAddressInput] = useState("");
  const [instructorLatitude, setInstructorLatitude] = useState<number | undefined>();
  const [instructorLongitude, setInstructorLongitude] = useState<number | undefined>();
  const [instructorDetectedZone, setInstructorDetectedZone] = useState<string | null>(null);
  const [includeDetectedZone, setIncludeDetectedZone] = useState(false);
  const instructorLocationResolver = useLocationResolution();
  const [calendarProvider, setCalendarProvider] = useState<CalendarProvider>("none");
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);
  const [studioNameInput, setStudioNameInput] = useState("");
  const [studioAddressInput, setStudioAddressInput] = useState("");
  const [studioContactPhoneInput, setStudioContactPhoneInput] = useState("");
  const [studioZoneInput, setStudioZoneInput] = useState<string | null>(null);
  const [studioLatitude, setStudioLatitude] = useState<number | undefined>();
  const [studioLongitude, setStudioLongitude] = useState<number | undefined>();
  const studioLocationResolver = useLocationResolution();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedInstructorSignature, setLastSavedInstructorSignature] =
    useState<string | null>(null);
  const [lastSavedStudioSignature, setLastSavedStudioSignature] =
    useState<string | null>(null);

  useEffect(() => {
    if (!instructorSettings) return;

    setNotificationsEnabled(instructorSettings.notificationsEnabled);
    setHourlyRateInput(
      instructorSettings.hourlyRateExpectation !== undefined
        ? String(instructorSettings.hourlyRateExpectation)
        : "",
    );
    setSportsDraft(normalizeSports(instructorSettings.sports));
    setInstructorAddressInput(instructorSettings.address ?? "");
    setInstructorLatitude(instructorSettings.latitude);
    setInstructorLongitude(instructorSettings.longitude);
    setInstructorDetectedZone(null);
    setIncludeDetectedZone(false);
    setCalendarProvider(instructorSettings.calendarProvider);
    setCalendarSyncEnabled(instructorSettings.calendarSyncEnabled);
  }, [instructorSettings]);

  useEffect(() => {
    if (!studioSettings) return;
    setStudioNameInput(studioSettings.studioName);
    setStudioAddressInput(studioSettings.address);
    setStudioContactPhoneInput(studioSettings.contactPhone ?? "");
    setStudioZoneInput(studioSettings.zone);
    setStudioLatitude(studioSettings.latitude);
    setStudioLongitude(studioSettings.longitude);
  }, [studioSettings]);

  const nameValue = currentUser?.fullName ?? t("profile.account.fallbackName");
  const emailValue = currentUser?.email ?? t("profile.account.fallbackEmail");
  const roleValue = currentUser?.role
    ? t(ROLE_TRANSLATION_KEYS[currentUser.role])
    : t("profile.roles.unknown");

  const memberSince = useMemo(() => {
    if (!currentUser) return null;
    return new Date(currentUser.createdAt).toLocaleDateString(
      i18n.resolvedLanguage ?? "en",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      },
    );
  }, [currentUser, i18n.resolvedLanguage]);

  const canEnablePush =
    instructorSettings?.hasExpoPushToken ?? false;
  const isDarkModeEnabled = colorScheme === "dark";

  const currentInstructorSignature = useMemo(
    () =>
      buildInstructorSignature({
        notificationsEnabled,
        hourlyRateInput,
        sportsDraft,
        addressInput: instructorAddressInput,
        latitude: instructorLatitude,
        longitude: instructorLongitude,
        includeDetectedZone,
        calendarProvider,
        calendarSyncEnabled,
      }),
    [
      notificationsEnabled,
      hourlyRateInput,
      sportsDraft,
      instructorAddressInput,
      instructorLatitude,
      instructorLongitude,
      includeDetectedZone,
      calendarProvider,
      calendarSyncEnabled,
    ],
  );
  const baselineInstructorSignature = useMemo(
    () =>
      instructorSettings
        ? buildInstructorSignature({
            notificationsEnabled: instructorSettings.notificationsEnabled,
            hourlyRateInput:
              instructorSettings.hourlyRateExpectation !== undefined
                ? String(instructorSettings.hourlyRateExpectation)
                : "",
            sportsDraft: instructorSettings.sports,
            addressInput: instructorSettings.address ?? "",
            latitude: instructorSettings.latitude,
            longitude: instructorSettings.longitude,
            includeDetectedZone: false,
            calendarProvider: instructorSettings.calendarProvider,
            calendarSyncEnabled: instructorSettings.calendarSyncEnabled,
          })
        : null,
    [instructorSettings],
  );
  const currentStudioSignature = useMemo(
    () =>
      buildStudioSignature({
        studioNameInput,
        studioAddressInput,
        studioContactPhoneInput,
        studioZoneInput,
        studioLatitude,
        studioLongitude,
      }),
    [
      studioNameInput,
      studioAddressInput,
      studioContactPhoneInput,
      studioZoneInput,
      studioLatitude,
      studioLongitude,
    ],
  );
  const baselineStudioSignature = useMemo(
    () =>
      studioSettings
        ? buildStudioSignature({
            studioNameInput: studioSettings.studioName,
            studioAddressInput: studioSettings.address,
            studioContactPhoneInput: studioSettings.contactPhone ?? "",
            studioZoneInput: studioSettings.zone,
            studioLatitude: studioSettings.latitude,
            studioLongitude: studioSettings.longitude,
          })
        : null,
    [studioSettings],
  );

  useEffect(() => {
    if (baselineInstructorSignature === null) return;
    setLastSavedInstructorSignature(baselineInstructorSignature);
  }, [baselineInstructorSignature]);

  useEffect(() => {
    if (baselineStudioSignature === null) return;
    setLastSavedStudioSignature(baselineStudioSignature);
  }, [baselineStudioSignature]);

  const hasUnsavedInstructorChanges = baselineInstructorSignature
    ? currentInstructorSignature !==
      (lastSavedInstructorSignature ?? baselineInstructorSignature)
    : false;

  const hasUnsavedStudioChanges = baselineStudioSignature
    ? currentStudioSignature !== (lastSavedStudioSignature ?? baselineStudioSignature)
    : false;
  const hasUnsavedChanges =
    currentUser?.role === "instructor"
      ? hasUnsavedInstructorChanges
      : hasUnsavedStudioChanges;

  const toggleSport = (sport: string) => {
    setSportsDraft((current) => {
      if (current.includes(sport)) {
        return current.filter((item) => item !== sport);
      }
      return [...current, sport];
    });
  };

  const onThemeModeToggle = (value: boolean) => {
    void setThemePreference(value ? "dark" : "light");
  };

  const applyInstructorResolution = (resolved: ResolvedLocation) => {
    setInstructorAddressInput(resolved.address);
    setInstructorLatitude(resolved.latitude);
    setInstructorLongitude(resolved.longitude);
    setInstructorDetectedZone(resolved.zoneId);
    setIncludeDetectedZone(true);
  };

  const resolveInstructorByAddress = async () => {
    if (!instructorAddressInput.trim()) {
      setErrorMessage(t("profile.settings.errors.addressRequired"));
      return;
    }
    setErrorMessage(null);
    setStatusMessage(null);
    const result = await instructorLocationResolver.resolveFromAddress(
      instructorAddressInput,
    );
    if (!result.ok) {
      setErrorMessage(
        getLocationResolveErrorMessage({
          code: result.error.code,
          fallbackMessage: result.error.message,
          fallbackKey: "locationResolveFailed",
          translationPrefix: "profile.settings.errors",
          t,
        }),
      );
      return;
    }
    applyInstructorResolution(result.data.value);
  };

  const resolveInstructorByGps = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    const result = await instructorLocationResolver.resolveFromGps();
    if (!result.ok) {
      setErrorMessage(
        getLocationResolveErrorMessage({
          code: result.error.code,
          fallbackMessage: result.error.message,
          fallbackKey: "locationResolveFailed",
          translationPrefix: "profile.settings.errors",
          t,
        }),
      );
      return;
    }
    applyInstructorResolution(result.data.value);
  };

  const applyStudioResolution = (resolved: ResolvedLocation) => {
    setStudioAddressInput(resolved.address);
    setStudioLatitude(resolved.latitude);
    setStudioLongitude(resolved.longitude);
    setStudioZoneInput(resolved.zoneId);
  };

  const resolveStudioByAddress = async () => {
    if (!studioAddressInput.trim()) {
      setErrorMessage(t("profile.settings.errors.addressRequired"));
      return;
    }
    setErrorMessage(null);
    setStatusMessage(null);
    const result = await studioLocationResolver.resolveFromAddress(
      studioAddressInput,
    );
    if (!result.ok) {
      setErrorMessage(
        getLocationResolveErrorMessage({
          code: result.error.code,
          fallbackMessage: result.error.message,
          fallbackKey: "locationResolveFailed",
          translationPrefix: "profile.settings.errors",
          t,
        }),
      );
      return;
    }
    applyStudioResolution(result.data.value);
  };

  const resolveStudioByGps = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    const result = await studioLocationResolver.resolveFromGps();
    if (!result.ok) {
      setErrorMessage(
        getLocationResolveErrorMessage({
          code: result.error.code,
          fallbackMessage: result.error.message,
          fallbackKey: "locationResolveFailed",
          translationPrefix: "profile.settings.errors",
          t,
        }),
      );
      return;
    }
    applyStudioResolution(result.data.value);
  };

  const onSaveInstructorSettings = async () => {
    if (!instructorSettings) return;

    const trimmedRate = hourlyRateInput.trim();
    const hourlyRateExpectation =
      trimmedRate.length === 0 ? undefined : Number.parseFloat(trimmedRate);

    if (
      hourlyRateExpectation !== undefined &&
      (!Number.isFinite(hourlyRateExpectation) || hourlyRateExpectation <= 0)
    ) {
      setErrorMessage(t("profile.settings.errors.hourlyRatePositive"));
      return;
    }

    const sports = normalizeSports(sportsDraft);
    if (sports.length === 0) {
      setErrorMessage(t("profile.settings.errors.sportRequired"));
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setIsSaving(true);

    try {
      const detectedZone = instructorDetectedZone ?? undefined;
      await saveInstructorSettings({
        notificationsEnabled,
        sports,
        address: instructorAddressInput,
        includeDetectedZone,
        calendarProvider,
        calendarSyncEnabled,
        ...omitUndefined({
          hourlyRateExpectation,
          latitude: instructorLatitude,
          longitude: instructorLongitude,
          detectedZone,
        }),
      });

      setIncludeDetectedZone(false);
      setLastSavedInstructorSignature(
        buildInstructorSignature({
          notificationsEnabled,
          hourlyRateInput,
          sportsDraft: sports,
          addressInput: instructorAddressInput,
          latitude: instructorLatitude,
          longitude: instructorLongitude,
          includeDetectedZone: false,
          calendarProvider,
          calendarSyncEnabled,
        }),
      );
      setStatusMessage(t("profile.settings.saved"));
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("profile.settings.errors.saveFailed");
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  const onSaveStudioSettings = async () => {
    if (!studioSettings) return;
    if (!studioNameInput.trim()) {
      setErrorMessage(t("profile.settings.errors.studioNameRequired"));
      return;
    }
    if (!studioAddressInput.trim()) {
      setErrorMessage(t("profile.settings.errors.addressRequired"));
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setIsSaving(true);

    try {
      let zone = studioZoneInput;
      let latitude = studioLatitude;
      let longitude = studioLongitude;

      if (!zone || latitude === undefined || longitude === undefined) {
        const result = await studioLocationResolver.resolveFromAddress(
          studioAddressInput,
        );
        if (!result.ok) {
          throw new Error(
            getLocationResolveErrorMessage({
              code: result.error.code,
              fallbackMessage: result.error.message,
              fallbackKey: "locationResolveFailed",
              translationPrefix: "profile.settings.errors",
              t,
            }),
          );
        }
        const resolved = result.data.value;
        applyStudioResolution(resolved);
        zone = resolved.zoneId;
        latitude = resolved.latitude;
        longitude = resolved.longitude;
      }

      if (!zone) {
        throw new Error(t("profile.settings.errors.locationResolveFailed"));
      }

      await saveStudioSettings({
        studioName: studioNameInput.trim(),
        address: studioAddressInput.trim(),
        zone,
        contactPhone: studioContactPhoneInput,
        latitude,
        longitude,
      });

      setLastSavedStudioSignature(
        buildStudioSignature({
          studioNameInput,
          studioAddressInput,
          studioContactPhoneInput,
          studioZoneInput: zone,
          studioLatitude: latitude,
          studioLongitude: longitude,
        }),
      );
      setStatusMessage(t("profile.settings.saved"));
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("profile.settings.errors.saveFailed");
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.appBg }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(tabLayout.topInset, 22),
          paddingBottom: tabLayout.bottomInset,
        },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerBlock}>
        <ThemedText type="title" style={styles.title}>
          {t("profile.title")}
        </ThemedText>
        <ThemedText style={{ color: palette.textMuted }}>
          {t("profile.subtitle")}
        </ThemedText>
      </View>

      {hasUnsavedChanges ? (
        <View
          style={[
            styles.unsavedBanner,
            {
              borderColor: palette.primary,
              backgroundColor: palette.primarySubtle,
            },
          ]}
        >
          <View style={styles.unsavedBannerText}>
            <ThemedText type="defaultSemiBold">{t("profile.settings.unsavedTitle")}</ThemedText>
            <ThemedText style={{ color: palette.textMuted }}>
              {t("profile.settings.unsavedBody")}
            </ThemedText>
          </View>
          <BrandButton
            label={t("profile.settings.actions.save")}
            onPress={() => {
              if (currentUser?.role === "instructor") {
                void onSaveInstructorSettings();
                return;
              }
              void onSaveStudioSettings();
            }}
            disabled={isSaving}
            style={styles.unsavedBannerButton}
          />
        </View>
      ) : null}

      <BrandSurface>
        <ThemedText type="subtitle">{t("profile.account.title")}</ThemedText>
        <AccountSummaryRow
          label={t("profile.account.nameLabel")}
          value={nameValue}
          mutedTextColor={palette.textMuted}
        />
        <AccountSummaryRow
          label={t("profile.account.emailLabel")}
          value={emailValue}
          mutedTextColor={palette.textMuted}
        />
        <AccountSummaryRow
          label={t("profile.account.roleLabel")}
          value={roleValue}
          mutedTextColor={palette.textMuted}
        />
        {memberSince ? (
          <AccountSummaryRow
            label={t("profile.account.memberSince")}
            value={memberSince}
            mutedTextColor={palette.textMuted}
          />
        ) : null}
      </BrandSurface>

      <BrandSurface>
        <ThemedText type="subtitle">{t("profile.language.title")}</ThemedText>
        <ThemedText style={{ color: palette.textMuted }}>
          {t("profile.language.description")}
        </ThemedText>
        <View style={styles.languageRow}>
          <LanguageOption
            isActive={language === "en"}
            label={t("language.english")}
            onPress={() => {
              void setLanguage("en");
            }}
            borderColor={palette.border}
            activeBorderColor={palette.primary}
            activeBackgroundColor={palette.surfaceAlt}
          />
          <LanguageOption
            isActive={language === "he"}
            label={t("language.hebrew")}
            onPress={() => {
              void setLanguage("he");
            }}
            borderColor={palette.border}
            activeBorderColor={palette.primary}
            activeBackgroundColor={palette.surfaceAlt}
          />
        </View>
      </BrandSurface>

      <BrandSurface>
        <ThemedText type="subtitle">{t("profile.appearance.title")}</ThemedText>
        <View style={styles.settingRow}>
          <View style={styles.settingTextBlock}>
            <ThemedText type="defaultSemiBold">
              {t("profile.appearance.darkMode.title")}
            </ThemedText>
            <ThemedText style={{ color: palette.textMuted }}>
              {t("profile.appearance.darkMode.description")}
            </ThemedText>
          </View>
          <Switch
            value={isDarkModeEnabled}
            onValueChange={onThemeModeToggle}
            trackColor={{
              false: palette.border,
              true: palette.primary,
            }}
          />
        </View>
      </BrandSurface>

      {currentUser?.role === "instructor" ? (
        <BrandSurface>
          <ThemedText type="subtitle">{t("profile.settings.title")}</ThemedText>

          {instructorSettings === undefined ? (
            <ThemedText style={{ color: palette.textMuted }}>
              {t("profile.settings.loading")}
            </ThemedText>
          ) : instructorSettings === null ? (
            <ThemedText style={{ color: palette.textMuted }}>
              {t("profile.settings.unavailable")}
            </ThemedText>
          ) : (
            <>
              <View style={styles.settingRow}>
                <View style={styles.settingTextBlock}>
                  <ThemedText type="defaultSemiBold">
                    {t("profile.settings.notifications.title")}
                  </ThemedText>
                  <ThemedText style={{ color: palette.textMuted }}>
                    {canEnablePush
                      ? t("profile.settings.notifications.description")
                      : t("profile.settings.notifications.pushMissing")}
                  </ThemedText>
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={(value) => {
                    setNotificationsEnabled(value);
                  }}
                  disabled={!canEnablePush}
                  trackColor={{
                    false: palette.border,
                    true: palette.primary,
                  }}
                />
              </View>

              <View style={styles.settingTextBlock}>
                <ThemedText type="defaultSemiBold">
                  {t("profile.settings.hourly.title")}
                </ThemedText>
                <ThemedText style={{ color: palette.textMuted }}>
                  {t("profile.settings.hourly.description")}
                </ThemedText>
                <TextInput
                  value={hourlyRateInput}
                  onChangeText={setHourlyRateInput}
                  keyboardType="decimal-pad"
                  placeholder={t("profile.settings.hourly.placeholder")}
                  placeholderTextColor={palette.textMuted}
                  style={[
                    styles.input,
                    {
                      borderColor: palette.border,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    },
                  ]}
                />
              </View>

              <View style={styles.settingTextBlock}>
                <ThemedText type="defaultSemiBold">
                  {t("profile.settings.sports.title")}
                </ThemedText>
                <ThemedText style={{ color: palette.textMuted }}>
                  {t("profile.settings.sports.description")}
                </ThemedText>
                <View style={styles.chipGrid}>
                  {SPORT_TYPES.map((sport) => {
                    const selected = sportsDraft.includes(sport);
                    return (
                      <SelectChip
                        key={sport}
                        label={toSportLabel(sport)}
                        selected={selected}
                        onPress={() => {
                          toggleSport(sport);
                        }}
                        borderColor={palette.border}
                        selectedBorderColor={palette.primary}
                        selectedBackgroundColor={palette.primarySubtle}
                        selectedTextColor={palette.primary}
                      />
                    );
                  })}
                </View>
              </View>

              <View style={styles.settingTextBlock}>
                <ThemedText type="defaultSemiBold">
                  {t("profile.settings.location.title")}
                </ThemedText>
                <ThemedText style={{ color: palette.textMuted }}>
                  {t("profile.settings.location.instructorDescription")}
                </ThemedText>
                <TextInput
                  value={instructorAddressInput}
                  onChangeText={(value) => {
                    setInstructorAddressInput(value);
                    setInstructorLatitude(undefined);
                    setInstructorLongitude(undefined);
                    setInstructorDetectedZone(null);
                    setIncludeDetectedZone(false);
                  }}
                  placeholder={t("profile.settings.location.addressPlaceholder")}
                  placeholderTextColor={palette.textMuted}
                  style={[
                    styles.input,
                    {
                      borderColor: palette.border,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    },
                  ]}
                />
                <View style={styles.actionRow}>
                  <BrandButton
                    label={
                      instructorLocationResolver.isResolving
                        ? t("profile.settings.location.resolvingAddress")
                        : t("profile.settings.location.findByAddress")
                    }
                    variant="secondary"
                    onPress={() => {
                      void resolveInstructorByAddress();
                    }}
                    disabled={instructorLocationResolver.isResolving}
                  />
                  <BrandButton
                    label={
                      instructorLocationResolver.isResolving
                        ? t("profile.settings.location.resolvingGps")
                        : t("profile.settings.location.useGps")
                    }
                    variant="secondary"
                    onPress={() => {
                      void resolveInstructorByGps();
                    }}
                    disabled={instructorLocationResolver.isResolving}
                  />
                </View>
                <View
                  style={[
                    styles.locationBadge,
                    {
                      borderColor: instructorDetectedZone ? palette.primary : palette.border,
                      backgroundColor: instructorDetectedZone
                        ? palette.primarySubtle
                        : palette.surface,
                    },
                  ]}
                >
                  <ThemedText
                    style={{
                      color: instructorDetectedZone ? palette.primary : palette.textMuted,
                    }}
                  >
                    {instructorDetectedZone
                      ? t("profile.settings.location.detectedZone", {
                          zone: findZoneLabel(instructorDetectedZone, languageCode),
                        })
                      : t("profile.settings.location.zoneNotDetected")}
                  </ThemedText>
                </View>
                {instructorDetectedZone ? (
                  <View style={styles.settingRow}>
                    <View style={styles.settingTextBlock}>
                      <ThemedText type="defaultSemiBold">
                        {t("profile.settings.location.includeDetectedZone")}
                      </ThemedText>
                      <ThemedText style={{ color: palette.textMuted }}>
                        {t("profile.settings.location.includeDetectedZoneDescription")}
                      </ThemedText>
                    </View>
                    <Switch
                      value={includeDetectedZone}
                      onValueChange={setIncludeDetectedZone}
                      trackColor={{
                        false: palette.border,
                        true: palette.primary,
                      }}
                    />
                  </View>
                ) : null}
              </View>

              <View style={styles.settingTextBlock}>
                <ThemedText type="defaultSemiBold">
                  {t("profile.settings.calendar.title")}
                </ThemedText>
                <ThemedText style={{ color: palette.textMuted }}>
                  {t("profile.settings.calendar.description")}
                </ThemedText>
                <View style={styles.chipGrid}>
                  {(Object.keys(CALENDAR_PROVIDER_KEYS) as CalendarProvider[]).map(
                    (provider) => (
                      <SelectChip
                        key={provider}
                        label={t(CALENDAR_PROVIDER_KEYS[provider])}
                        selected={calendarProvider === provider}
                        onPress={() => {
                          setCalendarProvider(provider);
                          if (provider === "none") {
                            setCalendarSyncEnabled(false);
                          }
                        }}
                        borderColor={palette.border}
                        selectedBorderColor={palette.primary}
                        selectedBackgroundColor={palette.primarySubtle}
                        selectedTextColor={palette.primary}
                      />
                    ),
                  )}
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingTextBlock}>
                    <ThemedText type="defaultSemiBold">
                      {t("profile.settings.calendar.autoSync")}
                    </ThemedText>
                    <ThemedText style={{ color: palette.textMuted }}>
                      {t("profile.settings.calendar.futureNote")}
                    </ThemedText>
                  </View>
                  <Switch
                    value={calendarSyncEnabled}
                    onValueChange={setCalendarSyncEnabled}
                    disabled={calendarProvider === "none"}
                    trackColor={{
                      false: palette.border,
                      true: palette.primary,
                    }}
                  />
                </View>

                {instructorSettings.calendarConnectedAt ? (
                  <ThemedText style={{ color: palette.textMuted }}>
                    {t("profile.settings.calendar.lastConnected", {
                      date: new Date(instructorSettings.calendarConnectedAt).toLocaleDateString(
                        i18n.resolvedLanguage ?? "en",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        },
                      ),
                    })}
                  </ThemedText>
                ) : null}
              </View>

              {errorMessage ? (
                <ThemedText style={{ color: palette.danger }}>{errorMessage}</ThemedText>
              ) : null}
              {statusMessage ? (
                <ThemedText style={{ color: palette.success }}>{statusMessage}</ThemedText>
              ) : null}

              <BrandButton
                label={
                  isSaving
                    ? t("profile.settings.actions.saving")
                    : t("profile.settings.actions.save")
                }
                onPress={() => {
                  void onSaveInstructorSettings();
                }}
                disabled={isSaving || !hasUnsavedInstructorChanges}
              />
            </>
          )}
        </BrandSurface>
      ) : (
        <BrandSurface>
          <ThemedText type="subtitle">{t("profile.settings.studioTitle")}</ThemedText>

          {studioSettings === undefined ? (
            <ThemedText style={{ color: palette.textMuted }}>
              {t("profile.settings.loading")}
            </ThemedText>
          ) : studioSettings === null ? (
            <ThemedText style={{ color: palette.textMuted }}>
              {t("profile.settings.unavailable")}
            </ThemedText>
          ) : (
            <>
              <View style={styles.settingTextBlock}>
                <ThemedText type="defaultSemiBold">
                  {t("profile.settings.location.studioDescription")}
                </ThemedText>
                <TextInput
                  value={studioNameInput}
                  onChangeText={setStudioNameInput}
                  placeholder={t("onboarding.studioName")}
                  placeholderTextColor={palette.textMuted}
                  style={[
                    styles.input,
                    {
                      borderColor: palette.border,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    },
                  ]}
                />
                <TextInput
                  value={studioAddressInput}
                  onChangeText={(value) => {
                    setStudioAddressInput(value);
                    setStudioZoneInput(null);
                    setStudioLatitude(undefined);
                    setStudioLongitude(undefined);
                  }}
                  placeholder={t("profile.settings.location.addressPlaceholder")}
                  placeholderTextColor={palette.textMuted}
                  style={[
                    styles.input,
                    {
                      borderColor: palette.border,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    },
                  ]}
                />
                <TextInput
                  value={studioContactPhoneInput}
                  onChangeText={setStudioContactPhoneInput}
                  placeholder={t("onboarding.phoneOptional")}
                  placeholderTextColor={palette.textMuted}
                  style={[
                    styles.input,
                    {
                      borderColor: palette.border,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    },
                  ]}
                />
                <View style={styles.actionRow}>
                  <BrandButton
                    label={
                      studioLocationResolver.isResolving
                        ? t("profile.settings.location.resolvingAddress")
                        : t("profile.settings.location.findByAddress")
                    }
                    variant="secondary"
                    onPress={() => {
                      void resolveStudioByAddress();
                    }}
                    disabled={studioLocationResolver.isResolving}
                  />
                  <BrandButton
                    label={
                      studioLocationResolver.isResolving
                        ? t("profile.settings.location.resolvingGps")
                        : t("profile.settings.location.useGps")
                    }
                    variant="secondary"
                    onPress={() => {
                      void resolveStudioByGps();
                    }}
                    disabled={studioLocationResolver.isResolving}
                  />
                </View>
                <View
                  style={[
                    styles.locationBadge,
                    {
                      borderColor: studioZoneInput ? palette.primary : palette.border,
                      backgroundColor: studioZoneInput
                        ? palette.primarySubtle
                        : palette.surface,
                    },
                  ]}
                >
                  <ThemedText
                    style={{
                      color: studioZoneInput ? palette.primary : palette.textMuted,
                    }}
                  >
                    {studioZoneInput
                      ? t("profile.settings.location.detectedZone", {
                          zone: findZoneLabel(studioZoneInput, languageCode),
                        })
                      : t("profile.settings.location.zoneNotDetected")}
                  </ThemedText>
                </View>
              </View>

              {errorMessage ? (
                <ThemedText style={{ color: palette.danger }}>{errorMessage}</ThemedText>
              ) : null}
              {statusMessage ? (
                <ThemedText style={{ color: palette.success }}>{statusMessage}</ThemedText>
              ) : null}

              <BrandButton
                label={
                  isSaving
                    ? t("profile.settings.actions.saving")
                    : t("profile.settings.actions.save")
                }
                onPress={() => {
                  void onSaveStudioSettings();
                }}
                disabled={isSaving || !hasUnsavedStudioChanges}
              />
            </>
          )}
        </BrandSurface>
      )}

      <BrandSurface>
        <ThemedText type="subtitle">{t("profile.signOut.title")}</ThemedText>
        <ThemedText style={{ color: palette.textMuted }}>
          {t("profile.signOut.description")}
        </ThemedText>
        <View
          style={[
            styles.signOutButtonWrap,
            {
              borderColor: palette.danger,
              borderRadius: BrandRadius.button,
            },
          ]}
        >
          <BrandButton
            label={t("auth.signOutButton")}
            variant="secondary"
            onPress={() => {
              void signOut();
            }}
          />
        </View>
      </BrandSurface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 22,
    gap: 14,
  },
  headerBlock: {
    gap: 6,
  },
  unsavedBanner: {
    borderRadius: 14,
    borderCurve: "continuous",
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  unsavedBannerText: {
    gap: 2,
  },
  unsavedBannerButton: {
    minHeight: 46,
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
  },
  summaryRow: {
    gap: 2,
  },
  languageRow: {
    flexDirection: "row",
    gap: 8,
  },
  languageButton: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  settingTextBlock: {
    gap: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: BrandRadius.pill,
    borderCurve: "continuous",
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  locationBadge: {
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  signOutButtonWrap: {
    borderWidth: 1,
    borderCurve: "continuous",
    borderRadius: BrandRadius.button,
    overflow: "hidden",
  },
});
