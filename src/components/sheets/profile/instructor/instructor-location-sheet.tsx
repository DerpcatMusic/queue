/**
 * Instructor Location Sheet - allows instructors to set their address and coverage zone.
 */

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, TextInput, View } from "react-native";

import { LoadingScreen } from "@/components/loading-screen";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { ProfileSectionHeader } from "@/components/profile/profile-settings-sections";
import { ActionButton } from "@/components/ui/action-button";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useLocationResolution } from "@/hooks/use-location-resolution";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth, FontSize } from "@/lib/design-system";
import { Box } from "@/primitives";
import {
  fetchPlaceByZipCode,
  type PlaceCoordinates,
  type ZipCodeResult,
} from "@/lib/google-places";
import { getLocationResolveErrorMessage } from "@/lib/location-error-message";
import type { ResolvedLocation } from "@/lib/location-zone";
import { showOpenSettingsAlert } from "@/lib/open-settings-alert";

interface InstructorLocationSheetProps {
  visible: boolean;
  onClose: () => void;
}

function hasContent(str: string | undefined | null) {
  return str !== undefined && str !== null && str.trim().length > 0;
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        marginBottom: BrandSpacing.xs,
        fontFamily: "Rubik_500Medium",
        fontSize: FontSize.micro,
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
  keyboardType = "default",
  autoCapitalize = "words",
  textMuted,
  surfaceElevated,
  text,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: "default" | "numeric" | "email-address";
  autoCapitalize?: "none" | "words" | "sentences";
  textMuted: string;
  surfaceElevated: string;
  text: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={textMuted}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      style={{
        flex: 1,
        minHeight: 46,
        borderRadius: BrandRadius.md,
        paddingHorizontal: BrandSpacing.md,
        paddingVertical: BrandSpacing.sm,
        backgroundColor: surfaceElevated,
        color: text,
        fontSize: FontSize.body,
      }}
    />
  );
}

export function InstructorLocationSheet({ visible, onClose }: InstructorLocationSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { overlayBottom } = useAppInsets();
  const { currentUser } = useUser();
  const locationResolver = useLocationResolution();
  const { color: palette } = theme;

  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const saveInstructor = useMutation(api.users.updateMyInstructorSettings);

  // Address state
  const [addressInput, setAddressInput] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [floor, setFloor] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);

  // Zone state
  const [detectedZone, setDetectedZone] = useState<string | null>(null);
  const [detectedZoneLabel, setDetectedZoneLabel] = useState<string | null>(null);
  const [includeDetectedZone, setIncludeDetectedZone] = useState(false);

  // UI state
  const [manualMode, setManualMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [zipResults, setZipResults] = useState<ZipCodeResult[]>([]);
  const [showZipResults, setShowZipResults] = useState(false);
  const [isSearchingZip, setIsSearchingZip] = useState(false);

  // Initialize from instructorSettings
  useEffect(() => {
    if (instructorSettings) {
      setAddressInput(instructorSettings.address ?? "");
      setCity(instructorSettings.addressCity ?? "");
      setStreet(instructorSettings.addressStreet ?? "");
      setStreetNumber(instructorSettings.addressNumber ?? "");
      setFloor(instructorSettings.addressFloor ?? "");
      setPostalCode(instructorSettings.addressPostalCode ?? "");
      setLatitude(instructorSettings.latitude);
      setLongitude(instructorSettings.longitude);
    }
  }, [instructorSettings]);

  // Zone label resolution
  useEffect(() => {
    if (!detectedZone) {
      setDetectedZoneLabel(null);
      return;
    }
    const language = (t("common.language") === "he" ? "he" : "en") as "en" | "he";
    import("@/constants/zones").then((module) => {
      const zone = module.ZONE_OPTIONS.find((z) => z.id === detectedZone);
      const label = zone ? (zone.label as Record<"en" | "he", string>)[language] : null;
      setDetectedZoneLabel(label ?? null);
    });
  }, [detectedZone, t]);

  const clearDetectedZone = useCallback(() => {
    setDetectedZone(null);
    setDetectedZoneLabel(null);
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
      if (result.error.code === "permission_blocked") {
        showOpenSettingsAlert({
          title: t("common.permissionRequired"),
          body: t("profile.settings.errors.locationPermissionBlocked"),
          cancelLabel: t("common.cancel"),
          settingsLabel: t("common.openSettings"),
        });
      }
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
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <LoadingScreen label={t("profile.settings.loading")} />
      </BaseProfileSheet>
    );
  }
  if (instructorSettings === null) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <LoadingScreen label={t("profile.settings.unavailable")} />
      </BaseProfileSheet>
    );
  }

  const trimmedAddressInput = addressInput.trim();
  const initialAddress = instructorSettings.address?.trim() ?? "";
  const hasDetectedZone = Boolean(detectedZone);

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
      onClose();
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

  const renderStructuredRow = (label: string, value: string) => {
    if (!hasContent(value)) return null;
    return (
      <Box style={{ flexDirection: "row", gap: BrandSpacing.sm }}>
        <Text style={{ color: palette.textMuted, fontSize: FontSize.caption }}>{label}</Text>
        <Text style={{ color: palette.text, fontSize: FontSize.caption, flex: 1 }}>{value}</Text>
      </Box>
    );
  };

  return (
    <BaseProfileSheet visible={visible} onClose={onClose}>
      <Box style={{ flex: 1, position: "relative", backgroundColor: palette.appBg }}>
        <View
          style={{
            flex: 1,
            paddingHorizontal: BrandSpacing.inset,
            paddingBottom: overlayBottom + 92,
            gap: BrandSpacing.md,
          }}
        >
          {/* ── Address section ── */}
          <ProfileSectionHeader
            label={t("profile.location.addressTitle")}
            icon="mappin.and.ellipse"
            flush
          />

          {/* Search bar */}
          <Box style={{ gap: BrandSpacing.sm }}>
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
              tone="secondary"
              fullWidth
            />
          </Box>

          {/* Structured address summary */}
          {showStructuredSummary ? (
            <Box
              style={{
                gap: BrandSpacing.xs,
                paddingHorizontal: BrandSpacing.md,
                paddingVertical: BrandSpacing.md,
                borderRadius: BrandRadius.lg,
                backgroundColor: palette.surfaceElevated as string,
              }}
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
            </Box>
          ) : null}

          {/* Manual mode toggle */}
          <Pressable onPress={() => setManualMode(!manualMode)}>
            <Text style={{ color: palette.primary, fontSize: FontSize.body }}>
              {manualMode ? t("profile.location.useSearch") : t("profile.location.enterManually")}
            </Text>
          </Pressable>

          {/* Manual fields */}
          {manualMode && (
            <Box style={{ gap: BrandSpacing.sm }}>
              {/* Row: city + street */}
              <Box style={{ flexDirection: "row", gap: BrandSpacing.sm }}>
                <Box style={{ flex: 1, gap: BrandSpacing.xs }}>
                  <FieldLabel>{t("profile.location.fieldCity")}</FieldLabel>
                  <ManualField
                    value={city}
                    onChangeText={setCity}
                    placeholder={t("profile.location.fieldCityPlaceholder")}
                    textMuted={palette.textMuted}
                    surfaceElevated={palette.surfaceElevated}
                    text={palette.text}
                  />
                </Box>
                <Box style={{ flex: 1, gap: BrandSpacing.xs }}>
                  <FieldLabel>{t("profile.location.fieldStreet")}</FieldLabel>
                  <ManualField
                    value={street}
                    onChangeText={setStreet}
                    placeholder={t("profile.location.fieldStreetPlaceholder")}
                    textMuted={palette.textMuted}
                    surfaceElevated={palette.surfaceElevated}
                    text={palette.text}
                  />
                </Box>
              </Box>

              {/* Row: number + floor */}
              <Box style={{ flexDirection: "row", gap: BrandSpacing.sm }}>
                <Box style={{ flex: 1, gap: BrandSpacing.xs }}>
                  <FieldLabel>{t("profile.location.fieldNumber")}</FieldLabel>
                  <ManualField
                    value={streetNumber}
                    onChangeText={setStreetNumber}
                    placeholder={t("profile.location.fieldNumberPlaceholder")}
                    textMuted={palette.textMuted}
                    surfaceElevated={palette.surfaceElevated}
                    text={palette.text}
                  />
                </Box>
                <Box style={{ flex: 1, gap: BrandSpacing.xs }}>
                  <FieldLabel>{t("profile.location.fieldFloor")}</FieldLabel>
                  <ManualField
                    value={floor}
                    onChangeText={setFloor}
                    placeholder={t("profile.location.fieldFloorPlaceholder")}
                    textMuted={palette.textMuted}
                    surfaceElevated={palette.surfaceElevated}
                    text={palette.text}
                  />
                </Box>
              </Box>

              {/* Postal code with lookup */}
              <Box style={{ gap: BrandSpacing.xs }}>
                <FieldLabel>{t("profile.location.fieldZipCode")}</FieldLabel>
                <View style={{ flexDirection: "row", gap: BrandSpacing.sm }}>
                  <ManualField
                    value={postalCode}
                    onChangeText={setPostalCode}
                    placeholder={t("profile.location.fieldZipCodePlaceholder")}
                    keyboardType="numeric"
                    textMuted={palette.textMuted}
                    surfaceElevated={palette.surfaceElevated}
                    text={palette.text}
                  />
                  <ActionButton
                    label={t("profile.location.zipSearch")}
                    onPress={() => {
                      void handleZipCodeLookup();
                    }}
                    disabled={isSearchingZip || postalCode.trim().length < 5}
                    tone="secondary"
                  />
                </View>

                {/* Zip results */}
                {showZipResults && zipResults.length > 0 && (
                  <Box
                    style={{
                      backgroundColor: palette.surfaceElevated,
                      borderRadius: BrandRadius.md,
                      borderWidth: BorderWidth.thin,
                      borderColor: palette.border,
                    }}
                  >
                    {zipResults.map((result, index) => (
                      <Pressable
                        key={index}
                        onPress={() => applyZipResult(result)}
                        style={({ pressed }) => ({
                          padding: BrandSpacing.md,
                          borderBottomWidth: index < zipResults.length - 1 ? BorderWidth.thin : 0,
                          borderBottomColor: palette.border,
                          backgroundColor: pressed ? palette.surfaceAlt : "transparent",
                        })}
                      >
                        <Text style={{ color: palette.text, fontSize: FontSize.body }}>
                          {result.formattedAddress}
                        </Text>
                      </Pressable>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          )}

          {/* ── Zone section ── */}
          <ProfileSectionHeader
            label={t("profile.location.zoneTitle")}
            icon="mappin.circle.fill"
            flush
          />

          <Box
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: BrandSpacing.md,
              borderRadius: BrandRadius.soft,
              backgroundColor: palette.surfaceElevated,
              borderWidth: BorderWidth.thin,
              borderColor: palette.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.text, fontSize: FontSize.body }}>
                {t("profile.location.zoneLabel")}
              </Text>
              <Text style={{ color: palette.textMuted, fontSize: FontSize.caption }}>
                {zoneDisplayValue}
              </Text>
            </View>
            {hasDetectedZone && (
              <Box style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
                <IconSymbol
                  name="checkmark.circle.fill"
                  size={20}
                  color={palette.success as string}
                />
                <Text style={{ color: palette.success, fontSize: FontSize.caption }}>
                  {t("profile.location.zoneDetected")}
                </Text>
              </Box>
            )}
          </Box>

          {/* Error message */}
          {errorMessage ? (
            <Box
              style={{
                borderRadius: BrandRadius.md,
                paddingHorizontal: BrandSpacing.md,
                paddingVertical: BrandSpacing.sm,
                borderWidth: BorderWidth.thin,
                borderColor: palette.danger,
                backgroundColor: palette.dangerSubtle,
              }}
            >
              <Text style={{ color: palette.danger, fontSize: FontSize.caption }}>
                {errorMessage}
              </Text>
            </Box>
          ) : null}
        </View>

        {/* Save/Cancel buttons */}
        <Box
          style={{
            position: "absolute",
            left: BrandSpacing.inset,
            right: BrandSpacing.inset,
            gap: BrandSpacing.stackTight,
            backgroundColor: palette.appBg,
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
      </Box>
    </BaseProfileSheet>
  );
}
