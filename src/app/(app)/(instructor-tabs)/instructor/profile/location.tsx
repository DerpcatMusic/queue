import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
import { StatusSignal } from "@/components/profile/status-signal";
import { ActionButton } from "@/components/ui/action-button";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSwitch } from "@/components/ui/kit";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";
import { useLocationResolution } from "@/hooks/use-location-resolution";
import type { PlaceCoordinates } from "@/lib/google-places";
import { getLocationResolveErrorMessage } from "@/lib/location-error-message";
import type { ResolvedLocation } from "@/lib/location-zone";

let zoneLabelByIdPromise: Promise<Map<string, { en: string; he: string }>> | null = null;

async function getZoneLabelById(zoneId: string, language: "en" | "he"): Promise<string> {
  if (!zoneLabelByIdPromise) {
    zoneLabelByIdPromise = import("@/constants/zones").then((module) => {
      return new Map(module.ZONE_OPTIONS.map((zone) => [zone.id, zone.label] as const));
    });
  }

  const labelsByZoneId = await zoneLabelByIdPromise;
  return labelsByZoneId.get(zoneId)?.[language] ?? zoneId;
}

function formatCoordinateLabel(latitude?: number, longitude?: number) {
  if (latitude === undefined || longitude === undefined) {
    return null;
  }

  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

export default function LocationScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const router = useRouter();
  const { overlayBottom } = useAppInsets();
  const { currentUser } = useUser();
  const languageCode = (i18n.resolvedLanguage ?? "en") as "en" | "he";
  useProfileSubpageSheet({
    title: t("profile.navigation.location"),
    routeMatchPath: "/profile/location",
  });

  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const saveInstructor = useMutation(api.users.updateMyInstructorSettings);
  const locationResolver = useLocationResolution();

  const [addressInput, setAddressInput] = useState("");
  const [latitude, setLatitude] = useState<number>();
  const [longitude, setLongitude] = useState<number>();
  const [detectedZone, setDetectedZone] = useState<string | null>(null);
  const [detectedZoneLabel, setDetectedZoneLabel] = useState<string | null>(null);
  const [includeDetectedZone, setIncludeDetectedZone] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (instructorSettings && !seeded) {
      setAddressInput(instructorSettings.address ?? "");
      setLatitude(instructorSettings.latitude);
      setLongitude(instructorSettings.longitude);
      setSeeded(true);
    }
  }, [instructorSettings, seeded]);

  useEffect(() => {
    if (!detectedZone) {
      setDetectedZoneLabel(null);
      return;
    }

    let cancelled = false;
    void getZoneLabelById(detectedZone, languageCode).then((label) => {
      if (cancelled) {
        return;
      }
      setDetectedZoneLabel(label);
    });

    return () => {
      cancelled = true;
    };
  }, [detectedZone, languageCode]);

  const clearDetectedZone = useCallback(() => {
    setDetectedZone(null);
    setIncludeDetectedZone(false);
  }, []);

  const applyResolution = useCallback((resolved: ResolvedLocation) => {
    setAddressInput(resolved.address);
    setLatitude(resolved.latitude);
    setLongitude(resolved.longitude);
    setErrorMessage(null);
  }, []);

  const resolveZoneFromCoordinates = useCallback(
    async (coords: { latitude: number; longitude: number }) => {
      const result = await locationResolver.resolveFromCoordinates(coords);

      if (!result.ok) {
        clearDetectedZone();
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

      const zoneId = result.data.value.zoneId ?? null;
      if (!zoneId) {
        clearDetectedZone();
        return;
      }

      setDetectedZone(zoneId);
      setIncludeDetectedZone(true);
      setErrorMessage(null);
    },
    [clearDetectedZone, locationResolver, t],
  );

  const handlePlaceSelected = useCallback(
    (coords: PlaceCoordinates) => {
      applyResolution({
        address: coords.formattedAddress,
        latitude: coords.latitude,
        longitude: coords.longitude,
        zoneId: "",
      });
      void resolveZoneFromCoordinates({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    },
    [applyResolution, resolveZoneFromCoordinates],
  );

  const handleAddressChange = useCallback(
    (value: string) => {
      setAddressInput(value);
      setLatitude(undefined);
      setLongitude(undefined);
      clearDetectedZone();
      setErrorMessage(null);
    },
    [clearDetectedZone],
  );

  const resolveByGps = useCallback(async () => {
    const result = await locationResolver.resolveFromGps();
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

    applyResolution(result.data.value);
    if (result.data.value.zoneId) {
      setDetectedZone(result.data.value.zoneId);
      setIncludeDetectedZone(true);
      return;
    }

    clearDetectedZone();
  }, [applyResolution, clearDetectedZone, locationResolver, t]);

  if (instructorSettings === undefined) {
    return <LoadingScreen label={t("profile.settings.loading")} />;
  }
  if (instructorSettings === null) {
    return <LoadingScreen label={t("profile.settings.unavailable")} />;
  }

  const trimmedAddressInput = addressInput.trim();
  const initialAddress = instructorSettings.address?.trim() ?? "";
  const coordinateLabel = formatCoordinateLabel(latitude, longitude);
  const hasAddress = trimmedAddressInput.length > 0;
  const hasDetectedZone = Boolean(detectedZone);
  const hasLocationChanges =
    trimmedAddressInput !== initialAddress ||
    latitude !== instructorSettings.latitude ||
    longitude !== instructorSettings.longitude;
  const hasZoneAssignment = hasDetectedZone && includeDetectedZone;
  const hasChanges = hasLocationChanges || hasZoneAssignment;

  const heroTitle = hasDetectedZone
    ? t("profile.location.heroReady")
    : hasAddress
      ? t("profile.location.heroPending")
      : t("profile.location.heroMissing");
  const heroBody = hasDetectedZone
    ? t("profile.location.heroReadyBody")
    : hasAddress
      ? t("profile.location.heroPendingBody")
      : t("profile.location.heroMissingBody");
  const zoneDisplayValue = detectedZone
    ? (detectedZoneLabel ?? detectedZone)
    : t("profile.settings.location.zoneNotDetected");

  const onSave = async () => {
    if (!hasChanges) {
      router.back();
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await saveInstructor({
        notificationsEnabled: instructorSettings.notificationsEnabled,
        sports: instructorSettings.sports,
        calendarProvider: instructorSettings.calendarProvider,
        calendarSyncEnabled: instructorSettings.calendarSyncEnabled,
        ...(instructorSettings.hourlyRateExpectation !== undefined
          ? { hourlyRateExpectation: instructorSettings.hourlyRateExpectation }
          : {}),
        ...(trimmedAddressInput ? { address: trimmedAddressInput } : {}),
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
        includeDetectedZone,
        ...(detectedZone ? { detectedZone } : {}),
      });
      router.back();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t("profile.settings.errors.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View className="flex-1 relative" style={{ backgroundColor: palette.appBg }}>
      <ProfileSubpageScrollView
        routeKey="instructor/profile/location"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.inset,
          paddingBottom: overlayBottom + 92,
          gap: BrandSpacing.stackRoomy,
        }}
      >
        <View
          className="gap-stack-roomy rounded-soft p-inset-roomy"
          style={{
            backgroundColor: palette.surfaceAlt as string,
            borderColor: palette.border as string,
            borderWidth: 1,
            borderCurve: "continuous",
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
                {t("profile.settings.location.title").toUpperCase()}
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
              style={[
                {
                  width: BrandSpacing.avatarMd,
                  height: BrandSpacing.avatarMd,
                  borderWidth: 1,
                  borderCurve: "continuous",
                  borderColor: palette.border as string,
                  backgroundColor: palette.primarySubtle as string,
                },
              ]}
            >
              <IconSymbol name="mappin.and.ellipse" size={22} color={palette.primary as string} />
            </View>
          </View>

          <View className="flex-row gap-stack-tight">
            <StatusSignal
              label={t("profile.location.signalAddress")}
              value={
                hasAddress
                  ? t("profile.location.signalAddressReady")
                  : t("profile.location.signalAddressMissing")
              }
              palette={palette}
            />
            <StatusSignal
              label={t("profile.location.signalZone")}
              value={hasDetectedZone ? zoneDisplayValue : t("common.pending")}
              palette={palette}
              tone={hasDetectedZone ? "accent" : "surface"}
            />
          </View>
        </View>

        <View className="gap-stack-tight">
          <ProfileSectionHeader
            label={t("profile.location.commandLabel")}
            description={t("profile.settings.location.instructorDescription")}
            icon="mappin.and.ellipse"
            palette={palette}
            flush
          />
          <ProfileSectionCard palette={palette} style={{ marginHorizontal: 0 }}>
            <View className="gap-stack-roomy p-inset-roomy">
              <View className="gap-stack-tight">
                <Text
                  style={{
                    ...BrandType.title,
                    color: palette.text as string,
                  }}
                >
                  {t("profile.location.addressTitle")}
                </Text>
                <Text
                  style={{
                    ...BrandType.caption,
                    color: palette.textMuted as string,
                  }}
                >
                  {t("profile.location.addressBody")}
                </Text>
              </View>

              <AddressAutocomplete
                value={addressInput}
                onChangeText={handleAddressChange}
                onPlaceSelected={handlePlaceSelected}
                placeholder={t("profile.settings.location.addressPlaceholder")}
                placeholderTextColor={palette.textMuted}
                borderColor={palette.border}
                textColor={palette.text}
                backgroundColor={palette.surfaceElevated}
                surfaceColor={palette.surfaceElevated}
                mutedTextColor={palette.textMuted}
              />

              <ActionButton
                label={
                  locationResolver.isResolving
                    ? t("profile.settings.location.resolvingGps")
                    : t("profile.settings.location.useGps")
                }
                onPress={() => {
                  void resolveByGps();
                }}
                disabled={locationResolver.isResolving}
                palette={palette}
                tone="secondary"
                fullWidth
              />

              {coordinateLabel ? (
                <View
                  className="gap-stack-tight rounded-medium px-control-x py-control-y"
                  style={{
                    borderWidth: 1,
                    borderCurve: "continuous",
                    borderColor: palette.border as string,
                    backgroundColor: palette.surfaceElevated as string,
                  }}
                >
                  <Text
                    style={{
                      ...BrandType.micro,
                      color: palette.textMuted as string,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                    }}
                  >
                    {t("profile.location.coordinatesLabel")}
                  </Text>
                  <Text
                    style={{
                      ...BrandType.bodyMedium,
                      color: palette.text as string,
                    }}
                  >
                    {coordinateLabel}
                  </Text>
                </View>
              ) : null}
            </View>
          </ProfileSectionCard>
        </View>

        <View className="gap-stack-tight">
          <ProfileSectionHeader
            label={t("profile.location.zoneLabel")}
            description={t("profile.location.zoneDescription")}
            icon="checkmark.circle.fill"
            palette={palette}
            flush
          />
          <ProfileSectionCard palette={palette} style={{ marginHorizontal: 0 }}>
            <View className="gap-stack-roomy p-inset-roomy">
              <View
                className="gap-stack-tight rounded-medium p-inset"
                style={{
                  borderWidth: 1,
                  borderCurve: "continuous",
                  borderColor: hasDetectedZone
                    ? (palette.primary as string)
                    : (palette.border as string),
                  backgroundColor: hasDetectedZone
                    ? (palette.primarySubtle as string)
                    : (palette.surfaceElevated as string),
                }}
              >
                <Text
                  style={{
                    ...BrandType.micro,
                    color: hasDetectedZone
                      ? (palette.primary as string)
                      : (palette.textMuted as string),
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                  }}
                >
                  {hasDetectedZone
                    ? t("profile.location.zoneDetectedLabel")
                    : t("profile.location.zoneWaitingLabel")}
                </Text>
                <Text
                  style={{
                    ...BrandType.title,
                    color: palette.text as string,
                  }}
                >
                  {zoneDisplayValue}
                </Text>
                <Text
                  style={{
                    ...BrandType.caption,
                    color: palette.textMuted as string,
                  }}
                >
                  {hasDetectedZone
                    ? t("profile.settings.location.includeDetectedZoneDescription")
                    : t("profile.location.zonePendingBody")}
                </Text>
              </View>

              {hasDetectedZone ? (
                <View
                  className="flex-row items-center gap-stack rounded-medium px-control-x py-control-y"
                  style={{
                    borderWidth: 1,
                    borderCurve: "continuous",
                    borderColor: palette.border as string,
                    backgroundColor: palette.surfaceElevated as string,
                  }}
                >
                  <View className="flex-1 gap-stack-tight min-w-0">
                    <Text
                      style={{
                        ...BrandType.bodyStrong,
                        color: palette.text as string,
                      }}
                    >
                      {t("profile.settings.location.includeDetectedZone")}
                    </Text>
                    <Text
                      style={{
                        ...BrandType.caption,
                        color: palette.textMuted as string,
                      }}
                    >
                      {t("profile.settings.location.includeDetectedZoneDescription")}
                    </Text>
                  </View>
                  <KitSwitch value={includeDetectedZone} onValueChange={setIncludeDetectedZone} />
                </View>
              ) : null}
            </View>
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
          disabled={!hasChanges || isSaving}
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
