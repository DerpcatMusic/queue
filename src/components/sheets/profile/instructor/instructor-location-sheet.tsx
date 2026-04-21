/**
 * Instructor Location Sheet - allows instructors to set their address and coverage zone.
 */

import { useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, TextInput, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { LoadingScreen } from "@/components/loading-screen";
import { QueueMap } from "@/components/maps/queue-map";
import type { QueueMapPin } from "@/components/maps/queue-map.types";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
} from "@/components/profile/profile-settings-sections";
import { SettingsUnavailableScreen } from "@/components/profile/settings-unavailable-screen";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { ActionButton } from "@/components/ui/action-button";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";

import { useLocationResolution } from "@/hooks/use-location-resolution";
import { FontSize } from "@/lib/design-system";
import {
  fetchPlaceByZipCode,
  type PlaceCoordinates,
  type ZipCodeResult,
} from "@/lib/google-places";
import { getLocationResolveErrorMessage } from "@/lib/location-error-message";
import type { ResolvedLocation } from "@/lib/location-zone";
import { Text } from "@/primitives";

interface InstructorLocationSheetProps {
  visible: boolean;
  onClose: () => void;
}

function hasContent(str: string | undefined | null) {
  return str !== undefined && str !== null && str.trim().length > 0;
}

function FieldLabel({ children }: { children: string }) {
  const { theme } = useUnistyles();
  return (
    <Text
      style={{
        marginBottom: BrandSpacing.xs,
        fontFamily: "Rubik_500Medium",
        fontSize: FontSize.micro,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        color: theme.color.textMuted,
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
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: "default" | "numeric" | "email-address";
  autoCapitalize?: "none" | "words" | "sentences";
}) {
  const { theme } = useUnistyles();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.color.textMuted}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      style={{
        flex: 1,
        minHeight: 46,
        borderRadius: BrandRadius.md,
        paddingHorizontal: BrandSpacing.md,
        paddingVertical: BrandSpacing.sm,
        backgroundColor: theme.color.surfaceElevated,
        color: theme.color.text,
        fontSize: FontSize.body,
      }}
    />
  );
}

// ─── Banner Components ───────────────────────────────────────────────────────

function StatusBanner({ message, type }: { message: string; type: "success" | "error" }) {
  const { theme } = useUnistyles();
  const isSuccess = type === "success";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: BrandSpacing.sm,
        paddingHorizontal: BrandSpacing.md,
        paddingVertical: BrandSpacing.sm,
        borderRadius: BrandRadius.md,
        borderLeftWidth: 3,
        borderLeftColor: isSuccess ? theme.color.success : theme.color.danger,
        backgroundColor: isSuccess ? theme.color.successSubtle : theme.color.dangerSubtle,
      }}
    >
      <IconSymbol
        name={isSuccess ? "checkmark.circle.fill" : "exclamationmark.circle.fill"}
        size={18}
        color={isSuccess ? theme.color.success : theme.color.danger}
      />
      <Text
        style={{
          color: isSuccess ? theme.color.success : theme.color.danger,
          fontSize: FontSize.caption,
          flex: 1,
        }}
      >
        {message}
      </Text>
    </View>
  );
}

// ─── Address Card ─────────────────────────────────────────────────────────────

function AddressCard({
  city,
  street,
  streetNumber,
  postalCode,
}: {
  city: string;
  street: string;
  streetNumber: string;
  floor: string;
  postalCode: string;
}) {
  const { theme } = useUnistyles();

  const lines = [
    hasContent(city) ? city : null,
    hasContent(street) || hasContent(streetNumber)
      ? [streetNumber, street].filter(Boolean).join(" ")
      : null,
    hasContent(postalCode) ? postalCode : null,
  ].filter(Boolean);

  if (lines.length === 0) return null;

  return (
    <ProfileSectionCard>
      <View style={{ flexDirection: "row", gap: BrandSpacing.md }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: BrandRadius.md,
            backgroundColor: theme.color.primarySubtle,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconSymbol name="mappin.and.ellipse" size={18} color={theme.color.primary} />
        </View>
        <View style={{ flex: 1, gap: BrandSpacing.xxs }}>
          {lines.map((line) => (
            <Text
              key={line}
              style={{
                color: theme.color.text,
                fontSize: lines.indexOf(line) === 0 ? FontSize.body : FontSize.caption,
                fontWeight: lines.indexOf(line) === 0 ? "500" : "400",
              }}
            >
              {line}
            </Text>
          ))}
        </View>
        <Pressable
          onPress={() => {}}
          style={({ pressed }) => ({
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <IconSymbol name="pencil.circle.fill" size={22} color={theme.color.textMuted} />
        </Pressable>
      </View>
    </ProfileSectionCard>
  );
}

// ─── Manual Toggle Button ──────────────────────────────────────────────────────

function ManualModeToggle({ manualMode, onToggle }: { manualMode: boolean; onToggle: () => void }) {
  const { theme } = useUnistyles();

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: BrandSpacing.xxs,
        opacity: pressed ? 0.7 : 1,
        paddingVertical: BrandSpacing.xs,
      })}
    >
      <IconSymbol
        name={manualMode ? "magnifyingglass" : "square.and.pencil"}
        size={16}
        color={theme.color.primary}
      />
    </Pressable>
  );
}

export function InstructorLocationSheet({ visible, onClose }: InstructorLocationSheetProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { currentUser } = useUser();
  const locationResolver = useLocationResolution();

  const instructorSettings = useQuery(
    api.instructors.settings.getMyInstructorSettings,
    currentUser?.role === "instructor" ? {} : "skip",
  );
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
  const [, setIncludeDetectedZone] = useState(false);

  // UI state
  const [manualMode, setManualMode] = useState(false);
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

  // ─── Map Pin Drop Handler ───────────────────────────────────────────────────
  const handleMapPinDrop = useCallback(
    async (coord: { latitude: number; longitude: number }) => {
      setLatitude(coord.latitude);
      setLongitude(coord.longitude);
      void resolveZoneFromCoordinates(coord);
      // Also reverse-geocode the address
      const result = await locationResolver.resolveFromCoordinates(coord);
      if (result.ok) {
        applyResolution(result.data.value);
      }
    },
    [locationResolver, resolveZoneFromCoordinates, applyResolution],
  );

  if (currentUser === undefined) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <LoadingScreen label={t("profile.settings.loading")} />
      </BaseProfileSheet>
    );
  }
  if (currentUser === null || instructorSettings === null) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <SettingsUnavailableScreen label={t("profile.settings.unavailable")} />
      </BaseProfileSheet>
    );
  }
  if (instructorSettings === undefined) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <LoadingScreen label={t("profile.settings.loading")} />
      </BaseProfileSheet>
    );
  }

  const hasDetectedZone = Boolean(detectedZone);
  const workRadiusKm = instructorSettings.workRadiusKm ?? 15;

  const showStructuredSummary =
    !manualMode &&
    (hasContent(city) || hasContent(street) || hasContent(streetNumber) || hasContent(postalCode));

  const mapPin: QueueMapPin | null =
    latitude !== undefined && longitude !== undefined ? { latitude, longitude } : null;

  return (
    <BaseProfileSheet
      visible={visible}
      onClose={onClose}
      headerContent={
        <View style={{ height: 200, borderRadius: BrandRadius.soft, overflow: "hidden" }}>
          <QueueMap
            mode="pinDrop"
            pin={mapPin}
            selectedZoneIds={[]}
            focusZoneId={null}
            onPressMap={handleMapPinDrop}
            showGpsButton={false}
            showAttributionButton={false}
            contentInset={{ top: 0, right: 0, bottom: 0, left: 0 }}
            cameraPadding={{ top: 40, right: 40, bottom: 40, left: 40 }}
          />
        </View>
      }
    >
      <View style={{ gap: BrandSpacing.lg }}>
        {/* ── Address Section ── */}
        <View style={{ gap: BrandSpacing.md }}>
          <ProfileSectionHeader label={t("profile.location.addressTitle")} tone="account" />

          <AddressAutocomplete
            value={addressInput}
            onChangeText={handleAddressChange}
            onPlaceSelected={handlePlaceSelected}
            placeholder={t("profile.settings.location.addressPlaceholder")}
            placeholderTextColor={theme.color.textMuted}
            borderColor={theme.color.border}
            textColor={theme.color.text}
            backgroundColor={theme.color.surfaceElevated}
            surfaceColor={theme.color.surfaceElevated}
            mutedTextColor={theme.color.textMuted}
          />

          <ManualModeToggle manualMode={manualMode} onToggle={() => setManualMode(!manualMode)} />

          {showStructuredSummary ? (
            <AddressCard
              city={city}
              street={street}
              streetNumber={streetNumber}
              floor={floor}
              postalCode={postalCode}
            />
          ) : null}

          {manualMode && (
            <View style={{ gap: BrandSpacing.sm }}>
              {/* Row: city + street */}
              <View style={{ flexDirection: "row", gap: BrandSpacing.sm }}>
                <View style={{ flex: 1, gap: BrandSpacing.xs }}>
                  <FieldLabel>{t("profile.location.fieldCity")}</FieldLabel>
                  <ManualField
                    value={city}
                    onChangeText={setCity}
                    placeholder={t("profile.location.fieldCityPlaceholder")}
                  />
                </View>
                <View style={{ flex: 1, gap: BrandSpacing.xs }}>
                  <FieldLabel>{t("profile.location.fieldStreet")}</FieldLabel>
                  <ManualField
                    value={street}
                    onChangeText={setStreet}
                    placeholder={t("profile.location.fieldStreetPlaceholder")}
                  />
                </View>
              </View>

              {/* Row: number + floor */}
              <View style={{ flexDirection: "row", gap: BrandSpacing.sm }}>
                <View style={{ flex: 1, gap: BrandSpacing.xs }}>
                  <FieldLabel>{t("profile.location.fieldNumber")}</FieldLabel>
                  <ManualField
                    value={streetNumber}
                    onChangeText={setStreetNumber}
                    placeholder={t("profile.location.fieldNumberPlaceholder")}
                  />
                </View>
                <View style={{ flex: 1, gap: BrandSpacing.xs }}>
                  <FieldLabel>{t("profile.location.fieldFloor")}</FieldLabel>
                  <ManualField
                    value={floor}
                    onChangeText={setFloor}
                    placeholder={t("profile.location.fieldFloorPlaceholder")}
                  />
                </View>
              </View>

              {/* Postal code with lookup */}
              <View style={{ gap: BrandSpacing.xs }}>
                <FieldLabel>{t("profile.location.fieldZipCode")}</FieldLabel>
                <View style={{ flexDirection: "row", gap: BrandSpacing.sm }}>
                  <ManualField
                    value={postalCode}
                    onChangeText={setPostalCode}
                    placeholder={t("profile.location.fieldZipCodePlaceholder")}
                    keyboardType="numeric"
                  />
                  <ActionButton
                    label={t("profile.location.zipSearch")}
                    onPress={() => void handleZipCodeLookup()}
                    disabled={isSearchingZip || postalCode.trim().length < 5}
                    tone="secondary"
                  />
                </View>

                {showZipResults && zipResults.length > 0 && (
                  <View
                    style={{
                      backgroundColor: theme.color.surfaceElevated,
                      borderRadius: BrandRadius.md,
                      borderWidth: 1,
                      borderColor: theme.color.border,
                    }}
                  >
                    {zipResults.map((result, index) => (
                      <Pressable
                        key={result.postalCode || result.formattedAddress || index}
                        onPress={() => applyZipResult(result)}
                        style={({ pressed }) => ({
                          padding: BrandSpacing.md,
                          borderBottomWidth: index < zipResults.length - 1 ? 1 : 0,
                          borderBottomColor: theme.color.border,
                          backgroundColor: pressed ? theme.color.surfaceMuted : "transparent",
                        })}
                      >
                        <Text style={{ color: theme.color.text }}>{result.formattedAddress}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* ── Radius Section ── */}
        <View style={{ gap: BrandSpacing.md }}>
          <ProfileSectionHeader label={t("profile.location.workRadiusTitle")} tone="account" />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: BrandSpacing.md,
              borderRadius: BrandRadius.soft,
              backgroundColor: theme.color.surfaceElevated,
              borderWidth: 1,
              borderColor: theme.color.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.color.text }}>
                {t("profile.location.workRadiusTitle")}
              </Text>
              <Text style={{ color: theme.color.textMuted, fontSize: 12 }}>
                {t("profile.location.workRadiusDescription")}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: theme.color.text, fontSize: 18, fontWeight: "600" }}>
                {workRadiusKm} km
              </Text>
              {hasDetectedZone && (
                <IconSymbol
                  name="checkmark.circle.fill"
                  size={20}
                  color={theme.color.success as string}
                />
              )}
            </View>
          </View>
        </View>

        {/* ── Error Banner ── */}
        {errorMessage ? <StatusBanner message={errorMessage} type="error" /> : null}
      </View>
    </BaseProfileSheet>
  );
}
