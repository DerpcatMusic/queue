import { useMutation, useQuery } from "convex/react";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { LoadingScreen } from "@/components/loading-screen";
import { QueueMap } from "@/components/maps/queue-map";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { KitChip, KitSurface, KitTextField } from "@/components/ui/kit";
import { ZONE_OPTIONS } from "@/constants/zones";
import { api } from "@/convex/_generated/api";
import { SPORT_TYPES } from "@/convex/constants";
import { useBrand } from "@/hooks/use-brand";
import { useLocationResolution } from "@/hooks/use-location-resolution";
import { getLocationResolveErrorMessage } from "@/lib/location-error-message";
import { omitUndefined } from "@/lib/omit-undefined";
import { registerForPushNotificationsAsync } from "@/lib/push-notifications";

type OnboardingRole = "instructor" | "studio";
type OnboardingStep = 0 | 1 | 2;

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

function StepBadge({
  current,
  total,
  palette,
}: {
  current: number;
  total: number;
  palette: ReturnType<typeof useBrand>;
}) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surface,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <ThemedText
        type="micro"
        style={{
          color: palette.textMuted,
          fontVariant: ["tabular-nums"],
          letterSpacing: 0.2,
        }}
      >
        {`Step ${current} of ${total}`}
      </ThemedText>
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const palette = useBrand();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 980;
  const language = i18n.resolvedLanguage?.startsWith("he") ? "he" : "en";

  const currentUser = useQuery(api.users.getCurrentUser);
  const completeInstructorOnboarding = useMutation(
    api.onboarding.completeInstructorOnboarding,
  );
  const completeStudioOnboarding = useMutation(
    api.onboarding.completeStudioOnboarding,
  );

  const [step, setStep] = useState<OnboardingStep>(0);
  const [selectedRole, setSelectedRole] = useState<OnboardingRole | null>(null);
  const effectiveRole: OnboardingRole | null =
    selectedRole ??
    (currentUser?.role === "instructor" || currentUser?.role === "studio"
      ? currentUser.role
      : null);
  const isInstructorFlow = effectiveRole === "instructor";
  const totalSteps = isInstructorFlow ? 3 : 2;
  const currentStep = step + 1;

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [instructorAddress, setInstructorAddress] = useState("");
  const [instructorLatitude, setInstructorLatitude] = useState<
    number | undefined
  >();
  const [instructorLongitude, setInstructorLongitude] = useState<
    number | undefined
  >();
  const [instructorDetectedZone, setInstructorDetectedZone] = useState<
    string | null
  >(null);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [isRequestingPush, setIsRequestingPush] = useState(false);

  const [studioName, setStudioName] = useState("");
  const [studioAddress, setStudioAddress] = useState("");
  const [studioContactPhone, setStudioContactPhone] = useState("");
  const [studioLatitude, setStudioLatitude] = useState<number | undefined>();
  const [studioLongitude, setStudioLongitude] = useState<number | undefined>();
  const [studioDetectedZone, setStudioDetectedZone] = useState<string | null>(
    null,
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const instructorResolver = useLocationResolution();
  const studioResolver = useLocationResolution();

  if (currentUser === undefined) {
    return <LoadingScreen label={t("onboarding.loading")} />;
  }

  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser.onboardingComplete && !(isInstructorFlow && step === 2)) {
    return <Redirect href="/" />;
  }

  const role = effectiveRole;

  const toggleSport = (sport: string) => {
    setSelectedSports((current) =>
      current.includes(sport)
        ? current.filter((value) => value !== sport)
        : [...current, sport],
    );
  };

  const toggleZone = (zoneId: string) => {
    setSelectedZones((current) => {
      if (current.includes(zoneId)) {
        return current.filter((zone) => zone !== zoneId);
      }
      if (current.length >= MAX_INSTRUCTOR_ZONES) {
        setErrorMessage(t("onboarding.errors.tooManyZones"));
        return current;
      }
      return [...current, zoneId];
    });
  };

  const applyInstructorResolution = (
    resolved: {
      address: string;
      latitude: number;
      longitude: number;
      zoneId: string;
    },
    autoAddZone: boolean,
  ) => {
    setInstructorAddress(resolved.address);
    setInstructorLatitude(resolved.latitude);
    setInstructorLongitude(resolved.longitude);
    setInstructorDetectedZone(resolved.zoneId);

    if (autoAddZone) {
      setSelectedZones((current) => {
        if (current.includes(resolved.zoneId)) {
          return current;
        }
        if (current.length >= MAX_INSTRUCTOR_ZONES) {
          return current;
        }
        return [...current, resolved.zoneId];
      });
    }
  };

  const applyStudioResolution = (resolved: {
    address: string;
    latitude: number;
    longitude: number;
    zoneId: string;
  }) => {
    setStudioAddress(resolved.address);
    setStudioLatitude(resolved.latitude);
    setStudioLongitude(resolved.longitude);
    setStudioDetectedZone(resolved.zoneId);
  };

  const handleInstructorPlaceSelected = (coords: {
    latitude: number;
    longitude: number;
    formattedAddress: string;
  }) => {
    setInstructorAddress(coords.formattedAddress);
    setInstructorLatitude(coords.latitude);
    setInstructorLongitude(coords.longitude);
    setErrorMessage(null);
    void instructorResolver
      .resolveFromCoordinates({
        latitude: coords.latitude,
        longitude: coords.longitude,
      })
      .then((result) => {
        if (!result.ok) return;
        applyInstructorResolution(result.data.value, true);
      });
  };

  const handleStudioPlaceSelected = (coords: {
    latitude: number;
    longitude: number;
    formattedAddress: string;
  }) => {
    setStudioAddress(coords.formattedAddress);
    setStudioLatitude(coords.latitude);
    setStudioLongitude(coords.longitude);
    setErrorMessage(null);
    void studioResolver
      .resolveFromCoordinates({
        latitude: coords.latitude,
        longitude: coords.longitude,
      })
      .then((result) => {
        if (!result.ok) return;
        applyStudioResolution(result.data.value);
      });
  };

  const resolveInstructorFromAddress = async () => {
    if (!instructorAddress.trim()) {
      setErrorMessage(t("onboarding.errors.instructorAddressRequired"));
      return;
    }

    setErrorMessage(null);
    const result =
      await instructorResolver.resolveFromAddress(instructorAddress);
    if (!result.ok) {
      setErrorMessage(
        getLocationResolveErrorMessage({
          code: result.error.code,
          fallbackMessage: result.error.message,
          fallbackKey: "failedToResolveAddress",
          translationPrefix: "onboarding.errors",
          t,
        }),
      );
      return;
    }

    applyInstructorResolution(result.data.value, true);
  };

  const resolveInstructorFromGps = async () => {
    setErrorMessage(null);
    const result = await instructorResolver.resolveFromGps();
    if (!result.ok) {
      setErrorMessage(
        getLocationResolveErrorMessage({
          code: result.error.code,
          fallbackMessage: result.error.message,
          fallbackKey: "failedToResolveGps",
          translationPrefix: "onboarding.errors",
          t,
        }),
      );
      return;
    }

    applyInstructorResolution(result.data.value, true);
  };

  const resolveInstructorFromMapPin = async (pin: {
    latitude: number;
    longitude: number;
  }) => {
    setErrorMessage(null);
    const result = await instructorResolver.resolveFromCoordinates(pin);
    if (!result.ok) {
      setErrorMessage(
        getLocationResolveErrorMessage({
          code: result.error.code,
          fallbackMessage: result.error.message,
          fallbackKey: "failedToResolveGps",
          translationPrefix: "onboarding.errors",
          t,
        }),
      );
      return;
    }

    applyInstructorResolution(result.data.value, true);
  };

  const resolveStudioFromAddress = async () => {
    if (!studioAddress.trim()) {
      setErrorMessage(t("onboarding.errors.studioAddressRequired"));
      return;
    }

    setErrorMessage(null);
    const result = await studioResolver.resolveFromAddress(studioAddress);
    if (!result.ok) {
      setErrorMessage(
        getLocationResolveErrorMessage({
          code: result.error.code,
          fallbackMessage: result.error.message,
          fallbackKey: "failedToResolveAddress",
          translationPrefix: "onboarding.errors",
          t,
        }),
      );
      return;
    }

    applyStudioResolution(result.data.value);
  };

  const resolveStudioFromGps = async () => {
    setErrorMessage(null);
    const result = await studioResolver.resolveFromGps();
    if (!result.ok) {
      setErrorMessage(
        getLocationResolveErrorMessage({
          code: result.error.code,
          fallbackMessage: result.error.message,
          fallbackKey: "failedToResolveGps",
          translationPrefix: "onboarding.errors",
          t,
        }),
      );
      return;
    }

    applyStudioResolution(result.data.value);
  };

  const resolveStudioFromMapPin = async (pin: {
    latitude: number;
    longitude: number;
  }) => {
    setErrorMessage(null);
    const result = await studioResolver.resolveFromCoordinates(pin);
    if (!result.ok) {
      setErrorMessage(
        getLocationResolveErrorMessage({
          code: result.error.code,
          fallbackMessage: result.error.message,
          fallbackKey: "failedToResolveGps",
          translationPrefix: "onboarding.errors",
          t,
        }),
      );
      return;
    }

    applyStudioResolution(result.data.value);
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

  const goToProfileStep = () => {
    if (!role) {
      setErrorMessage(t("onboarding.errors.roleRequired"));
      return;
    }
    setErrorMessage(null);
    setStep(1);
  };

  const submitInstructor = async () => {
    if (!displayName.trim()) {
      setErrorMessage(t("onboarding.errors.displayNameRequired"));
      return;
    }

    if (selectedSports.length === 0) {
      setErrorMessage(t("onboarding.errors.selectAtLeastOneSport"));
      return;
    }

    if (selectedZones.length === 0) {
      setErrorMessage(t("onboarding.errors.selectAtLeastOneZone"));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const hourly = Number.parseFloat(hourlyRate);
      const hourlyRateExpectation =
        Number.isFinite(hourly) && hourly > 0 ? hourly : undefined;

      await completeInstructorOnboarding({
        displayName: displayName.trim(),
        sports: selectedSports,
        zones: selectedZones,
        notificationsEnabled: Boolean(pushToken),
        ...omitUndefined({
          bio: trimOptional(bio),
          address: trimOptional(instructorAddress),
          latitude: instructorLatitude,
          longitude: instructorLongitude,
          expoPushToken: pushToken ?? undefined,
          hourlyRateExpectation,
        }),
      });

      setStep(2);
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

      if (
        !resolvedZone ||
        resolvedLatitude === undefined ||
        resolvedLongitude === undefined
      ) {
        const result = await studioResolver.resolveFromAddress(studioAddress);
        if (!result.ok) {
          throw new Error(
            getLocationResolveErrorMessage({
              code: result.error.code,
              fallbackMessage: result.error.message,
              fallbackKey: "failedToResolveAddress",
              translationPrefix: "onboarding.errors",
              t,
            }),
          );
        }

        const resolved = result.data.value;
        applyStudioResolution(resolved);
        resolvedZone = resolved.zoneId;
        resolvedLatitude = resolved.latitude;
        resolvedLongitude = resolved.longitude;
      }

      if (
        !resolvedZone ||
        resolvedLatitude === undefined ||
        resolvedLongitude === undefined
      ) {
        throw new Error(t("onboarding.errors.failedToResolveAddress"));
      }

      await completeStudioOnboarding({
        studioName: studioName.trim(),
        address: studioAddress.trim(),
        zone: resolvedZone,
        sports: [],
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

  const mapPane = role ? (
    <KitSurface tone="glass" style={styles.mapCard}>
      <View style={styles.mapHeader}>
        <View style={styles.mapHeaderRow}>
          <ThemedText type="defaultSemiBold">
            {role === "instructor"
              ? t("onboarding.map.instructorTitle")
              : t("onboarding.map.studioTitle")}
          </ThemedText>
          <ThemedText type="micro" style={{ color: palette.textMuted }}>
            {role === "instructor"
              ? t("mapTab.selectedZones", { count: selectedZones.length })
              : studioDetectedZone
                ? studioDetectedZone
                : t("profile.roles.pending")}
          </ThemedText>
        </View>
        <ThemedText style={{ color: palette.textMuted }}>
          {role === "instructor"
            ? t("onboarding.map.instructorHint")
            : t("onboarding.map.studioHint")}
        </ThemedText>
      </View>
      <View style={styles.mapWrap}>
        <QueueMap
          mode={role === "instructor" ? "zoneSelect" : "pinDrop"}
          pin={
            role === "instructor"
              ? instructorLatitude !== undefined &&
                instructorLongitude !== undefined
                ? {
                    latitude: instructorLatitude,
                    longitude: instructorLongitude,
                  }
                : null
              : studioLatitude !== undefined && studioLongitude !== undefined
                ? { latitude: studioLatitude, longitude: studioLongitude }
                : null
          }
          selectedZoneIds={
            role === "instructor"
              ? selectedZones
              : studioDetectedZone
                ? [studioDetectedZone]
                : []
          }
          focusZoneId={
            role === "instructor" ? instructorDetectedZone : studioDetectedZone
          }
          onPressZone={toggleZone}
          onPressMap={
            role === "instructor"
              ? resolveInstructorFromMapPin
              : resolveStudioFromMapPin
          }
          onUseGps={
            role === "instructor"
              ? resolveInstructorFromGps
              : resolveStudioFromGps
          }
        />
      </View>
    </KitSurface>
  ) : null;

  const instructorForm = (
    <KitSurface tone="elevated" style={styles.formCard}>
      <ThemedText type="subtitle">
        {t("onboarding.instructorDetailsTitle")}
      </ThemedText>
      <KitTextField
        label={t("onboarding.displayName")}
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
      />

      <KitTextField
        label={t("onboarding.bioOptional")}
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={4}
        style={styles.multilineInput}
      />

      <KitTextField
        label={t("onboarding.hourlyRateOptional")}
        value={hourlyRate}
        onChangeText={setHourlyRate}
        keyboardType="decimal-pad"
      />

      <View style={styles.sectionBlock}>
        <ThemedText type="defaultSemiBold">
          {t("onboarding.sportsTitle")}
        </ThemedText>
        <View style={styles.chipGrid}>
          {SPORT_TYPES.map((sport) => (
            <KitChip
              key={sport}
              label={toDisplayLabel(sport)}
              selected={selectedSports.includes(sport)}
              onPress={() => toggleSport(sport)}
            />
          ))}
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <ThemedText type="defaultSemiBold">
          {t("profile.settings.location.title")}
        </ThemedText>
        <AddressAutocomplete
          value={instructorAddress}
          onChangeText={(value) => {
            setInstructorAddress(value);
            setInstructorLatitude(undefined);
            setInstructorLongitude(undefined);
            setInstructorDetectedZone(null);
          }}
          onPlaceSelected={handleInstructorPlaceSelected}
          placeholder={t("onboarding.location.instructorAddressOptional")}
          placeholderTextColor={palette.textMuted}
          borderColor={palette.border}
          textColor={palette.text}
          backgroundColor={palette.appBg}
          surfaceColor={palette.surface}
          mutedTextColor={palette.textMuted}
        />

        <View style={styles.inlineActions}>
          <ActionButton
            disabled={instructorResolver.isResolving}
            label={
              instructorResolver.isResolving
                ? t("onboarding.location.resolvingAddress")
                : t("onboarding.location.findByAddress")
            }
            palette={palette}
            tone="secondary"
            onPress={() => {
              void resolveInstructorFromAddress();
            }}
          />
        </View>

        <ThemedText style={{ color: palette.textMuted }}>
          {instructorDetectedZone
            ? t("onboarding.location.detectedZone", {
                zone: instructorDetectedZone,
              })
            : t("onboarding.location.zoneOptionalHint")}
        </ThemedText>

        <View style={styles.chipGrid}>
          {selectedZones.map((zoneId) => {
            const zone = ZONE_OPTIONS.find((item) => item.id === zoneId);
            const label = zone ? zone.label[language] : zoneId;
            return (
              <KitChip
                key={zoneId}
                label={label}
                selected
                onPress={() => toggleZone(zoneId)}
              />
            );
          })}
        </View>
      </View>
    </KitSurface>
  );

  const studioForm = (
    <KitSurface tone="elevated" style={styles.formCard}>
      <ThemedText type="subtitle">
        {t("onboarding.studioDetailsTitle")}
      </ThemedText>
      <KitTextField
        label={t("onboarding.studioName")}
        value={studioName}
        onChangeText={setStudioName}
      />

      <AddressAutocomplete
        value={studioAddress}
        onChangeText={(value) => {
          setStudioAddress(value);
          setStudioLatitude(undefined);
          setStudioLongitude(undefined);
          setStudioDetectedZone(null);
        }}
        onPlaceSelected={handleStudioPlaceSelected}
        placeholder={t("onboarding.studioAddress")}
        placeholderTextColor={palette.textMuted}
        borderColor={palette.border}
        textColor={palette.text}
        backgroundColor={palette.appBg}
        surfaceColor={palette.surface}
        mutedTextColor={palette.textMuted}
      />

      <KitTextField
        label={t("onboarding.phoneOptional")}
        value={studioContactPhone}
        onChangeText={setStudioContactPhone}
      />

      <ActionButton
        disabled={studioResolver.isResolving}
        label={
          studioResolver.isResolving
            ? t("onboarding.location.resolvingAddress")
            : t("onboarding.location.findByAddress")
        }
        palette={palette}
        tone="secondary"
        fullWidth
        onPress={() => {
          void resolveStudioFromAddress();
        }}
      />

      <ThemedText style={{ color: palette.textMuted }}>
        {studioDetectedZone
          ? t("onboarding.location.detectedZone", { zone: studioDetectedZone })
          : t("onboarding.location.zonePending")}
      </ThemedText>
    </KitSurface>
  );

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.appBg }]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <KitSurface tone="glass" style={styles.headerCard}>
        <StepBadge current={currentStep} total={totalSteps} palette={palette} />
        <ThemedText type="title">{t("onboarding.title")}</ThemedText>
        <ThemedText style={{ color: palette.textMuted }}>
          {t("onboarding.subtitle")}
        </ThemedText>

        <View style={styles.progressRow}>
          <View
            style={[
              styles.progressSegment,
              {
                backgroundColor: step >= 0 ? palette.primary : palette.border,
              },
            ]}
          />
          <View
            style={[
              styles.progressSegment,
              {
                backgroundColor: step >= 1 ? palette.primary : palette.border,
              },
            ]}
          />
        </View>
      </KitSurface>

      {step === 0 ? (
        <KitSurface tone="elevated" style={styles.roleCard}>
          <ThemedText type="defaultSemiBold">
            {t("onboarding.rolePrompt")}
          </ThemedText>
          <View style={styles.roleGrid}>
            <View style={styles.roleOption}>
              <ActionButton
                label={t("onboarding.roleInstructorTitle")}
                onPress={() => setSelectedRole("instructor")}
                palette={palette}
                tone={role === "instructor" ? "primary" : "secondary"}
                fullWidth
              />
              <ThemedText type="caption" style={{ color: palette.textMuted }}>
                {t("onboarding.roleInstructorDescription")}
              </ThemedText>
            </View>
            <View style={styles.roleOption}>
              <ActionButton
                label={t("onboarding.roleStudioTitle")}
                onPress={() => setSelectedRole("studio")}
                palette={palette}
                tone={role === "studio" ? "primary" : "secondary"}
                fullWidth
              />
              <ThemedText type="caption" style={{ color: palette.textMuted }}>
                {t("onboarding.roleStudioDescription")}
              </ThemedText>
            </View>
          </View>
          <ThemedText style={{ color: palette.textMuted }}>
            {t("onboarding.roleSelectHint")}
          </ThemedText>

          <View style={styles.navRow}>
            <ActionButton
              label={t("onboarding.next")}
              disabled={!role}
              palette={palette}
              fullWidth
              onPress={() => goToProfileStep()}
            />
          </View>
        </KitSurface>
      ) : step === 1 && role === "instructor" ? (
        <View
          style={[styles.stepTwoWrap, isDesktop ? styles.stepTwoDesktop : null]}
        >
          {instructorForm}
          {mapPane}
        </View>
      ) : step === 1 && role === "studio" ? (
        <View
          style={[styles.stepTwoWrap, isDesktop ? styles.stepTwoDesktop : null]}
        >
          {studioForm}
          {mapPane}
        </View>
      ) : step === 2 && role === "instructor" ? (
        <KitSurface tone="elevated" style={styles.verifyCard}>
          <ThemedText type="subtitle">
            {t("onboarding.verification.subtitle")}
          </ThemedText>
          <ThemedText style={{ color: palette.textMuted }}>
            {t("onboarding.verification.body")}
          </ThemedText>

          {!pushToken ? (
            <ActionButton
              disabled={isRequestingPush}
              label={
                isRequestingPush
                  ? t("onboarding.push.requesting")
                  : t("onboarding.push.requestPermission")
              }
              palette={palette}
              tone="secondary"
              fullWidth
              onPress={() => {
                void requestPushPermission();
              }}
            />
          ) : null}

          <View style={styles.verifyActions}>
            <ActionButton
              label={t("onboarding.verification.verifyNow")}
              palette={palette}
              fullWidth
              onPress={() => {
                router.replace("/instructor/profile/identity-verification");
              }}
            />
            <ActionButton
              label={t("onboarding.verification.later")}
              palette={palette}
              tone="secondary"
              fullWidth
              onPress={() => {
                router.replace("/");
              }}
            />
          </View>
        </KitSurface>
      ) : null}

      {step === 1 ? (
        <KitSurface tone="glass">
          <View style={styles.navRowSplit}>
            <View style={styles.navAction}>
              <ActionButton
                label={t("onboarding.back")}
                palette={palette}
                tone="secondary"
                fullWidth
                onPress={() => {
                  setStep(0);
                }}
              />
            </View>

            <View style={styles.navAction}>
              <ActionButton
                label={
                  isSubmitting
                    ? t("onboarding.save")
                    : role === "instructor"
                      ? t("onboarding.continue")
                      : t("onboarding.complete")
                }
                disabled={isSubmitting}
                palette={palette}
                fullWidth
                onPress={() => {
                  if (role === "instructor") {
                    void submitInstructor();
                    return;
                  }
                  if (role === "studio") {
                    void submitStudio();
                  }
                }}
              />
            </View>
          </View>
        </KitSurface>
      ) : null}

      {errorMessage ? (
        <KitSurface tone="elevated">
          <ThemedText style={{ color: palette.danger }}>
            {errorMessage}
          </ThemedText>
        </KitSurface>
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
  headerCard: {
    gap: 8,
  },
  progressRow: {
    flexDirection: "row",
    gap: 8,
  },
  progressSegment: {
    flex: 1,
    height: 6,
    borderRadius: 999,
  },
  roleCard: {
    gap: 12,
  },
  roleGrid: {
    gap: 10,
  },
  roleOption: {
    gap: 6,
  },
  navRow: {
    marginTop: 4,
  },
  navRowSplit: {
    flexDirection: "row",
    gap: 10,
  },
  navAction: {
    flex: 1,
  },
  stepTwoWrap: {
    gap: 12,
  },
  stepTwoDesktop: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  formCard: {
    gap: 12,
    flex: 1,
    minWidth: 320,
  },
  mapCard: {
    flex: 1,
    minWidth: 320,
    minHeight: 360,
    gap: 10,
  },
  mapHeader: {
    gap: 4,
  },
  mapHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  mapWrap: {
    flex: 1,
    minHeight: 300,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sectionBlock: {
    gap: 8,
  },
  inlineActions: {
    flexDirection: "row",
    gap: 8,
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  verifyCard: {
    gap: 12,
  },
  verifyActions: {
    gap: 10,
  },
});
