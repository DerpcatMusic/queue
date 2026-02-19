import { api } from "@/convex/_generated/api";
import { SPORT_TYPES } from "@/convex/constants";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { BrandButton } from "@/components/ui/brand-button";
import { BrandSurface } from "@/components/ui/brand-surface";
import { Brand } from "@/constants/brand";
import { ZONE_OPTIONS } from "@/constants/zones";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  resolveAddressToZone,
  resolveCurrentLocationToZone,
  type ResolvedLocation,
} from "@/lib/location-zone";
import { omitUndefined } from "@/lib/omit-undefined";
import { registerForPushNotificationsAsync } from "@/lib/push-notifications";
import { useMutation, useQuery } from "convex/react";
import { Redirect, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

type OnboardingRole = "instructor" | "studio";

const MAX_INSTRUCTOR_ZONES = 25;

function toDisplayLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function trimOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const colorScheme = useColorScheme() ?? "light";
  const palette = Brand[colorScheme];
  const language = i18n.resolvedLanguage?.startsWith("he") ? "he" : "en";

  const currentUser = useQuery(api.users.getCurrentUser);
  const completeInstructorOnboarding = useMutation(
    api.onboarding.completeInstructorOnboarding,
  );
  const completeStudioOnboarding = useMutation(
    api.onboarding.completeStudioOnboarding,
  );

  const [selectedRole, setSelectedRole] = useState<OnboardingRole | null>(null);
  const [instructorStep, setInstructorStep] = useState(0);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [zoneSearch, setZoneSearch] = useState("");
  const [instructorAddress, setInstructorAddress] = useState("");
  const [instructorLatitude, setInstructorLatitude] = useState<number | undefined>();
  const [instructorLongitude, setInstructorLongitude] = useState<number | undefined>();
  const [instructorDetectedZone, setInstructorDetectedZone] = useState<string | null>(null);
  const [isResolvingInstructorZone, setIsResolvingInstructorZone] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [isRequestingPush, setIsRequestingPush] = useState(false);

  const [studioName, setStudioName] = useState("");
  const [studioAddress, setStudioAddress] = useState("");
  const [studioContactPhone, setStudioContactPhone] = useState("");
  const [studioLatitude, setStudioLatitude] = useState<number | undefined>();
  const [studioLongitude, setStudioLongitude] = useState<number | undefined>();
  const [studioDetectedZone, setStudioDetectedZone] = useState<string | null>(null);
  const [isResolvingStudioZone, setIsResolvingStudioZone] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredZones = useMemo(() => {
    const query = zoneSearch.trim().toLowerCase();
    if (!query) return ZONE_OPTIONS.slice(0, 80);

    return ZONE_OPTIONS.filter((zone) => {
      const localized = zone.label[language].toLowerCase();
      const english = zone.label.en.toLowerCase();
      return (
        localized.includes(query) ||
        english.includes(query) ||
        zone.id.toLowerCase().includes(query)
      );
    });
  }, [language, zoneSearch]);

  if (currentUser === undefined) {
    return <LoadingScreen label={t("onboarding.loading")} />;
  }

  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser.onboardingComplete) {
    return <Redirect href="/" />;
  }

  const role = selectedRole ?? (currentUser.role === "pending" ? null : currentUser.role);

  const toggleSport = (sport: string) => {
    setSelectedSports((current) =>
      current.includes(sport)
        ? current.filter((s) => s !== sport)
        : [...current, sport],
    );
  };

  const toggleZone = (zone: string) => {
    setSelectedZones((current) => {
      if (current.includes(zone)) {
        return current.filter((z) => z !== zone);
      }
      if (current.length >= MAX_INSTRUCTOR_ZONES) {
        setErrorMessage(t("onboarding.errors.tooManyZones"));
        return current;
      }
      return [...current, zone];
    });
  };

  const applyInstructorResolution = (resolved: ResolvedLocation) => {
    setInstructorAddress(resolved.address);
    setInstructorLatitude(resolved.latitude);
    setInstructorLongitude(resolved.longitude);
    setInstructorDetectedZone(resolved.zoneId);
  };

  const applyStudioResolution = (resolved: ResolvedLocation) => {
    setStudioAddress(resolved.address);
    setStudioLatitude(resolved.latitude);
    setStudioLongitude(resolved.longitude);
    setStudioDetectedZone(resolved.zoneId);
  };

  const resolveInstructorFromAddress = async () => {
    if (!instructorAddress.trim()) {
      setErrorMessage(t("onboarding.errors.instructorAddressRequired"));
      return;
    }
    setIsResolvingInstructorZone(true);
    setErrorMessage(null);
    try {
      const resolved = await resolveAddressToZone(instructorAddress);
      applyInstructorResolution(resolved);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("onboarding.errors.failedToResolveAddress");
      setErrorMessage(message);
    } finally {
      setIsResolvingInstructorZone(false);
    }
  };

  const resolveInstructorFromGps = async () => {
    setIsResolvingInstructorZone(true);
    setErrorMessage(null);
    try {
      const resolved = await resolveCurrentLocationToZone();
      applyInstructorResolution(resolved);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("onboarding.errors.failedToResolveGps");
      setErrorMessage(message);
    } finally {
      setIsResolvingInstructorZone(false);
    }
  };

  const resolveStudioFromAddress = async () => {
    if (!studioAddress.trim()) {
      setErrorMessage(t("onboarding.errors.studioAddressRequired"));
      return;
    }
    setIsResolvingStudioZone(true);
    setErrorMessage(null);
    try {
      const resolved = await resolveAddressToZone(studioAddress);
      applyStudioResolution(resolved);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("onboarding.errors.failedToResolveAddress");
      setErrorMessage(message);
    } finally {
      setIsResolvingStudioZone(false);
    }
  };

  const resolveStudioFromGps = async () => {
    setIsResolvingStudioZone(true);
    setErrorMessage(null);
    try {
      const resolved = await resolveCurrentLocationToZone();
      applyStudioResolution(resolved);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("onboarding.errors.failedToResolveGps");
      setErrorMessage(message);
    } finally {
      setIsResolvingStudioZone(false);
    }
  };

  const requestPushPermission = async () => {
    setIsRequestingPush(true);
    setErrorMessage(null);

    try {
      const token = await registerForPushNotificationsAsync();
      setPushToken(token);
      if (!token) {
        setErrorMessage(t("onboarding.push.permissionNotGranted"));
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("onboarding.push.requestFailed");
      setErrorMessage(message);
    } finally {
      setIsRequestingPush(false);
    }
  };

  const validateInstructorStep = () => {
    if (instructorStep === 0 && !displayName.trim()) {
      setErrorMessage(t("onboarding.errors.displayNameRequired"));
      return false;
    }
    if (instructorStep === 1 && selectedSports.length === 0) {
      setErrorMessage(t("onboarding.errors.selectAtLeastOneSport"));
      return false;
    }
    if (instructorStep === 2 && selectedZones.length === 0) {
      setErrorMessage(t("onboarding.errors.selectAtLeastOneZone"));
      return false;
    }
    setErrorMessage(null);
    return true;
  };

  const submitInstructor = async () => {
    if (!validateInstructorStep()) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const hourly = Number.parseFloat(hourlyRate);
      const bioValue = trimOptional(bio);
      const addressValue = trimOptional(instructorAddress);
      const expoPushToken = pushToken ?? undefined;
      const hourlyRateExpectation =
        Number.isFinite(hourly) && hourly > 0 ? hourly : undefined;

      await completeInstructorOnboarding({
        displayName: displayName.trim(),
        sports: selectedSports,
        zones: selectedZones,
        notificationsEnabled: Boolean(pushToken),
        ...omitUndefined({
          bio: bioValue,
          address: addressValue,
          latitude: instructorLatitude,
          longitude: instructorLongitude,
          expoPushToken,
          hourlyRateExpectation,
        }),
      });

      router.replace("/");
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("onboarding.errors.failedToComplete");
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitStudio = async () => {
    if (!studioName.trim()) {
      setErrorMessage(t("onboarding.errors.studioNameRequired"));
      return;
    }
    if (!studioAddress.trim()) {
      setErrorMessage(t("onboarding.errors.studioAddressRequired"));
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let resolvedZone = studioDetectedZone;
      let resolvedLatitude = studioLatitude;
      let resolvedLongitude = studioLongitude;

      if (!resolvedZone || resolvedLatitude === undefined || resolvedLongitude === undefined) {
        const resolved = await resolveAddressToZone(studioAddress);
        applyStudioResolution(resolved);
        resolvedZone = resolved.zoneId;
        resolvedLatitude = resolved.latitude;
        resolvedLongitude = resolved.longitude;
      }
      if (!resolvedZone) {
        throw new Error(t("onboarding.errors.failedToResolveAddress"));
      }
      if (resolvedLatitude === undefined || resolvedLongitude === undefined) {
        throw new Error(t("onboarding.errors.failedToResolveAddress"));
      }

      await completeStudioOnboarding({
        studioName: studioName.trim(),
        address: studioAddress.trim(),
        zone: resolvedZone,
        latitude: resolvedLatitude,
        longitude: resolvedLongitude,
        ...omitUndefined({ contactPhone: trimOptional(studioContactPhone) }),
      });

      router.replace("/");
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("onboarding.errors.failedToComplete");
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canGoNext =
    instructorStep === 0
      ? displayName.trim().length > 0
      : instructorStep === 1
        ? selectedSports.length > 0
        : selectedZones.length > 0;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.appBg }]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerBlock}>
        <ThemedText type="title">{t("onboarding.title")}</ThemedText>
        <ThemedText style={{ color: palette.textMuted }}>
          {t("onboarding.subtitle")}
        </ThemedText>
      </View>

      {!role ? (
        <BrandSurface>
          <ThemedText type="defaultSemiBold">
            {t("onboarding.rolePrompt")}
          </ThemedText>
          <View style={styles.roleRow}>
            <Pressable
              style={[
                styles.roleCard,
                { borderColor: palette.border, backgroundColor: palette.surface },
              ]}
              onPress={() => setSelectedRole("instructor")}
            >
              <ThemedText type="defaultSemiBold">
                {t("onboarding.roleInstructorTitle")}
              </ThemedText>
              <ThemedText style={{ color: palette.textMuted }}>
                {t("onboarding.roleInstructorDescription")}
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.roleCard,
                { borderColor: palette.border, backgroundColor: palette.surface },
              ]}
              onPress={() => setSelectedRole("studio")}
            >
              <ThemedText type="defaultSemiBold">
                {t("onboarding.roleStudioTitle")}
              </ThemedText>
              <ThemedText style={{ color: palette.textMuted }}>
                {t("onboarding.roleStudioDescription")}
              </ThemedText>
            </Pressable>
          </View>
        </BrandSurface>
      ) : role === "studio" ? (
        <BrandSurface>
          <View style={styles.sectionBlock}>
            <ThemedText type="defaultSemiBold">
              {t("onboarding.studioDetailsTitle")}
            </ThemedText>
            <TextInput
              value={studioName}
              onChangeText={setStudioName}
              placeholder={t("onboarding.studioName")}
              placeholderTextColor={palette.textMuted}
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
            />
            <TextInput
              value={studioAddress}
              onChangeText={(value) => {
                setStudioAddress(value);
                setStudioLatitude(undefined);
                setStudioLongitude(undefined);
                setStudioDetectedZone(null);
              }}
              placeholder={t("onboarding.studioAddress")}
              placeholderTextColor={palette.textMuted}
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
            />
            <TextInput
              value={studioContactPhone}
              onChangeText={setStudioContactPhone}
              placeholder={t("onboarding.phoneOptional")}
              placeholderTextColor={palette.textMuted}
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
            />

            <View style={styles.actionRow}>
              <BrandButton
                label={
                  isResolvingStudioZone
                    ? t("onboarding.location.resolvingAddress")
                    : t("onboarding.location.findByAddress")
                }
                variant="secondary"
                onPress={() => {
                  void resolveStudioFromAddress();
                }}
                disabled={isResolvingStudioZone}
              />
              <BrandButton
                label={
                  isResolvingStudioZone
                    ? t("onboarding.location.resolvingGps")
                    : t("onboarding.location.useGps")
                }
                variant="secondary"
                onPress={() => {
                  void resolveStudioFromGps();
                }}
                disabled={isResolvingStudioZone}
              />
            </View>

            <View
              style={[
                styles.locationBadge,
                {
                  borderColor: studioDetectedZone ? palette.primary : palette.border,
                  backgroundColor: studioDetectedZone
                    ? palette.primarySubtle
                    : palette.surface,
                },
              ]}
            >
              <ThemedText
                style={{ color: studioDetectedZone ? palette.primary : palette.textMuted }}
              >
                {studioDetectedZone
                  ? t("onboarding.location.detectedZone", { zone: studioDetectedZone })
                  : t("onboarding.location.zonePending")}
              </ThemedText>
            </View>

            <View style={styles.actionRow}>
              {currentUser.role === "pending" ? (
                <BrandButton
                  label={t("onboarding.back")}
                  variant="secondary"
                  onPress={() => setSelectedRole(null)}
                />
              ) : null}
              <BrandButton
                label={isSubmitting ? t("onboarding.save") : t("onboarding.complete")}
                onPress={() => {
                  void submitStudio();
                }}
                disabled={isSubmitting}
              />
            </View>
          </View>
        </BrandSurface>
      ) : (
        <BrandSurface>
          <View style={styles.sectionBlock}>
            <ThemedText type="defaultSemiBold">
              {t("onboarding.instructorStep", {
                current: instructorStep + 1,
                total: 4,
              })}
            </ThemedText>

            {instructorStep === 0 ? (
              <>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder={t("onboarding.displayName")}
                  placeholderTextColor={palette.textMuted}
                  style={[
                    styles.input,
                    { borderColor: palette.border, color: palette.text },
                  ]}
                />
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder={t("onboarding.bioOptional")}
                  placeholderTextColor={palette.textMuted}
                  multiline
                  style={[
                    styles.input,
                    styles.multilineInput,
                    { borderColor: palette.border, color: palette.text },
                  ]}
                />
                <TextInput
                  value={hourlyRate}
                  onChangeText={setHourlyRate}
                  placeholder={t("onboarding.hourlyRateOptional")}
                  keyboardType="decimal-pad"
                  placeholderTextColor={palette.textMuted}
                  style={[
                    styles.input,
                    { borderColor: palette.border, color: palette.text },
                  ]}
                />
              </>
            ) : null}

            {instructorStep === 1 ? (
              <View style={styles.chipGrid}>
                {SPORT_TYPES.map((sport) => {
                  const isSelected = selectedSports.includes(sport);
                  return (
                    <Pressable
                      key={sport}
                      style={[
                        styles.chip,
                        {
                          borderColor: isSelected ? palette.primary : palette.border,
                          backgroundColor: isSelected
                            ? palette.primarySubtle
                            : palette.surface,
                        },
                      ]}
                      onPress={() => toggleSport(sport)}
                    >
                      <ThemedText
                        type="defaultSemiBold"
                        style={{ color: isSelected ? palette.primary : palette.text }}
                      >
                        {toDisplayLabel(sport)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {instructorStep === 2 ? (
              <>
                <TextInput
                  value={zoneSearch}
                  onChangeText={setZoneSearch}
                  placeholder={t("onboarding.zoneSearchPlaceholder")}
                  placeholderTextColor={palette.textMuted}
                  style={[
                    styles.input,
                    { borderColor: palette.border, color: palette.text },
                  ]}
                />
                <TextInput
                  value={instructorAddress}
                  onChangeText={(value) => {
                    setInstructorAddress(value);
                    setInstructorLatitude(undefined);
                    setInstructorLongitude(undefined);
                    setInstructorDetectedZone(null);
                  }}
                  placeholder={t("onboarding.location.instructorAddressOptional")}
                  placeholderTextColor={palette.textMuted}
                  style={[
                    styles.input,
                    { borderColor: palette.border, color: palette.text },
                  ]}
                />
                <View style={styles.actionRow}>
                  <BrandButton
                    label={
                      isResolvingInstructorZone
                        ? t("onboarding.location.resolvingAddress")
                        : t("onboarding.location.findByAddress")
                    }
                    variant="secondary"
                    onPress={() => {
                      void resolveInstructorFromAddress();
                    }}
                    disabled={isResolvingInstructorZone}
                  />
                  <BrandButton
                    label={
                      isResolvingInstructorZone
                        ? t("onboarding.location.resolvingGps")
                        : t("onboarding.location.useGps")
                    }
                    variant="secondary"
                    onPress={() => {
                      void resolveInstructorFromGps();
                    }}
                    disabled={isResolvingInstructorZone}
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
                      ? t("onboarding.location.detectedZone", {
                          zone: instructorDetectedZone,
                        })
                      : t("onboarding.location.zoneOptionalHint")}
                  </ThemedText>
                </View>
                {instructorDetectedZone && !selectedZones.includes(instructorDetectedZone) ? (
                  <BrandButton
                    label={t("onboarding.location.addDetectedZone")}
                    variant="secondary"
                    onPress={() => toggleZone(instructorDetectedZone)}
                  />
                ) : null}
                <View style={styles.chipGrid}>
                  {filteredZones.slice(0, 40).map((zone) => {
                    const isSelected = selectedZones.includes(zone.id);
                    return (
                      <Pressable
                        key={zone.id}
                        style={[
                          styles.chip,
                          {
                            borderColor: isSelected ? palette.primary : palette.border,
                            backgroundColor: isSelected
                              ? palette.primarySubtle
                              : palette.surface,
                          },
                        ]}
                        onPress={() => toggleZone(zone.id)}
                      >
                        <ThemedText
                          type="defaultSemiBold"
                          style={{ color: isSelected ? palette.primary : palette.text }}
                        >
                          {zone.label[language]}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {instructorStep === 3 ? (
              <>
                <ThemedText style={{ color: palette.textMuted }}>
                  {t("onboarding.push.description")}
                </ThemedText>
                <BrandButton
                  label={
                    isRequestingPush
                      ? t("onboarding.push.requesting")
                      : pushToken
                        ? t("onboarding.push.enabled")
                        : t("onboarding.push.requestPermission")
                  }
                  variant={pushToken ? "secondary" : "primary"}
                  onPress={() => {
                    void requestPushPermission();
                  }}
                  disabled={isRequestingPush}
                />
                {pushToken ? (
                  <ThemedText style={{ color: palette.textMuted }}>
                    {t("onboarding.push.tokenSaved")}
                  </ThemedText>
                ) : null}
              </>
            ) : null}

            <View style={styles.actionRow}>
              <BrandButton
                label={
                  instructorStep === 0 && currentUser.role === "pending"
                    ? t("onboarding.back")
                    : t("onboarding.previous")
                }
                variant="secondary"
                onPress={() => {
                  if (instructorStep === 0 && currentUser.role === "pending") {
                    setSelectedRole(null);
                    return;
                  }
                  setInstructorStep((current) => Math.max(0, current - 1));
                }}
              />
              {instructorStep < 3 ? (
                <BrandButton
                  label={t("onboarding.next")}
                  onPress={() => {
                    if (!validateInstructorStep() || !canGoNext) return;
                    setInstructorStep((current) => Math.min(3, current + 1));
                  }}
                  disabled={!canGoNext}
                />
              ) : (
                <BrandButton
                  label={isSubmitting ? t("onboarding.save") : t("onboarding.complete")}
                  onPress={() => {
                    void submitInstructor();
                  }}
                  disabled={isSubmitting}
                />
              )}
            </View>
          </View>
        </BrandSurface>
      )}

      {errorMessage ? (
        <BrandSurface tone="alt">
          <ThemedText style={{ color: palette.danger }}>{errorMessage}</ThemedText>
        </BrandSurface>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  headerBlock: {
    gap: 4,
  },
  roleRow: {
    gap: 8,
  },
  roleCard: {
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  sectionBlock: {
    gap: 10,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  actionRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
});
