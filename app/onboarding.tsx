import { api } from "@/convex/_generated/api";
import { SPORT_TYPES } from "@/convex/constants";
import { LoadingScreen } from "@/components/loading-screen";
import { OnboardingLocationMap } from "@/components/maps/onboarding-location-map";
import { ThemedText } from "@/components/themed-text";
import {
  ExpressiveButton,
  ExpressiveChip,
  ExpressiveSurface,
  ExpressiveTextField,
} from "@/components/ui/expressive";
import { Brand } from "@/constants/brand";
import { ZONE_OPTIONS } from "@/constants/zones";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useLocationResolution } from "@/hooks/use-location-resolution";
import { getLocationResolveErrorMessage } from "@/lib/location-error-message";
import { omitUndefined } from "@/lib/omit-undefined";
import { registerForPushNotificationsAsync } from "@/lib/push-notifications";
import { useMutation, useQuery } from "convex/react";
import { Redirect, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

type OnboardingRole = "instructor" | "studio";

const MAX_INSTRUCTOR_ZONES = 25;
const MAX_PREVIEW_ZONES = 20;

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

  const [step, setStep] = useState<0 | 1>(0);
  const [selectedRole, setSelectedRole] = useState<OnboardingRole | null>(null);

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
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [isRequestingPush, setIsRequestingPush] = useState(false);

  const [studioName, setStudioName] = useState("");
  const [studioAddress, setStudioAddress] = useState("");
  const [studioContactPhone, setStudioContactPhone] = useState("");
  const [studioLatitude, setStudioLatitude] = useState<number | undefined>();
  const [studioLongitude, setStudioLongitude] = useState<number | undefined>();
  const [studioDetectedZone, setStudioDetectedZone] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const instructorResolver = useLocationResolution();
  const studioResolver = useLocationResolution();

  const filteredZones = useMemo(() => {
    const query = zoneSearch.trim().toLowerCase();
    if (!query) {
      return ZONE_OPTIONS.slice(0, 80);
    }

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

  const previewZoneIds = useMemo(
    () => filteredZones.slice(0, MAX_PREVIEW_ZONES).map((zone) => zone.id),
    [filteredZones],
  );

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

  const resolveInstructorFromAddress = async () => {
    if (!instructorAddress.trim()) {
      setErrorMessage(t("onboarding.errors.instructorAddressRequired"));
      return;
    }

    setErrorMessage(null);
    const result = await instructorResolver.resolveFromAddress(instructorAddress);
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

      if (!resolvedZone || resolvedLatitude === undefined || resolvedLongitude === undefined) {
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

  const mapPane = role ? (
    <ExpressiveSurface tone="glass" style={styles.mapCard}>
      <View style={styles.mapHeader}>
        <ThemedText type="defaultSemiBold">
          {role === "instructor" ? t("onboarding.map.instructorTitle") : t("onboarding.map.studioTitle")}
        </ThemedText>
        <ThemedText style={{ color: palette.textMuted }}>
          {role === "instructor"
            ? t("onboarding.map.instructorHint")
            : t("onboarding.map.studioHint")}
        </ThemedText>
      </View>
      <View style={styles.mapWrap}>
        <OnboardingLocationMap
          mode={role === "instructor" ? "instructorZone" : "studioPin"}
          pin={
            role === "instructor"
              ? instructorLatitude !== undefined && instructorLongitude !== undefined
                ? { latitude: instructorLatitude, longitude: instructorLongitude }
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
          previewZoneIds={role === "instructor" ? previewZoneIds : []}
          focusZoneId={
            role === "instructor"
              ? instructorDetectedZone
              : studioDetectedZone
          }
          onPressZone={toggleZone}
          onPressMap={
            role === "instructor" ? resolveInstructorFromMapPin : resolveStudioFromMapPin
          }
          onUseGps={role === "instructor" ? resolveInstructorFromGps : resolveStudioFromGps}
        />
      </View>
    </ExpressiveSurface>
  ) : null;

  const instructorForm = (
    <ExpressiveSurface tone="elevated" style={styles.formCard}>
      <ThemedText type="subtitle">{t("onboarding.instructorDetailsTitle")}</ThemedText>

      <ExpressiveTextField
        label={t("onboarding.displayName")}
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
      />

      <ExpressiveTextField
        label={t("onboarding.bioOptional")}
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={4}
        style={styles.multilineInput}
      />

      <ExpressiveTextField
        label={t("onboarding.hourlyRateOptional")}
        value={hourlyRate}
        onChangeText={setHourlyRate}
        keyboardType="decimal-pad"
      />

      <View style={styles.sectionBlock}>
        <ThemedText type="defaultSemiBold">{t("onboarding.sportsTitle")}</ThemedText>
        <View style={styles.chipGrid}>
          {SPORT_TYPES.map((sport) => (
            <ExpressiveChip
              key={sport}
              label={toDisplayLabel(sport)}
              selected={selectedSports.includes(sport)}
              onPress={() => toggleSport(sport)}
            />
          ))}
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <ExpressiveTextField
          label={t("onboarding.zoneSearchPlaceholder")}
          value={zoneSearch}
          onChangeText={setZoneSearch}
        />

        <ExpressiveTextField
          label={t("onboarding.location.instructorAddressOptional")}
          value={instructorAddress}
          onChangeText={(value) => {
            setInstructorAddress(value);
            setInstructorLatitude(undefined);
            setInstructorLongitude(undefined);
            setInstructorDetectedZone(null);
          }}
        />

        <View style={styles.inlineActions}>
          <ExpressiveButton
            variant="secondary"
            disabled={instructorResolver.isResolving}
            label={
              instructorResolver.isResolving
                ? t("onboarding.location.resolvingAddress")
                : t("onboarding.location.findByAddress")
            }
            onPress={() => {
              void resolveInstructorFromAddress();
            }}
          />
        </View>

        <ThemedText style={{ color: palette.textMuted }}>
          {instructorDetectedZone
            ? t("onboarding.location.detectedZone", { zone: instructorDetectedZone })
            : t("onboarding.location.zoneOptionalHint")}
        </ThemedText>

        <View style={styles.chipGrid}>
          {selectedZones.map((zoneId) => {
            const zone = ZONE_OPTIONS.find((item) => item.id === zoneId);
            const label = zone ? zone.label[language] : zoneId;
            return (
              <ExpressiveChip
                key={zoneId}
                label={label}
                selected
                onPress={() => toggleZone(zoneId)}
              />
            );
          })}
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <ExpressiveButton
          variant={pushToken ? "secondary" : "primary"}
          disabled={isRequestingPush}
          label={
            isRequestingPush
              ? t("onboarding.push.requesting")
              : pushToken
                ? t("onboarding.push.enabled")
                : t("onboarding.push.requestPermission")
          }
          onPress={() => {
            void requestPushPermission();
          }}
        />
      </View>
    </ExpressiveSurface>
  );

  const studioForm = (
    <ExpressiveSurface tone="elevated" style={styles.formCard}>
      <ThemedText type="subtitle">{t("onboarding.studioDetailsTitle")}</ThemedText>

      <ExpressiveTextField
        label={t("onboarding.studioName")}
        value={studioName}
        onChangeText={setStudioName}
      />

      <ExpressiveTextField
        label={t("onboarding.studioAddress")}
        value={studioAddress}
        onChangeText={(value) => {
          setStudioAddress(value);
          setStudioLatitude(undefined);
          setStudioLongitude(undefined);
          setStudioDetectedZone(null);
        }}
      />

      <ExpressiveTextField
        label={t("onboarding.phoneOptional")}
        value={studioContactPhone}
        onChangeText={setStudioContactPhone}
      />

      <ExpressiveButton
        variant="secondary"
        disabled={studioResolver.isResolving}
        label={
          studioResolver.isResolving
            ? t("onboarding.location.resolvingAddress")
            : t("onboarding.location.findByAddress")
        }
        onPress={() => {
          void resolveStudioFromAddress();
        }}
      />

      <ThemedText style={{ color: palette.textMuted }}>
        {studioDetectedZone
          ? t("onboarding.location.detectedZone", { zone: studioDetectedZone })
          : t("onboarding.location.zonePending")}
      </ThemedText>
    </ExpressiveSurface>
  );

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.appBg }]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <ExpressiveSurface tone="glass" style={styles.headerCard}>
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
      </ExpressiveSurface>

      {step === 0 ? (
        <ExpressiveSurface tone="elevated" style={styles.roleCard}>
          <ThemedText type="defaultSemiBold">{t("onboarding.rolePrompt")}</ThemedText>
          <View style={styles.roleGrid}>
            <ExpressiveChip
              label={t("onboarding.roleInstructorTitle")}
              selected={role === "instructor"}
              onPress={() => setSelectedRole("instructor")}
            />
            <ExpressiveChip
              label={t("onboarding.roleStudioTitle")}
              selected={role === "studio"}
              onPress={() => setSelectedRole("studio")}
            />
          </View>
          <ThemedText style={{ color: palette.textMuted }}>
            {role === "instructor"
              ? t("onboarding.roleInstructorDescription")
              : role === "studio"
                ? t("onboarding.roleStudioDescription")
                : t("onboarding.roleSelectHint")}
          </ThemedText>

          <View style={styles.navRow}>
            <ExpressiveButton
              label={t("onboarding.next")}
              disabled={!role}
              onPress={() => goToProfileStep()}
            />
          </View>
        </ExpressiveSurface>
      ) : role === "instructor" ? (
        <View style={[styles.stepTwoWrap, isDesktop ? styles.stepTwoDesktop : null]}>
          {instructorForm}
          {mapPane}
        </View>
      ) : role === "studio" ? (
        <View style={[styles.stepTwoWrap, isDesktop ? styles.stepTwoDesktop : null]}>
          {studioForm}
          {mapPane}
        </View>
      ) : null}

      {step === 1 ? (
        <ExpressiveSurface tone="glass">
          <View style={styles.navRowSplit}>
            <ExpressiveButton
              variant="secondary"
              label={t("onboarding.back")}
              onPress={() => {
                setStep(0);
              }}
            />

            <ExpressiveButton
              label={isSubmitting ? t("onboarding.save") : t("onboarding.complete")}
              disabled={isSubmitting}
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
        </ExpressiveSurface>
      ) : null}

      {errorMessage ? (
        <ExpressiveSurface tone="elevated">
          <ThemedText style={{ color: palette.danger }}>{errorMessage}</ThemedText>
        </ExpressiveSurface>
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
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  navRow: {
    marginTop: 4,
  },
  navRowSplit: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
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
});
