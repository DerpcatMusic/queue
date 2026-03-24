import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, TextInput, View } from "react-native";

import { LoadingScreen } from "@/components/loading-screen";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
} from "@/components/profile/profile-settings-sections";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
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
import {
  fetchPlaceByZipCode,
  type PlaceCoordinates,
  type ZipCodeResult,
} from "@/lib/google-places";
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

function hasContent(str: string | undefined | null) {
  return str !== undefined && str !== null && str.trim().length > 0;
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text
      className="mb-1"
      style={{
        fontFamily: "Rubik_500Medium",
        fontSize: 12,
        letterSpacing: 0.6,
        textTransform: "uppercase",
      }}
    >
      {children}
    </Text>
  );
}

function ManualField({
  value,
  onChangeText,
  placeholder,
  palette,
  keyboardType = "default",
  autoCapitalize = "words",
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  palette: ReturnType<typeof useBrand>;
  keyboardType?: "default" | "numeric" | "email-address";
  autoCapitalize?: "none" | "words" | "sentences";
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={palette.textMuted as string}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      selectionColor={palette.primary as string}
      cursorColor={palette.primary as string}
      className="rounded-lg px-3"
      style={{
        borderWidth: 1,
        borderColor: palette.border as string,
        backgroundColor: palette.surfaceElevated as string,
        minHeight: BrandSpacing.iconContainer + BrandSpacing.xs,
        color: palette.text as string,
        fontFamily: "Rubik_400Regular",
        fontSize: BrandType.body.fontSize,
        lineHeight: 22,
      }}
    />
  );
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

  // Search address bar
  const [addressInput, setAddressInput] = useState("");

  // Structured fields — auto-filled from search/GPS, editable when manual mode
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [floor, setFloor] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Manual entry mode
  const [manualMode, setManualMode] = useState(false);

  // Shared location state
  const [latitude, setLatitude] = useState<number>();
  const [longitude, setLongitude] = useState<number>();
  const [detectedZone, setDetectedZone] = useState<string | null>(null);
  const [detectedZoneLabel, setDetectedZoneLabel] = useState<string | null>(null);
  const [includeDetectedZone, setIncludeDetectedZone] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  // Zip lookup state
  const [zipResults, setZipResults] = useState<ZipCodeResult[]>([]);
  const [isSearchingZip, setIsSearchingZip] = useState(false);
  const [showZipResults, setShowZipResults] = useState(false);

  useEffect(() => {
    if (instructorSettings && !seeded) {
      setAddressInput(instructorSettings.address ?? "");
      setCity(instructorSettings.addressCity ?? "");
      setStreet(instructorSettings.addressStreet ?? "");
      setStreetNumber(instructorSettings.addressNumber ?? "");
      setFloor(instructorSettings.addressFloor ?? "");
      setPostalCode(instructorSettings.addressPostalCode ?? "");
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
      if (cancelled) return;
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
    setCity(resolved.city ?? "");
    setStreet(resolved.street ?? "");
    setStreetNumber(resolved.streetNumber ?? "");
    setPostalCode(resolved.postalCode ?? "");
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
        ...(coords.city !== undefined ? { city: coords.city } : {}),
        ...(coords.street !== undefined ? { street: coords.street } : {}),
        ...(coords.streetNumber !== undefined ? { streetNumber: coords.streetNumber } : {}),
        ...(coords.postalCode !== undefined ? { postalCode: coords.postalCode } : {}),
      });
      void resolveZoneFromCoordinates({ latitude: coords.latitude, longitude: coords.longitude });
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

  const applyZipResult = useCallback(
    (result: ZipCodeResult) => {
      setCity(result.city ?? "");
      setStreet(result.street ?? "");
      setStreetNumber(result.streetNumber ?? "");
      setPostalCode(result.postalCode ?? "");
      setAddressInput(result.formattedAddress);
      setLatitude(result.latitude);
      setLongitude(result.longitude);
      setZipResults([]);
      setShowZipResults(false);
      setErrorMessage(null);
      void resolveZoneFromCoordinates({ latitude: result.latitude, longitude: result.longitude });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolveZoneFromCoordinates],
  );

  const handleZipCodeLookup = useCallback(async () => {
    const cleaned = postalCode.replace(/\s+/g, "").trim();
    if (cleaned.length < 5) return;
    setIsSearchingZip(true);
    setShowZipResults(false);
    setErrorMessage(null);
    try {
      const results = await fetchPlaceByZipCode(cleaned);
      setZipResults(results);
      setShowZipResults(true);
      if (results.length === 0) {
        setErrorMessage(t("profile.location.zipNotFound"));
      }
    } catch {
      setErrorMessage(t("profile.settings.errors.locationResolveFailed"));
    } finally {
      setIsSearchingZip(false);
    }
  }, [postalCode, t]);

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
  const hasDetectedZone = Boolean(detectedZone);

  // Show structured summary when we have data from search/GPS but NOT in manual mode
  const showStructuredSummary =
    !manualMode &&
    (hasContent(city) || hasContent(street) || hasContent(streetNumber) || hasContent(postalCode));

  const hasLocationChanges =
    trimmedAddressInput !== initialAddress ||
    latitude !== instructorSettings.latitude ||
    longitude !== instructorSettings.longitude ||
    city !== (instructorSettings.addressCity ?? "") ||
    street !== (instructorSettings.addressStreet ?? "") ||
    streetNumber !== (instructorSettings.addressNumber ?? "") ||
    floor !== (instructorSettings.addressFloor ?? "") ||
    postalCode !== (instructorSettings.addressPostalCode ?? "");
  const hasZoneAssignment = hasDetectedZone && includeDetectedZone;
  const hasChanges = hasLocationChanges || hasZoneAssignment;

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
        ...(city.trim() ? { addressCity: city.trim() } : {}),
        ...(street.trim() ? { addressStreet: street.trim() } : {}),
        ...(streetNumber.trim() ? { addressNumber: streetNumber.trim() } : {}),
        ...(floor.trim() ? { addressFloor: floor.trim() } : {}),
        ...(postalCode.trim() ? { addressPostalCode: postalCode.trim() } : {}),
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

  // --- Render helpers ---
  const renderStructuredRow = (label: string, value: string) => {
    if (!value) return null;
    return (
      <View className="flex-row items-center gap-2">
        <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>{label}</Text>
        <Text style={{ ...BrandType.body, color: palette.text as string }}>{value}</Text>
      </View>
    );
  };

  return (
    <View className="flex-1 relative" style={{ backgroundColor: palette.appBg }}>
      <ProfileSubpageScrollView
        routeKey="instructor/profile/location"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.inset,
          paddingBottom: overlayBottom + 92,
          gap: BrandSpacing.md,
        }}
      >
        {/* ── Address section ── */}
        <ProfileSectionHeader
          label={t("profile.location.addressTitle")}
          icon="mappin.and.ellipse"
          palette={palette}
          flush
        />

        {/* Search bar */}
        <View className="gap-2">
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

          {/* GPS secondary action */}
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

        {/* Structured address summary — auto-filled from search/GPS */}
        {showStructuredSummary ? (
          <View
            className="gap-1 px-3 py-3 rounded-lg"
            style={{ backgroundColor: palette.surfaceElevated as string }}
          >
            {renderStructuredRow(`${t("profile.location.fieldCity")}:`, city)}
            {renderStructuredRow(
              `${t("profile.location.fieldStreet")}:`,
              street ? `${streetNumber ?? ""} ${street}`.trim() : "",
            )}
            {hasContent(floor)
              ? renderStructuredRow(`${t("profile.location.fieldFloor")}:`, floor)
              : null}
            {hasContent(postalCode)
              ? renderStructuredRow(`${t("profile.location.fieldZipCode")}:`, postalCode)
              : null}
          </View>
        ) : null}

        {/* Structured fields — editable in manual mode */}
        {manualMode ? (
          <View className="gap-2">
            {/* Row: city + street */}
            <View className="flex-row gap-2">
              <View className="flex-1 gap-1">
                <FieldLabel>{t("profile.location.fieldCity")}</FieldLabel>
                <ManualField
                  value={city}
                  onChangeText={setCity}
                  placeholder={t("profile.location.fieldCityPlaceholder")}
                  palette={palette}
                />
              </View>
              <View className="flex-1 gap-1">
                <FieldLabel>{t("profile.location.fieldStreet")}</FieldLabel>
                <ManualField
                  value={street}
                  onChangeText={setStreet}
                  placeholder={t("profile.location.fieldStreetPlaceholder")}
                  palette={palette}
                />
              </View>
            </View>

            {/* Row: number + floor + zip */}
            <View className="flex-row gap-2">
              <View className="w-20 gap-1">
                <FieldLabel>{t("profile.location.fieldNumber")}</FieldLabel>
                <ManualField
                  value={streetNumber}
                  onChangeText={setStreetNumber}
                  placeholder="-"
                  palette={palette}
                />
              </View>
              <View className="w-20 gap-1">
                <FieldLabel>{t("profile.location.fieldFloor")}</FieldLabel>
                <ManualField
                  value={floor}
                  onChangeText={setFloor}
                  placeholder="-"
                  palette={palette}
                />
              </View>
              <View className="flex-1 gap-1">
                <FieldLabel>{t("profile.location.fieldZipCode")}</FieldLabel>
                <ManualField
                  value={postalCode}
                  onChangeText={setPostalCode}
                  placeholder="-"
                  palette={palette}
                  keyboardType="numeric"
                  autoCapitalize="none"
                />
              </View>
            </View>
          </View>
        ) : null}

        {/* Secondary actions row */}
        <View className="flex-row gap-3 items-center">
          {!manualMode ? (
            <Pressable onPress={() => setManualMode(true)} className="flex-row items-center gap-1">
              <IconSymbol
                name="pencil"
                size={BrandType.caption.fontSize - 1}
                color={palette.primary as string}
              />
              <Text style={{ ...BrandType.caption, color: palette.primary as string }}>
                {t("profile.location.enterManually")}
              </Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setManualMode(false)} className="flex-row items-center gap-1">
              <IconSymbol
                name="magnifyingglass"
                size={BrandType.caption.fontSize - 1}
                color={palette.primary as string}
              />
              <Text style={{ ...BrandType.caption, color: palette.primary as string }}>
                {t("profile.location.backToSearch")}
              </Text>
            </Pressable>
          )}

          {manualMode && (
            <>
              <View className="h-3 w-px" style={{ backgroundColor: palette.border as string }} />
              <Pressable
                onPress={() => {
                  void handleZipCodeLookup();
                }}
                disabled={postalCode.trim().length < 5 || isSearchingZip}
                className="flex-row items-center gap-1"
              >
                <IconSymbol
                  name={isSearchingZip ? "arrow.2.squarepath" : "number"}
                  size={BrandType.caption.fontSize - 1}
                  color={
                    postalCode.trim().length < 5
                      ? (palette.textMuted as string)
                      : (palette.primary as string)
                  }
                />
                <Text
                  style={{
                    ...BrandType.caption,
                    color:
                      postalCode.trim().length < 5
                        ? (palette.textMuted as string)
                        : (palette.primary as string),
                  }}
                >
                  {t("profile.location.findByZip")}
                </Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Zip lookup results */}
        {showZipResults && zipResults.length > 0 ? (
          <View
            className="overflow-hidden rounded-lg"
            style={{ borderWidth: 1, borderColor: palette.border as string }}
          >
            {zipResults.slice(0, 5).map((result) => (
              <Pressable
                key={`${result.latitude}-${result.longitude}`}
                onPress={() => {
                  applyZipResult(result);
                  setManualMode(false);
                }}
                className="px-3 py-2"
                style={({ pressed }) => ({
                  backgroundColor: pressed
                    ? (palette.primarySubtle as string)
                    : (palette.surfaceElevated as string),
                  borderBottomWidth: 1,
                  borderBottomColor: palette.border as string,
                })}
              >
                <Text
                  numberOfLines={1}
                  style={{ ...BrandType.bodyMedium, color: palette.text as string }}
                >
                  {result.street
                    ? `${result.streetNumber ?? ""} ${result.street}`.trim()
                    : result.formattedAddress.split(",")[0]}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ ...BrandType.caption, color: palette.textMuted as string }}
                >
                  {[result.city, result.postalCode].filter(Boolean).join(" · ")}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* ── Zone section ── */}
        <ProfileSectionHeader
          label={t("profile.location.zoneLabel")}
          icon="checkmark.circle.fill"
          palette={palette}
          flush
        />

        <ProfileSectionCard palette={palette} style={{ marginHorizontal: 0 }}>
          <View className="px-4 py-3 gap-2">
            {/* Zone status row */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: hasDetectedZone
                      ? (palette.primary as string)
                      : (palette.textMuted as string),
                  }}
                />
                <Text style={{ ...BrandType.body, color: palette.text as string }}>
                  {zoneDisplayValue}
                </Text>
              </View>
              {hasDetectedZone ? (
                <KitSwitch value={includeDetectedZone} onValueChange={setIncludeDetectedZone} />
              ) : null}
            </View>

            {!hasDetectedZone ? (
              <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                {t("profile.location.zonePendingBody")}
              </Text>
            ) : (
              <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                {t("profile.settings.location.includeDetectedZoneDescription")}
              </Text>
            )}
          </View>
        </ProfileSectionCard>

        {/* Error */}
        {errorMessage ? (
          <View
            className="rounded-lg px-4 py-3"
            style={{
              borderWidth: 1,
              borderColor: palette.danger as string,
              backgroundColor: palette.dangerSubtle as string,
            }}
          >
            <Text style={{ ...BrandType.body, color: palette.danger as string }}>
              {errorMessage}
            </Text>
          </View>
        ) : null}
      </ProfileSubpageScrollView>

      {/* Save rail */}
      <View
        className="absolute left-inset right-inset gap-2"
        style={{ bottom: overlayBottom, backgroundColor: palette.appBg as string }}
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
