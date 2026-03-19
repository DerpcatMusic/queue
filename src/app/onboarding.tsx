import { useAuthActions } from "@convex-dev/auth/react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMutation, useQuery } from "convex/react";
import { Redirect, useRouter } from "expo-router";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  I18nManager,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { GlobalTopSheet } from "@/components/layout/global-top-sheet";
import {
  ScrollSheetProvider,
  useCollapsedSheetHeight,
} from "@/components/layout/scroll-sheet-provider";
import { GlobalTopSheetProvider, useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { LoadingScreen } from "@/components/loading-screen";
import { QueueMap } from "@/components/maps/queue-map";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { ChoicePill } from "@/components/ui/choice-pill";
import { IconButton } from "@/components/ui/icon-button";
import { KitChip, KitTextField } from "@/components/ui/kit";
import { SheetHeaderBlock } from "@/components/ui/sheet-header-block";
import { BrandSpacing } from "@/constants/brand";
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
const STEP_EXIT_MS = 170;
const STEP_ENTER_MS = 220;
const DETAILS_READY_DELAY_MS = 110;

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

function OnboardingStageLayer({
  phase,
  direction,
  children,
}: {
  phase: "idle" | "enter" | "exit";
  direction: 1 | -1;
  children: React.ReactNode;
}) {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const incomingOffset = 20 * direction;
    const outgoingOffset = -18 * direction;

    if (phase === "enter") {
      translateX.value = incomingOffset;
      opacity.value = 0;
      translateX.value = withTiming(0, { duration: STEP_ENTER_MS });
      opacity.value = withTiming(1, { duration: STEP_ENTER_MS });
      return;
    }

    if (phase === "exit") {
      translateX.value = withTiming(outgoingOffset, { duration: STEP_EXIT_MS });
      opacity.value = withTiming(0, { duration: STEP_EXIT_MS });
      return;
    }

    translateX.value = 0;
    opacity.value = 1;
  }, [direction, opacity, phase, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[{ flex: 1, width: "100%" }, animatedStyle]}>{children}</Animated.View>
  );
}

function OnboardingSheetHeader({
  title,
  subtitle,
  currentStep,
  totalSteps,
  palette,
  signOutLabel,
  onSignOut,
}: {
  title: string;
  subtitle: string;
  currentStep: number;
  totalSteps: number;
  palette: ReturnType<typeof useBrand>;
  signOutLabel: string;
  onSignOut: () => void;
}) {
  return (
    <SheetHeaderBlock
      title={title}
      subtitle={subtitle}
      progressCount={totalSteps}
      progressIndex={currentStep}
      trailingLabel={signOutLabel}
      trailingIcon={<MaterialIcons name="logout" size={18} color={palette.danger as string} />}
      onPressTrailing={onSignOut}
      tone="primary"
      trailingTone="danger"
    />
  );
}

export default function OnboardingScreen() {
  return (
    <ScrollSheetProvider>
      <GlobalTopSheetProvider>
        <OnboardingScreenContent />
      </GlobalTopSheetProvider>
    </ScrollSheetProvider>
  );
}

function OnboardingScreenContent() {
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const palette = useBrand();
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 980;
  const language = i18n.resolvedLanguage?.startsWith("he") ? "he" : "en";
  const { signOut } = useAuthActions();

  const currentUser = useQuery(api.users.getCurrentUser);
  const completeInstructorOnboarding = useMutation(api.onboarding.completeInstructorOnboarding);
  const completeStudioOnboarding = useMutation(api.onboarding.completeStudioOnboarding);

  const [step, setStep] = useState<OnboardingStep>(0);
  const [visibleStep, setVisibleStep] = useState<OnboardingStep>(0);
  const [detailsReady, setDetailsReady] = useState(false);
  const [showLocationSection, setShowLocationSection] = useState(false);
  const [stepTransition, setStepTransition] = useState<{
    direction: 1 | -1;
    phase: "idle" | "enter" | "exit";
    targetStep: OnboardingStep | null;
  }>({
    direction: 1,
    phase: "idle",
    targetStep: null,
  });
  const [selectedRole, setSelectedRole] = useState<OnboardingRole | null>(null);
  const effectiveRole: OnboardingRole | null =
    selectedRole ??
    (currentUser?.role === "instructor" || currentUser?.role === "studio"
      ? currentUser.role
      : null);
  const role = effectiveRole;
  const isInstructorFlow = effectiveRole === "instructor";
  const totalSteps = isInstructorFlow ? 3 : 2;
  const displayedStep = stepTransition.phase === "idle" ? step : visibleStep;
  const currentStep = displayedStep + 1;

  const onboardingSheetTitle =
    displayedStep === 0
      ? t("onboarding.title")
      : displayedStep === 2
        ? t("onboarding.verification.title")
        : role === "studio"
          ? t("onboarding.studioDetailsTitle")
          : t("onboarding.instructorDetailsTitle");
  const onboardingSheetSubtitle =
    displayedStep === 0
      ? t("onboarding.subtitle")
      : displayedStep === 2
        ? t("onboarding.verification.body")
        : role === "studio"
          ? t("onboarding.sheetStudioSubtitle")
          : t("onboarding.sheetInstructorSubtitle");

  const onboardingSheetConfig = useMemo(
    () => ({
      stickyHeader: (
        <OnboardingSheetHeader
          title={onboardingSheetTitle}
          subtitle={onboardingSheetSubtitle}
          currentStep={currentStep}
          totalSteps={totalSteps}
          palette={palette}
          signOutLabel={t("auth.signOutButton")}
          onSignOut={() => {
            void signOut();
          }}
        />
      ),
      backgroundColor: palette.primary as string,
      topInsetColor: palette.primary as string,
      padding: {
        horizontal: BrandSpacing.lg,
        vertical: BrandSpacing.sm,
      },
      steps: [0.24],
      initialStep: 0,
    }),
    [currentStep, onboardingSheetSubtitle, onboardingSheetTitle, palette, signOut, t, totalSteps],
  );

  useGlobalTopSheet("onboarding", onboardingSheetConfig);
  const nextArrowIcon = (
    <MaterialIcons
      name={I18nManager.isRTL ? "arrow-back" : "arrow-forward"}
      size={24}
      color={palette.onPrimary as string}
    />
  );

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
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
  const stepTransitionTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const onboardingScrollRef = useRef<ScrollView>(null);

  useEffect(
    () => () => {
      for (const timer of stepTransitionTimersRef.current) {
        clearTimeout(timer);
      }
      stepTransitionTimersRef.current = [];
    },
    [],
  );

  if (currentUser === undefined) {
    return <LoadingScreen label={t("onboarding.loading")} />;
  }

  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser.onboardingComplete && !(isInstructorFlow && step === 2)) {
    return <Redirect href="/" />;
  }

  const toggleSport = (sport: string) => {
    setSelectedSports((current) =>
      current.includes(sport) ? current.filter((value) => value !== sport) : [...current, sport],
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

  const resolveInstructorFromMapPin = async (pin: { latitude: number; longitude: number }) => {
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

  const resolveStudioFromMapPin = async (pin: { latitude: number; longitude: number }) => {
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

  const revealLocationSection = () => {
    startTransition(() => {
      setShowLocationSection(true);
    });
    requestAnimationFrame(() => {
      onboardingScrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  const goToProfileStep = () => {
    if (!role) {
      setErrorMessage(t("onboarding.errors.roleRequired"));
      return;
    }
    setErrorMessage(null);

    if (step === 1) {
      return;
    }

    for (const timer of stepTransitionTimersRef.current) {
      clearTimeout(timer);
    }
    stepTransitionTimersRef.current = [];
    setDetailsReady(false);
    setShowLocationSection(false);

    const nextStep: OnboardingStep = 1;
    const direction: 1 | -1 = nextStep > visibleStep ? 1 : -1;

    setStep(nextStep);
    setStepTransition({
      direction,
      phase: "exit",
      targetStep: nextStep,
    });

    stepTransitionTimersRef.current.push(
      setTimeout(() => {
        startTransition(() => {
          setVisibleStep(nextStep);
          setStepTransition((current) =>
            current?.targetStep === nextStep ? { ...current, phase: "enter" } : current,
          );
        });
      }, STEP_EXIT_MS),
    );

    stepTransitionTimersRef.current.push(
      setTimeout(() => {
        setStepTransition({
          direction,
          phase: "idle",
          targetStep: null,
        });
      }, STEP_EXIT_MS + STEP_ENTER_MS),
    );

    stepTransitionTimersRef.current.push(
      setTimeout(
        () => {
          setDetailsReady(true);
        },
        STEP_EXIT_MS + STEP_ENTER_MS + DETAILS_READY_DELAY_MS,
      ),
    );
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
      const hourlyRateExpectation = Number.isFinite(hourly) && hourly > 0 ? hourly : undefined;

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

  const mapPane =
    role && showLocationSection ? (
      <View
        style={[
          styles.mapPanel,
          {
            backgroundColor: palette.surface as string,
          },
        ]}
      >
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
                ? instructorLatitude !== undefined && instructorLongitude !== undefined
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
              role === "instructor" ? selectedZones : studioDetectedZone ? [studioDetectedZone] : []
            }
            focusZoneId={role === "instructor" ? instructorDetectedZone : studioDetectedZone}
            onPressZone={toggleZone}
            onPressMap={
              role === "instructor" ? resolveInstructorFromMapPin : resolveStudioFromMapPin
            }
            onUseGps={role === "instructor" ? resolveInstructorFromGps : resolveStudioFromGps}
          />
        </View>
      </View>
    ) : null;

  const instructorForm = (
    <View
      style={[
        styles.formPanel,
        {
          backgroundColor: palette.surfaceAlt as string,
        },
      ]}
    >
      <ThemedText type="subtitle">{t("onboarding.instructorDetailsTitle")}</ThemedText>
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
        <ThemedText type="defaultSemiBold">{t("onboarding.sportsTitle")}</ThemedText>
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
        <ThemedText type="defaultSemiBold">{t("profile.settings.location.title")}</ThemedText>
        {showLocationSection ? (
          <>
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
                  <KitChip key={zoneId} label={label} selected onPress={() => toggleZone(zoneId)} />
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.locationPreviewRow}>
            <ThemedText style={{ color: palette.textMuted }}>
              {t("onboarding.location.zoneOptionalHint")}
            </ThemedText>
          </View>
        )}
      </View>
    </View>
  );

  const studioForm = (
    <View
      style={[
        styles.formPanel,
        {
          backgroundColor: palette.surfaceAlt as string,
        },
      ]}
    >
      <ThemedText type="subtitle">{t("onboarding.studioDetailsTitle")}</ThemedText>
      <KitTextField
        label={t("onboarding.studioName")}
        value={studioName}
        onChangeText={setStudioName}
      />

      <KitTextField
        label={t("onboarding.phoneOptional")}
        value={studioContactPhone}
        onChangeText={setStudioContactPhone}
      />

      {showLocationSection ? (
        <>
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
        </>
      ) : (
        <View style={styles.locationPreviewRow}>
          <ThemedText style={{ color: palette.textMuted }}>
            {t("onboarding.location.zonePending")}
          </ThemedText>
        </View>
      )}
    </View>
  );

  const renderBody = (bodyStep: OnboardingStep) => {
    if (bodyStep === 0) {
      return (
        <View style={styles.roleStage}>
          <View style={styles.roleStageHeader}>
            <ThemedText type="title">{t("onboarding.rolePrompt")}</ThemedText>
            <ThemedText type="caption" style={{ color: palette.textMuted }}>
              {role === "studio"
                ? t("onboarding.roleStudioDescription")
                : role === "instructor"
                  ? t("onboarding.roleInstructorDescription")
                  : t("onboarding.roleSelectHint")}
            </ThemedText>
          </View>
          <View style={styles.roleGrid}>
            <View style={styles.roleOption}>
              <ChoicePill
                label={t("onboarding.roleInstructorTitle")}
                icon={
                  <MaterialIcons
                    name="self-improvement"
                    size={20}
                    color={
                      role === "instructor"
                        ? (palette.onPrimary as string)
                        : (palette.text as string)
                    }
                  />
                }
                onPress={() => setSelectedRole("instructor")}
                selected={role === "instructor"}
              />
            </View>
            <View style={styles.roleOption}>
              <ChoicePill
                label={t("onboarding.roleStudioTitle")}
                icon={
                  <MaterialIcons
                    name="storefront"
                    size={20}
                    color={
                      role === "studio" ? (palette.onPrimary as string) : (palette.text as string)
                    }
                  />
                }
                onPress={() => setSelectedRole("studio")}
                selected={role === "studio"}
              />
            </View>
          </View>
          <View style={styles.roleStageFooter}>
            <IconButton
              accessibilityLabel={t("onboarding.next")}
              icon={nextArrowIcon}
              onPress={() => goToProfileStep()}
              disabled={!role}
              tone="primary"
              size={60}
            />
          </View>
        </View>
      );
    }

    if (bodyStep === 1 && role === "instructor") {
      if (!detailsReady) {
        return (
          <View style={styles.detailsLoadingStage}>
            <View style={styles.detailsLoadingHeader}>
              <ThemedText type="title">{t("onboarding.loading")}</ThemedText>
              <ThemedText type="caption" style={{ color: palette.textMuted }}>
                {t("onboarding.sheetInstructorSubtitle")}
              </ThemedText>
            </View>
            <View style={styles.detailsLoadingRow}>
              <ActivityIndicator color={palette.primary as string} />
              <ThemedText style={{ color: palette.textMuted }}>
                {t("onboarding.loading")}
              </ThemedText>
            </View>
          </View>
        );
      }

      return (
        <View style={[styles.stepTwoWrap, isDesktop ? styles.stepTwoDesktop : null]}>
          {instructorForm}
          {mapPane}
          <View style={styles.navBar}>
            <View style={styles.navRowSplit}>
              <View style={styles.navAction}>
                <ActionButton
                  label={t("onboarding.back")}
                  palette={palette}
                  tone="secondary"
                  fullWidth
                  onPress={() => {
                    setStep(0);
                    setVisibleStep(0);
                    setDetailsReady(false);
                    setShowLocationSection(false);
                    setStepTransition({
                      direction: -1,
                      phase: "idle",
                      targetStep: null,
                    });
                  }}
                />
              </View>

              <View style={styles.navAction}>
                <ActionButton
                  label={
                    showLocationSection
                      ? isSubmitting
                        ? t("onboarding.save")
                        : t("onboarding.save")
                      : t("onboarding.continue")
                  }
                  disabled={isSubmitting}
                  palette={palette}
                  fullWidth
                  onPress={() => {
                    if (!showLocationSection) {
                      revealLocationSection();
                      return;
                    }
                    void submitInstructor();
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      );
    }

    if (bodyStep === 1 && role === "studio") {
      if (!detailsReady) {
        return (
          <View style={styles.detailsLoadingStage}>
            <View style={styles.detailsLoadingHeader}>
              <ThemedText type="title">{t("onboarding.loading")}</ThemedText>
              <ThemedText type="caption" style={{ color: palette.textMuted }}>
                {t("onboarding.sheetStudioSubtitle")}
              </ThemedText>
            </View>
            <View style={styles.detailsLoadingRow}>
              <ActivityIndicator color={palette.primary as string} />
              <ThemedText style={{ color: palette.textMuted }}>
                {t("onboarding.loading")}
              </ThemedText>
            </View>
          </View>
        );
      }

      return (
        <View style={[styles.stepTwoWrap, isDesktop ? styles.stepTwoDesktop : null]}>
          {studioForm}
          {mapPane}
          <View style={styles.navBar}>
            <View style={styles.navRowSplit}>
              <View style={styles.navAction}>
                <ActionButton
                  label={t("onboarding.back")}
                  palette={palette}
                  tone="secondary"
                  fullWidth
                  onPress={() => {
                    setStep(0);
                    setVisibleStep(0);
                    setDetailsReady(false);
                    setShowLocationSection(false);
                    setStepTransition({
                      direction: -1,
                      phase: "idle",
                      targetStep: null,
                    });
                  }}
                />
              </View>

              <View style={styles.navAction}>
                <ActionButton
                  label={
                    showLocationSection
                      ? isSubmitting
                        ? t("onboarding.save")
                        : t("onboarding.complete")
                      : t("onboarding.continue")
                  }
                  disabled={isSubmitting}
                  palette={palette}
                  fullWidth
                  onPress={() => {
                    if (!showLocationSection) {
                      revealLocationSection();
                      return;
                    }
                    void submitStudio();
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      );
    }

    if (bodyStep === 2 && role === "instructor") {
      return (
        <View
          style={[
            styles.verifyStage,
            {
              backgroundColor: palette.surface as string,
              borderColor: palette.borderStrong as string,
            },
          ]}
        >
          <ThemedText type="subtitle">{t("onboarding.verification.subtitle")}</ThemedText>
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
        </View>
      );
    }

    return null;
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.appBg as string }]}>
      <GlobalTopSheet />
      <ScrollView
        ref={onboardingScrollRef}
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: collapsedSheetHeight + BrandSpacing.lg },
          step === 0 ? styles.contentGrow : null,
        ]}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.stageViewport}>
          {stepTransition.phase === "idle" ? (
            renderBody(step)
          ) : stepTransition.phase === "exit" ? (
            <OnboardingStageLayer phase="exit" direction={stepTransition.direction}>
              {renderBody(visibleStep)}
            </OnboardingStageLayer>
          ) : stepTransition.phase === "enter" ? (
            <OnboardingStageLayer phase="enter" direction={stepTransition.direction}>
              {renderBody(visibleStep)}
            </OnboardingStageLayer>
          ) : null}
        </View>

        {errorMessage ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: palette.dangerSubtle as string,
                borderColor: palette.danger as string,
              },
            ]}
          >
            <ThemedText style={{ color: palette.danger }}>{errorMessage}</ThemedText>
          </View>
        ) : null}
      </ScrollView>
    </View>
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
  stageViewport: {
    minHeight: 1,
  },
  detailsLoadingStage: {
    minHeight: 260,
    justifyContent: "center",
    gap: 12,
    paddingVertical: 12,
  },
  detailsLoadingHeader: {
    gap: 4,
  },
  detailsLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  contentGrow: {
    flexGrow: 1,
  },
  roleStage: {
    flex: 1,
    justifyContent: "flex-start",
    gap: BrandSpacing.lg,
    paddingTop: BrandSpacing.sm,
    paddingBottom: BrandSpacing.xl,
  },
  roleStageHeader: {
    gap: 6,
  },
  roleGrid: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
    marginTop: BrandSpacing.md,
  },
  roleOption: {
    flex: 1,
    minWidth: 0,
  },
  roleStageFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: "auto",
    paddingTop: BrandSpacing.xl,
  },
  navBar: {
    marginTop: BrandSpacing.sm,
    paddingTop: BrandSpacing.sm,
  },
  navRowSplit: {
    flexDirection: "row",
    gap: 12,
  },
  navAction: {
    flex: 1,
  },
  stepTwoWrap: {
    gap: 14,
  },
  stepTwoDesktop: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  formPanel: {
    gap: 12,
    flex: 1,
    minWidth: 320,
    borderRadius: 24,
    borderCurve: "continuous",
    padding: 16,
  },
  mapPanel: {
    flex: 1,
    minWidth: 320,
    minHeight: 360,
    gap: 10,
    borderRadius: 24,
    borderCurve: "continuous",
    padding: 16,
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
  locationPreviewRow: {
    minHeight: 44,
    justifyContent: "center",
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  verifyActions: {
    gap: 10,
  },
  verifyStage: {
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 24,
    borderCurve: "continuous",
    padding: 16,
  },
  errorBanner: {
    borderWidth: 1.5,
    borderRadius: 20,
    borderCurve: "continuous",
    padding: 14,
  },
});
