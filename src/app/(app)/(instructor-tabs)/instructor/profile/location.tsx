import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { KitList, KitListItem, KitSwitchRow } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useBrand } from "@/hooks/use-brand";
import { useLocationResolution } from "@/hooks/use-location-resolution";
import { getLocationResolveErrorMessage } from "@/lib/location-error-message";
import type { ResolvedLocation } from "@/lib/location-zone";

let zoneLabelByIdPromise: Promise<
  Map<string, { en: string; he: string }>
> | null = null;

async function getZoneLabelById(
  zoneId: string,
  language: "en" | "he",
): Promise<string> {
  if (!zoneLabelByIdPromise) {
    zoneLabelByIdPromise = import("@/constants/zones").then((module) => {
      return new Map(
        module.ZONE_OPTIONS.map((zone) => [zone.id, zone.label] as const),
      );
    });
  }

  const labelsByZoneId = await zoneLabelByIdPromise;
  return labelsByZoneId.get(zoneId)?.[language] ?? zoneId;
}

export default function LocationScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const router = useRouter();
  const { currentUser } = useUser();
  const languageCode = (i18n.resolvedLanguage ?? "en") as "en" | "he";

  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const saveInstructor = useMutation(api.users.updateMyInstructorSettings);

  const [addressInput, setAddressInput] = useState("");
  const [latitude, setLatitude] = useState<number>();
  const [longitude, setLongitude] = useState<number>();
  const [detectedZone, setDetectedZone] = useState<string | null>(null);
  const [detectedZoneLabel, setDetectedZoneLabel] = useState<string | null>(
    null,
  );
  const [includeDetectedZone, setIncludeDetectedZone] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
  const screenStyle = useMemo(
    () =>
      StyleSheet.flatten([styles.screen, { backgroundColor: palette.appBg }]),
    [palette.appBg],
  );

  useEffect(() => {
    if (instructorSettings && !seeded) {
      setAddressInput(instructorSettings.address ?? "");
      setLatitude(instructorSettings.latitude);
      setLongitude(instructorSettings.longitude);
      setSeeded(true);
    }
  }, [instructorSettings, seeded]);

  const locationResolver = useLocationResolution();

  useEffect(() => {
    if (!detectedZone) {
      setDetectedZoneLabel(null);
      return;
    }
    let cancelled = false;
    void getZoneLabelById(detectedZone, languageCode).then((label) => {
      if (cancelled) return;
      setDetectedZoneLabel(label);
    });
    return () => {
      cancelled = true;
    };
  }, [detectedZone, languageCode]);

  const applyResolution = useCallback((resolved: ResolvedLocation) => {
    setAddressInput(resolved.address);
    setLatitude(resolved.latitude);
    setLongitude(resolved.longitude);
    setErrorMessage(null);
  }, []);

  const resolveByGps = useCallback(async () => {
    const result = await locationResolver.resolveFromGps();
    if (!result.ok) {
      setErrorMessage(
        getLocationResolveErrorMessage({
          code: result.error.code,
          fallbackMessage: result.error.message,
          fallbackKey: "errors.resolveFailed",
          translationPrefix: "profile.settings.location",
          t,
        }),
      );
      return;
    }
    applyResolution(result.data.value);
    if (result.data.value.zoneId) {
      setDetectedZone(result.data.value.zoneId);
      setIncludeDetectedZone(true);
    }
  }, [locationResolver, applyResolution, t]);

  if (instructorSettings === undefined) {
    return <LoadingScreen label={t("profile.settings.loading")} />;
  }
  if (instructorSettings === null) {
    return <LoadingScreen label={t("profile.settings.unavailable")} />;
  }

  const onSave = async () => {
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
        ...(addressInput.trim() ? { address: addressInput.trim() } : {}),
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
        includeDetectedZone,
        ...(detectedZone ? { detectedZone } : {}),
      });
      router.back();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : t("profile.settings.errors.saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <TabScreenScrollView
      routeKey="instructor/profile"
      style={screenStyle}
      keyboardShouldPersistTaps="handled"
    >
      <KitList inset>
        <KitListItem title={t("profile.settings.location.addressPlaceholder")}>
          <View style={{ gap: 8, marginTop: 8 }}>
            <AddressAutocomplete
              value={addressInput}
              onChangeText={(value) => {
                setAddressInput(value);
                setLatitude(undefined);
                setLongitude(undefined);
                setDetectedZone(null);
                setIncludeDetectedZone(false);
              }}
              onPlaceSelected={(coords) => {
                applyResolution({
                  address: coords.formattedAddress,
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  zoneId: "",
                });
                void locationResolver
                  .resolveFromCoordinates({
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                  })
                  .then((result) => {
                    if (!result.ok || !result.data.value.zoneId) return;
                    setDetectedZone(result.data.value.zoneId);
                    setIncludeDetectedZone(true);
                  });
              }}
              placeholder={t("profile.settings.location.addressPlaceholder")}
              placeholderTextColor={palette.textMuted}
              borderColor={palette.border}
              textColor={palette.text}
              backgroundColor={palette.appBg}
              surfaceColor={palette.surface}
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
          </View>
        </KitListItem>
      </KitList>

      {/* Zone badge */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View
          style={[
            styles.locationBadge,
            {
              borderColor: detectedZone ? palette.primary : palette.border,
              backgroundColor: detectedZone
                ? palette.primarySubtle
                : palette.appBg,
            },
          ]}
        >
          <ThemedText
            style={{
              color: detectedZone ? palette.primary : palette.textMuted,
            }}
          >
            {detectedZone
              ? t("profile.settings.location.detectedZone", {
                  zone: detectedZoneLabel ?? detectedZone,
                })
              : t("profile.settings.location.zoneNotDetected")}
          </ThemedText>
        </View>
      </View>

      {/* Include zone toggle */}
      {detectedZone ? (
        <View style={{ paddingTop: 8 }}>
          <KitList inset>
            <KitSwitchRow
              title={t("profile.settings.location.includeDetectedZone")}
              value={includeDetectedZone}
              onValueChange={setIncludeDetectedZone}
            />
          </KitList>
        </View>
      ) : null}

      {/* Error */}
      {errorMessage ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <ThemedText style={{ color: palette.danger }}>
            {errorMessage}
          </ThemedText>
        </View>
      ) : null}

      {/* Actions */}
      <View
        style={{ paddingHorizontal: 16, paddingTop: BrandSpacing.md, gap: 10 }}
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
          disabled={isSaving}
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
    </TabScreenScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  locationBadge: {
    borderWidth: 1,
    borderRadius: 10,
    borderCurve: "continuous",
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: "center",
  },
});
