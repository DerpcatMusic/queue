import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, TextInput } from "react-native";

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

let zoneLabelByIdPromise: Promise<Map<string, { en: string; he: string }>> | null = null;
const DEFAULT_WORK_RADIUS_KM = 15;

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
  primary,
  border,
  surfaceElevated,
  text,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: "default" | "numeric" | "email-address";
  autoCapitalize?: "none" | "words" | "sentences";
  textMuted: string;
  primary: string;
  border: string;
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
      selectionColor={primary}
      cursorColor={primary}
      style={{
        borderWidth: BorderWidth.thin,
        borderColor: border,
        backgroundColor: surfaceElevated,
        minHeight: BrandSpacing.controlMd,
        borderRadius: BrandRadius.lg,
        paddingHorizontal: BrandSpacing.md,
        color: text,
        fontFamily: "Rubik_400Regular",
        fontSize: 16,
        lineHeight: 22,
      }}
    />
  );
}

export default function LocationScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { overlayBottom } = useAppInsets();

  const theme = useTheme();
  const palette = theme.color;
  const { currentUser } = useUser();
  const languageCode = (i18n.resolvedLanguage ?? "en") as "en" | "he";
  useProfileSubpageSheet({
    title: t("profile.navigation.location"),
    routeMatchPath: "/profile/location",
  });

  const instructorSettings = useQuery(
    api.instructors.settings.getMyInstructorSettings,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const saveInstructor = useMutation(api.instructors.settings.updateMyInstructorSettings);
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
  const [workRadiusKm, setWorkRadiusKm] = useState(String(DEFAULT_WORK_RADIUS_KM));
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
      setWorkRadiusKm(String(instructorSettings.workRadiusKm ?? DEFAULT_WORK_RADIUS_KM));
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
    Number.parseFloat(workRadiusKm) !== (instructorSettings.workRadiusKm ?? DEFAULT_WORK_RADIUS_KM) ||
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
      const parsedWorkRadiusKm = Number.parseFloat(workRadiusKm);
      if (!Number.isFinite(parsedWorkRadiusKm) || parsedWorkRadiusKm <= 0) {
        throw new Error(t("profile.settings.errors.saveFailed"));
      }

      await saveInstructor({
        notificationsEnabled: instructorSettings.notificationsEnabled,
        sports: instructorSettings.sports,
        calendarProvider: instructorSettings.calendarProvider,
        calendarSyncEnabled: instructorSettings.calendarSyncEnabled,
        workRadiusKm: parsedWorkRadiusKm,
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
      <Box style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
        <Text
          style={{
            fontFamily: "Manrope_400Regular",
            fontSize: 14,
            fontWeight: "400",
            lineHeight: 19,
            color: palette.textMuted,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontFamily: "Manrope_400Regular",
            fontSize: 16,
            fontWeight: "400",
            lineHeight: 22,
            color: palette.text,
          }}
        >
          {value}
        </Text>
      </Box>
    );
  };

  return (
    <Box style={{ flex: 1, position: "relative", backgroundColor: palette.appBg }}>
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

        {/* Structured address summary — auto-filled from search/GPS */}
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

        <ProfileSectionHeader
          label={t("profile.location.workRadiusTitle")}
          icon="location"
          flush
        />
        <Box style={{ gap: BrandSpacing.sm }}>
          <Text
            style={{
              fontFamily: "Manrope_400Regular",
              fontSize: 14,
              fontWeight: "400",
              lineHeight: 19,
              color: palette.textMuted,
            }}
          >
            {t("profile.location.workRadiusDescription")}
          </Text>
          <ManualField
            value={workRadiusKm}
            onChangeText={setWorkRadiusKm}
            placeholder={t("profile.location.workRadiusPlaceholder")}
            keyboardType="numeric"
            autoCapitalize="none"
            textMuted={palette.textMuted}
            primary={palette.primary}
            border={palette.border}
            surfaceElevated={palette.surfaceElevated}
            text={palette.text}
          />
        </Box>

        {/* Structured fields — editable in manual mode */}
        {manualMode ? (
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
                  primary={palette.primary}
                  border={palette.border}
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
                  primary={palette.primary}
                  border={palette.border}
                  surfaceElevated={palette.surfaceElevated}
                  text={palette.text}
                />
              </Box>
            </Box>

            {/* Row: number + floor + zip */}
            <Box style={{ flexDirection: "row", gap: BrandSpacing.sm }}>
              <Box style={{ width: 80, gap: BrandSpacing.xs }}>
                <FieldLabel>{t("profile.location.fieldNumber")}</FieldLabel>
                <ManualField
                  value={streetNumber}
                  onChangeText={setStreetNumber}
                  placeholder="-"
                  textMuted={palette.textMuted}
                  primary={palette.primary}
                  border={palette.border}
                  surfaceElevated={palette.surfaceElevated}
                  text={palette.text}
                />
              </Box>
              <Box style={{ width: 80, gap: BrandSpacing.xs }}>
                <FieldLabel>{t("profile.location.fieldFloor")}</FieldLabel>
                <ManualField
                  value={floor}
                  onChangeText={setFloor}
                  placeholder="-"
                  textMuted={palette.textMuted}
                  primary={palette.primary}
                  border={palette.border}
                  surfaceElevated={palette.surfaceElevated}
                  text={palette.text}
                />
              </Box>
              <Box style={{ flex: 1, gap: BrandSpacing.xs }}>
                <FieldLabel>{t("profile.location.fieldZipCode")}</FieldLabel>
                <ManualField
                  value={postalCode}
                  onChangeText={setPostalCode}
                  placeholder="-"
                  keyboardType="numeric"
                  autoCapitalize="none"
                  textMuted={palette.textMuted}
                  primary={palette.primary}
                  border={palette.border}
                  surfaceElevated={palette.surfaceElevated}
                  text={palette.text}
                />
              </Box>
            </Box>
          </Box>
        ) : null}

        {/* Secondary actions row */}
        <Box style={{ flexDirection: "row", gap: BrandSpacing.md, alignItems: "center" }}>
          {!manualMode ? (
            <Pressable
              onPress={() => setManualMode(true)}
              style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.xs }}
            >
              <IconSymbol name="pencil" size={13} color={palette.primary} />
              <Text
                style={{
                  fontFamily: "Manrope_400Regular",
                  fontSize: 14,
                  fontWeight: "400",
                  lineHeight: 19,
                  color: palette.primary,
                }}
              >
                {t("profile.location.enterManually")}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setManualMode(false)}
              style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.xs }}
            >
              <IconSymbol name="magnifyingglass" size={13} color={palette.primary} />
              <Text
                style={{
                  fontFamily: "Manrope_400Regular",
                  fontSize: 14,
                  fontWeight: "400",
                  lineHeight: 19,
                  color: palette.primary,
                }}
              >
                {t("profile.location.backToSearch")}
              </Text>
            </Pressable>
          )}

          {manualMode && (
            <>
              <Box
                style={{ height: 12, width: BorderWidth.thin, backgroundColor: palette.border as string }}
              />
              <Pressable
                onPress={() => {
                  void handleZipCodeLookup();
                }}
                disabled={postalCode.trim().length < 5 || isSearchingZip}
                style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.xs }}
              >
                <IconSymbol
                  name={isSearchingZip ? "arrow.2.squarepath" : "number"}
                  size={13}
                  color={postalCode.trim().length < 5 ? palette.textMuted : palette.primary}
                />
                <Text
                  style={{
                    fontFamily: "Manrope_400Regular",
                    fontSize: 14,
                    fontWeight: "400",
                    lineHeight: 19,
                    color: postalCode.trim().length < 5 ? palette.textMuted : palette.primary,
                  }}
                >
                  {t("profile.location.findByZip")}
                </Text>
              </Pressable>
            </>
          )}
        </Box>

        {/* Zip lookup results */}
        {showZipResults && zipResults.length > 0 ? (
          <Box
            style={{
              overflow: "hidden",
              borderRadius: BrandRadius.lg,
              borderWidth: BorderWidth.thin,
              borderColor: palette.border as string,
            }}
          >
            {zipResults.slice(0, 5).map((result) => (
              <Pressable
                key={`${result.latitude}-${result.longitude}`}
                onPress={() => {
                  applyZipResult(result);
                  setManualMode(false);
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: BrandSpacing.md,
                  paddingVertical: BrandSpacing.sm,
                  backgroundColor: pressed
                    ? (palette.primarySubtle as string)
                    : (palette.surfaceElevated as string),
                  borderBottomWidth: BorderWidth.thin,
                  borderBottomColor: palette.border as string,
                })}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: "Manrope_500Medium",
                    fontSize: 16,
                    fontWeight: "500",
                    lineHeight: 22,
                    color: palette.text,
                  }}
                >
                  {result.street
                    ? `${result.streetNumber ?? ""} ${result.street}`.trim()
                    : result.formattedAddress.split(",")[0]}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: "Manrope_400Regular",
                    fontSize: 14,
                    fontWeight: "400",
                    lineHeight: 19,
                    color: palette.textMuted,
                  }}
                >
                  {[result.city, result.postalCode].filter(Boolean).join(" · ")}
                </Text>
              </Pressable>
            ))}
          </Box>
        ) : null}

        {/* ── Zone section ── */}
        <ProfileSectionHeader
          label={t("profile.location.zoneLabel")}
          icon="checkmark.circle.fill"
          flush
        />

        <ProfileSectionCard style={{ marginHorizontal: 0 }}>
          <Box
            style={{
              paddingHorizontal: BrandSpacing.lg,
              paddingVertical: BrandSpacing.md,
              gap: BrandSpacing.sm,
            }}
          >
            {/* Zone status row */}
            <Box style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Box style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
                <Box
                  style={{
                    width: BrandSpacing.statusDot,
                    height: BrandSpacing.statusDot,
                    borderRadius: BrandRadius.pill,
                    backgroundColor: hasDetectedZone ? palette.primary : palette.textMuted,
                  }}
                />
                <Text
                  style={{
                    fontFamily: "Manrope_400Regular",
                    fontSize: 16,
                    fontWeight: "400",
                    lineHeight: 22,
                    color: palette.text,
                  }}
                >
                  {zoneDisplayValue}
                </Text>
              </Box>
              {hasDetectedZone ? (
                <KitSwitch value={includeDetectedZone} onValueChange={setIncludeDetectedZone} />
              ) : null}
            </Box>

            {!hasDetectedZone ? (
              <Text
                style={{
                  fontFamily: "Manrope_400Regular",
                  fontSize: 14,
                  fontWeight: "400",
                  lineHeight: 19,
                  color: palette.textMuted,
                }}
              >
                {t("profile.location.zonePendingBody")}
              </Text>
            ) : (
              <Text
                style={{
                  fontFamily: "Manrope_400Regular",
                  fontSize: 14,
                  fontWeight: "400",
                  lineHeight: 19,
                  color: palette.textMuted,
                }}
              >
                {t("profile.settings.location.includeDetectedZoneDescription")}
              </Text>
            )}
          </Box>
        </ProfileSectionCard>

        {/* Error */}
        {errorMessage ? (
          <Box
            style={{
              borderRadius: BrandRadius.lg,
              paddingHorizontal: BrandSpacing.lg,
              paddingVertical: BrandSpacing.md,
              borderWidth: BorderWidth.thin,
              borderColor: palette.danger,
              backgroundColor: palette.dangerSubtle,
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope_400Regular",
                fontSize: 16,
                fontWeight: "400",
                lineHeight: 22,
                color: palette.danger,
              }}
            >
              {errorMessage}
            </Text>
          </Box>
        ) : null}
      </ProfileSubpageScrollView>

      {/* Save rail */}
      <Box
        style={{
          position: "absolute",
          left: BrandSpacing.inset,
          right: BrandSpacing.inset,
          bottom: overlayBottom,
          gap: BrandSpacing.sm,
          backgroundColor: palette.appBg,
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
          fullWidth
        />
        <ActionButton
          label={t("common.cancel")}
          onPress={() => router.back()}
          tone="secondary"
          fullWidth
        />
      </Box>
    </Box>
  );
}
