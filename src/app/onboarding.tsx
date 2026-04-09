import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMutation, useQuery } from "convex/react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { lazy, Suspense, startTransition, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { GlobalTopSheet } from "@/components/layout/global-top-sheet";
import { ScrollSheetProvider } from "@/components/layout/scroll-sheet-provider";
import { GlobalTopSheetProvider } from "@/components/layout/top-sheet-registry";
import { useTopSheetContentInsets } from "@/components/layout/use-top-sheet-content-insets";
import { LoadingScreen } from "@/components/loading-screen";
import { QueueMap } from "@/components/maps/queue-map";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { ChoicePill } from "@/components/ui/choice-pill";
import { IconButton } from "@/components/ui/icon-button";
import { KitTextField } from "@/components/ui/kit";
import { KitPressable } from "@/components/ui/kit/kit-pressable";
import { triggerSelectionHaptic } from "@/components/ui/kit/native-interaction";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { ZONE_OPTIONS } from "@/constants/zones";
import { api } from "@/convex/_generated/api";
import { isSportType, SPORT_TYPES, toSportLabel } from "@/convex/constants";
import {
  isComplianceDocumentUploadError,
  useComplianceDocumentUpload,
} from "@/hooks/use-compliance-document-upload";
import { useLocationResolution } from "@/hooks/use-location-resolution";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth, IconSize } from "@/lib/design-system";
import { getLocationResolveErrorMessage } from "@/lib/location-error-message";
import { omitUndefined } from "@/lib/omit-undefined";
import { showOpenSettingsAlert } from "@/lib/open-settings-alert";
import {
  isPushRegistrationError,
  registerForPushNotificationsAsync,
} from "@/lib/push-notifications";
import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";
import { Motion } from "@/theme/theme";

type OnboardingRole = "instructor" | "studio";
type OnboardingStep = 0 | 1 | 2;

// Lazy-loaded step body components
const StepInstructorProfileBody = lazy(() =>
  import("../components/onboarding/step-instructor-profile-body").then((m) => ({
    default: m.StepInstructorProfileBody,
  })),
);
const StepStudioProfileBody = lazy(() =>
  import("../components/onboarding/step-studio-profile-body").then((m) => ({
    default: m.StepStudioProfileBody,
  })),
);
const StepInstructorComplianceBody = lazy(() =>
  import("../components/onboarding/step-instructor-compliance-body").then((m) => ({
    default: m.StepInstructorComplianceBody,
  })),
);
const StepStudioComplianceBody = lazy(() =>
  import("../components/onboarding/step-studio-compliance-body").then((m) => ({
    default: m.StepStudioComplianceBody,
  })),
);

const MAX_INSTRUCTOR_ZONES = 25;
const STEP_EXIT_MS = Motion.fast; // 140ms for natural deceleration
const STEP_ENTER_MS = Motion.normal; // 220ms for smooth entry
const DETAILS_READY_DELAY_MS = 110;
const LOCATION_MAP_READY_DELAY_MS = 60;

function toDisplayLabel(value: string) {
  if (isSportType(value)) {
    return toSportLabel(value);
  }
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function trimOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isOnboardingRole(value: string | undefined): value is OnboardingRole {
  return value === "instructor" || value === "studio";
}

function getOnboardingPushErrorMessage(error: unknown, t: TFunction): string {
  if (isPushRegistrationError(error)) {
    switch (error.code) {
      case "permission_denied":
        return t("onboarding.push.permissionNotGranted");
      case "expo_go_unsupported":
        return t("onboarding.push.unavailableInExpoGo");
      case "physical_device_required":
        return t("onboarding.push.requiresPhysicalDevice");
      case "native_module_unavailable":
        return t("onboarding.push.unavailableInBuild");
      case "web_unsupported":
        return t("onboarding.push.unsupportedOnWeb");
    }
  }

  return error instanceof Error && error.message
    ? error.message
    : t("onboarding.push.requestFailed");
}

function maybeShowLocationSettingsAlert(code: string, t: TFunction) {
  if (code !== "permission_blocked") {
    return;
  }

  showOpenSettingsAlert({
    title: t("common.permissionRequired"),
    body: t("onboarding.errors.locationPermissionBlocked"),
    cancelLabel: t("common.cancel"),
    settingsLabel: t("common.openSettings"),
  });
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

  useEffect(() => {
    const incomingOffset = 20 * direction;
    const outgoingOffset = -18 * direction;

    if (phase === "enter") {
      translateX.value = incomingOffset;
      translateX.value = withTiming(0, {
        duration: STEP_ENTER_MS,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    if (phase === "exit") {
      translateX.value = withTiming(outgoingOffset, {
        duration: STEP_EXIT_MS,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    translateX.value = 0;
  }, [direction, phase, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[{ flex: 1, width: "100%" }, animatedStyle]}>{children}</Animated.View>
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
  const { role: roleParam } = useLocalSearchParams<{ role?: string }>();
  const { t, i18n } = useTranslation();
  const { color } = useTheme();

  const { contentContainerStyle: sheetContentInsets } = useTopSheetContentInsets({
    topSpacing: BrandSpacing.lg,
    bottomSpacing: BrandSpacing.insetComfort,
    horizontalPadding: BrandSpacing.inset,
  });
  const { width } = useWindowDimensions();
  const isDesktop = width >= 980;
  const language = i18n.resolvedLanguage?.startsWith("he") ? "he" : "en";

  const currentUser = useQuery(api.users.getCurrentUser);
  const completeInstructorOnboarding = useMutation(api.onboarding.completeInstructorOnboarding);
  const completeStudioOnboarding = useMutation(api.onboarding.completeStudioOnboarding);
  const { isUploading, pickAndUploadComplianceDocument } = useComplianceDocumentUpload();

  const [step, setStep] = useState<OnboardingStep>(0);
  const [visibleStep, setVisibleStep] = useState<OnboardingStep>(0);
  const [detailsReady, setDetailsReady] = useState(false);
  const [showLocationSection, setShowLocationSection] = useState(false);
  const [locationMapReady, setLocationMapReady] = useState(false);
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
  const requestedRole = isOnboardingRole(roleParam) ? roleParam : null;

  const ownedRoles = currentUser?.roles ?? [];
  const isAdditionalProfileSetup = requestedRole !== null && !ownedRoles.includes(requestedRole);
  const isForcedWorkspaceSetup = isAdditionalProfileSetup && ownedRoles.length > 0;
  const isBlockedAlternateAccountSetup =
    currentUser?.onboardingComplete === true &&
    requestedRole !== null &&
    (currentUser.role === "instructor" || currentUser.role === "studio") &&
    currentUser.role !== requestedRole;

  useEffect(() => {
    if (requestedRole) {
      setSelectedRole((current) => current ?? requestedRole);
    }
  }, [requestedRole]);

  useEffect(() => {
    if (!isForcedWorkspaceSetup || !requestedRole) {
      return;
    }

    setSelectedRole(requestedRole);
    setStep(1);
    setVisibleStep(1);
    setDetailsReady(true);
    setShowLocationSection(false);
    setStepTransition({
      direction: 1,
      phase: "idle",
      targetStep: null,
    });
  }, [isForcedWorkspaceSetup, requestedRole]);

  const effectiveRole: OnboardingRole | null =
    selectedRole ??
    (currentUser?.role === "instructor" || currentUser?.role === "studio"
      ? currentUser.role
      : null);
  const role = effectiveRole;
  const isInstructorFlow = effectiveRole === "instructor";

  const nextArrowIcon = (
    <MaterialIcons
      name={I18nManager.isRTL ? "arrow-back" : "arrow-forward"}
      size={IconSize.lg}
      color={color.onPrimary}
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
  const [studioLegalEntityType, setStudioLegalEntityType] = useState<"individual" | "company">(
    "individual",
  );
  const [studioVatReportingType, setStudioVatReportingType] = useState<
    "osek_patur" | "osek_murshe" | "company" | "other" | null
  >(null);
  const [studioLegalBusinessName, setStudioLegalBusinessName] = useState("");
  const [studioTaxId, setStudioTaxId] = useState("");
  const [studioBillingEmail, setStudioBillingEmail] = useState("");
  const [studioBillingAddress, setStudioBillingAddress] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStartingStudioDidit, setIsStartingStudioDidit] = useState(false);
  const [isSavingStudioBilling, setIsSavingStudioBilling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verificationRefreshAt, setVerificationRefreshAt] = useState<number | null>(null);
  const [verificationFeedback, setVerificationFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

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

  useEffect(() => {
    if (!showLocationSection) {
      setLocationMapReady(false);
      return;
    }

    const timeout = setTimeout(() => {
      setLocationMapReady(true);
    }, LOCATION_MAP_READY_DELAY_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [showLocationSection]);

  const shouldLoadInstructorVerification =
    role === "instructor" && step === 2 && currentUser?.role === "instructor";
  const verificationQueryArgs = verificationRefreshAt ? { now: verificationRefreshAt } : {};
  const instructorAccessSnapshot = useQuery(
    api.access.getMyInstructorAccessSnapshot,
    shouldLoadInstructorVerification ? verificationQueryArgs : "skip",
  );
  const shouldLoadStudioVerification =
    role === "studio" && step === 2 && currentUser?.role === "studio";
  const onboardingInstructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    shouldLoadInstructorVerification ? {} : "skip",
  );
  const studioAccessSnapshot = useQuery(
    api.access.getMyStudioAccessSnapshot,
    shouldLoadStudioVerification ? {} : "skip",
  );
  const diditVerification = instructorAccessSnapshot?.verification;
  const onboardingCompliance = instructorAccessSnapshot?.compliance;
  const studioDiditVerification = studioAccessSnapshot?.verification;
  const onboardingStudioCompliance = studioAccessSnapshot?.compliance;
  const saveStudioBillingProfile = useMutation(api.complianceStudio.upsertMyStudioBillingProfile);
  useEffect(() => {
    if (!shouldLoadStudioVerification) {
      return;
    }

    const billingProfile = onboardingStudioCompliance?.billingProfile;
    if (billingProfile) {
      setStudioLegalEntityType(billingProfile.legalEntityType);
      setStudioVatReportingType(billingProfile.vatReportingType ?? null);
      setStudioLegalBusinessName(billingProfile.legalBusinessName ?? studioName.trim());
      setStudioTaxId(billingProfile.taxId ?? "");
      setStudioBillingEmail(billingProfile.billingEmail ?? currentUser?.email ?? "");
      setStudioBillingAddress(billingProfile.billingAddress ?? studioAddress.trim());
      return;
    }

    setStudioLegalBusinessName((current) =>
      current.trim().length > 0 ? current : studioName.trim(),
    );
    setStudioBillingEmail((current) =>
      current.trim().length > 0 ? current : (currentUser?.email ?? ""),
    );
    setStudioBillingAddress((current) =>
      current.trim().length > 0 ? current : studioAddress.trim(),
    );
  }, [
    currentUser?.email,
    onboardingStudioCompliance?.billingProfile,
    shouldLoadStudioVerification,
    studioAddress,
    studioName,
  ]);

  if (currentUser === undefined) {
    return <LoadingScreen label={t("onboarding.loading")} />;
  }

  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }

  if (isBlockedAlternateAccountSetup) {
    return (
      <Redirect
        href={buildRoleTabRoute(
          currentUser.role as "instructor" | "studio",
          ROLE_TAB_ROUTE_NAMES.profile,
        )}
      />
    );
  }

  if (
    currentUser.onboardingComplete &&
    !((isInstructorFlow || role === "studio") && step === 2) &&
    !isAdditionalProfileSetup
  ) {
    return <Redirect href="/" />;
  }

  const verificationSports = [
    ...new Set(
      (onboardingInstructorSettings?.sports?.length
        ? onboardingInstructorSettings.sports
        : selectedSports
      ).filter((sport) => sport.trim().length > 0),
    ),
  ].sort();

  const uploadInsuranceFromOnboarding = async (source: "document" | "image") => {
    try {
      const result = await pickAndUploadComplianceDocument({
        kind: "insurance",
        source,
      });
      if (!result) {
        return;
      }
      setVerificationFeedback({
        tone: "success",
        message: t("profile.compliance.feedback.insuranceUploaded"),
      });
      setVerificationRefreshAt(Date.now());
    } catch (error) {
      const message = isComplianceDocumentUploadError(error)
        ? error.message
        : t("profile.compliance.errors.uploadFailed");
      setVerificationFeedback({ tone: "error", message });
    }
  };

  const uploadCertificateFromOnboarding = async (source: "document" | "image") => {
    try {
      const result = await pickAndUploadComplianceDocument({
        kind: "certificate",
        source,
      });
      if (!result) {
        return;
      }
      setVerificationFeedback({
        tone: "success",
        message: t("profile.compliance.feedback.certificateUploaded"),
      });
      setVerificationRefreshAt(Date.now());
    } catch (error) {
      const message = isComplianceDocumentUploadError(error)
        ? error.message
        : t("profile.compliance.errors.uploadFailed");
      setVerificationFeedback({ tone: "error", message });
    }
  };

  const openInsuranceUploadPicker = () => {
    Alert.alert(
      t("profile.compliance.uploadPicker.title"),
      t("profile.compliance.uploadPicker.body"),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
        {
          text: t("profile.compliance.actions.usePhoto"),
          onPress: () => {
            void uploadInsuranceFromOnboarding("image");
          },
        },
        {
          text: t("profile.compliance.actions.useFile"),
          onPress: () => {
            void uploadInsuranceFromOnboarding("document");
          },
        },
      ],
    );
  };

  const openCertificateUploadPicker = () => {
    Alert.alert(
      t("profile.compliance.certificate.uploadTitle"),
      t("profile.compliance.uploadPicker.body"),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
        {
          text: t("profile.compliance.actions.usePhoto"),
          onPress: () => {
            void uploadCertificateFromOnboarding("image");
          },
        },
        {
          text: t("profile.compliance.actions.useFile"),
          onPress: () => {
            void uploadCertificateFromOnboarding("document");
          },
        },
      ],
    );
  };

  const refreshStudioDiditFromOnboarding = async () => {
    setIsStartingStudioDidit(true);
    setVerificationFeedback(null);
    try {
      setVerificationFeedback({
        tone: "success",
        message: t("profile.studioCompliance.feedback.identityApproved"),
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("profile.studioCompliance.errors.identityStartFailed");
      setVerificationFeedback({ tone: "error", message });
    } finally {
      setIsStartingStudioDidit(false);
    }
  };

  const startStudioDiditFromOnboarding = async () => {
    setIsStartingStudioDidit(true);
    setVerificationFeedback(null);
    try {
      setVerificationFeedback({
        tone: "success",
        message: t("profile.studioCompliance.feedback.identityApproved"),
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("profile.studioCompliance.errors.identityStartFailed");
      setVerificationFeedback({ tone: "error", message });
    } finally {
      setIsStartingStudioDidit(false);
    }
  };

  const saveStudioBillingFromOnboarding = async () => {
    setIsSavingStudioBilling(true);
    setVerificationFeedback(null);
    try {
      await saveStudioBillingProfile({
        legalEntityType: studioLegalEntityType,
        legalBusinessName: studioLegalBusinessName,
        taxId: studioTaxId,
        billingEmail: studioBillingEmail,
        ...(studioVatReportingType ? { vatReportingType: studioVatReportingType } : {}),
        ...(studioContactPhone.trim() ? { billingPhone: studioContactPhone } : {}),
        ...(studioBillingAddress.trim() ? { billingAddress: studioBillingAddress } : {}),
      });
      setVerificationFeedback({
        tone: "success",
        message: t("profile.studioCompliance.feedback.billingSaved"),
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("profile.studioCompliance.errors.billingSaveFailed");
      setVerificationFeedback({ tone: "error", message });
    } finally {
      setIsSavingStudioBilling(false);
    }
  };

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
      maybeShowLocationSettingsAlert(result.error.code, t);
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
      maybeShowLocationSettingsAlert(result.error.code, t);
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
    } catch (error) {
      if (isPushRegistrationError(error) && error.code === "permission_denied") {
        showOpenSettingsAlert({
          title: t("common.permissionRequired"),
          body: t("onboarding.push.permissionNotGranted"),
          cancelLabel: t("common.cancel"),
          settingsLabel: t("common.openSettings"),
        });
      }
      setErrorMessage(getOnboardingPushErrorMessage(error, t));
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

  const handleBackFromWorkspaceSetup = () => {
    router.replace("/");
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

      if (isForcedWorkspaceSetup) {
        router.replace(buildRoleTabRoute("instructor", ROLE_TAB_ROUTE_NAMES.profile));
        return;
      }

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

      if (isForcedWorkspaceSetup) {
        router.replace(buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.profile));
        return;
      }

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

  const mapPane =
    role && showLocationSection ? (
      <View
        style={[
          styles.mapPanel,
          {
            backgroundColor: color.surface,
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
            <ThemedText type="micro" style={{ color: color.textMuted }}>
              {role === "instructor"
                ? t("mapTab.selectedZones", { count: selectedZones.length })
                : studioDetectedZone
                  ? studioDetectedZone
                  : t("profile.roles.pending")}
            </ThemedText>
          </View>
          <ThemedText style={{ color: color.textMuted }}>
            {role === "instructor"
              ? t("onboarding.map.instructorHint")
              : t("onboarding.map.studioHint")}
          </ThemedText>
        </View>
        <View style={styles.mapWrap}>
          {locationMapReady ? (
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
                role === "instructor"
                  ? selectedZones
                  : studioDetectedZone
                    ? [studioDetectedZone]
                    : []
              }
              focusZoneId={role === "instructor" ? instructorDetectedZone : studioDetectedZone}
              onPressZone={toggleZone}
              onPressMap={
                role === "instructor" ? resolveInstructorFromMapPin : resolveStudioFromMapPin
              }
              onUseGps={role === "instructor" ? resolveInstructorFromGps : resolveStudioFromGps}
            />
          ) : (
            <View
              style={[
                styles.mapLoadingState,
                {
                  backgroundColor: color.surfaceAlt,
                },
              ]}
            >
              <ActivityIndicator color={color.primary} />
              <ThemedText style={{ color: color.textMuted }}>{t("onboarding.loading")}</ThemedText>
            </View>
          )}
        </View>
      </View>
    ) : null;

  const instructorForm = (
    <View
      style={[
        styles.formPanel,
        {
          backgroundColor: color.surfaceAlt,
        },
      ]}
    >
      <ThemedText type="subtitle">{t("onboarding.instructorDetailsTitle")}</ThemedText>
      {isForcedWorkspaceSetup ? (
        <ThemedText style={{ color: color.textMuted }}>
          {t("onboarding.workspaceSetupInstructorHint")}
        </ThemedText>
      ) : null}
      <KitTextField
        label={t("onboarding.displayName")}
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
      />

      {!isForcedWorkspaceSetup ? (
        <KitTextField
          label={t("onboarding.bioOptional")}
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          style={styles.multilineInput}
        />
      ) : null}

      {!isForcedWorkspaceSetup ? (
        <KitTextField
          label={t("onboarding.hourlyRateOptional")}
          value={hourlyRate}
          onChangeText={setHourlyRate}
          keyboardType="decimal-pad"
        />
      ) : null}

      <View style={styles.sectionBlock}>
        <ThemedText type="defaultSemiBold">{t("onboarding.sportsTitle")}</ThemedText>
        <View style={styles.chipGrid}>
          {SPORT_TYPES.map((sport) => {
            const isSelected = selectedSports.includes(sport);
            const bgColor = isSelected ? color.primary : color.surfaceAlt;
            const pressedBgColor = isSelected ? color.primaryPressed : color.surfaceElevated;
            const textColor = isSelected ? color.onPrimary : color.text;
            return (
              <KitPressable
                key={sport}
                accessibilityRole="checkbox"
                accessibilityState={{ disabled: false, checked: isSelected }}
                haptic={false}
                onPress={() => {
                  triggerSelectionHaptic();
                  toggleSport(sport);
                }}
                style={{
                  tone: isSelected ? "primary" : "surface",
                  variant: "solid",
                  size: {
                    minHeight: BrandSpacing.controlSm,
                    borderRadius: BrandRadius.buttonSubtle,
                  },
                  padding: {
                    horizontal: BrandSpacing.controlX,
                    vertical: BrandSpacing.sm,
                  },
                  backgroundColor: bgColor,
                  pressedBackgroundColor: pressedBgColor,
                }}
              >
                <Text style={[BrandType.micro, { color: textColor, includeFontPadding: false }]}>
                  {toDisplayLabel(sport)}
                </Text>
              </KitPressable>
            );
          })}
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
              placeholderTextColor={color.textMuted}
              borderColor={color.border}
              textColor={color.text}
              backgroundColor={color.appBg}
              surfaceColor={color.surface}
              mutedTextColor={color.textMuted}
            />

            <View style={styles.inlineActions}>
              <ActionButton
                disabled={instructorResolver.isResolving}
                label={
                  instructorResolver.isResolving
                    ? t("onboarding.location.resolvingAddress")
                    : t("onboarding.location.findByAddress")
                }
                tone="secondary"
                onPress={() => {
                  void resolveInstructorFromAddress();
                }}
              />
            </View>

            <ThemedText style={{ color: color.textMuted }}>
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
                return (() => {
                  const isSelected = true;
                  const bgColor = color.primary;
                  const pressedBgColor = color.primaryPressed;
                  const textColor = color.onPrimary;
                  return (
                    <KitPressable
                      key={zoneId}
                      accessibilityRole="checkbox"
                      accessibilityState={{ disabled: false, checked: isSelected }}
                      haptic={false}
                      onPress={() => {
                        triggerSelectionHaptic();
                        toggleZone(zoneId);
                      }}
                      style={{
                        tone: "primary",
                        variant: "solid",
                        size: {
                          minHeight: BrandSpacing.controlSm,
                          borderRadius: BrandRadius.buttonSubtle,
                        },
                        padding: {
                          horizontal: BrandSpacing.controlX,
                          vertical: BrandSpacing.sm,
                        },
                        backgroundColor: bgColor,
                        pressedBackgroundColor: pressedBgColor,
                      }}
                    >
                      <Text
                        style={[BrandType.micro, { color: textColor, includeFontPadding: false }]}
                      >
                        {label}
                      </Text>
                    </KitPressable>
                  );
                })();
              })}
            </View>
          </>
        ) : (
          <View style={styles.locationPreviewRow}>
            <ThemedText style={{ color: color.textMuted }}>
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
          backgroundColor: color.surfaceAlt,
        },
      ]}
    >
      <ThemedText type="subtitle">{t("onboarding.studioDetailsTitle")}</ThemedText>
      {isForcedWorkspaceSetup ? (
        <ThemedText style={{ color: color.textMuted }}>
          {t("onboarding.workspaceSetupStudioHint")}
        </ThemedText>
      ) : null}
      <KitTextField
        label={t("onboarding.studioName")}
        value={studioName}
        onChangeText={setStudioName}
      />

      {!isForcedWorkspaceSetup ? (
        <KitTextField
          label={t("onboarding.phoneOptional")}
          value={studioContactPhone}
          onChangeText={setStudioContactPhone}
        />
      ) : null}

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
            placeholderTextColor={color.textMuted}
            borderColor={color.border}
            textColor={color.text}
            backgroundColor={color.appBg}
            surfaceColor={color.surface}
            mutedTextColor={color.textMuted}
          />

          <ActionButton
            disabled={studioResolver.isResolving}
            label={
              studioResolver.isResolving
                ? t("onboarding.location.resolvingAddress")
                : t("onboarding.location.findByAddress")
            }
            tone="secondary"
            fullWidth
            onPress={() => {
              void resolveStudioFromAddress();
            }}
          />

          <ThemedText style={{ color: color.textMuted }}>
            {studioDetectedZone
              ? t("onboarding.location.detectedZone", {
                  zone: studioDetectedZone,
                })
              : t("onboarding.location.zonePending")}
          </ThemedText>
        </>
      ) : (
        <View style={styles.locationPreviewRow}>
          <ThemedText style={{ color: color.textMuted }}>
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
            <ThemedText type="caption" style={{ color: color.textMuted }}>
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
                fullWidth
                icon={
                  <MaterialIcons
                    name="self-improvement"
                    size={IconSize.md}
                    color={role === "instructor" ? color.onPrimary : color.text}
                  />
                }
                onPress={() => setSelectedRole("instructor")}
                selected={role === "instructor"}
              />
            </View>
            <View style={styles.roleOption}>
              <ChoicePill
                label={t("onboarding.roleStudioTitle")}
                fullWidth
                icon={
                  <MaterialIcons
                    name="storefront"
                    size={IconSize.md}
                    color={role === "studio" ? color.onPrimary : color.text}
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
              size={BrandSpacing.iconButtonSize}
            />
          </View>
        </View>
      );
    }

    if (bodyStep === 1 && role === "instructor") {
      const handleInstructorBack = () => {
        if (isForcedWorkspaceSetup) {
          handleBackFromWorkspaceSetup();
          return;
        }
        setStep(0);
        setVisibleStep(0);
        setDetailsReady(false);
        setShowLocationSection(false);
        setStepTransition({
          direction: -1,
          phase: "idle",
          targetStep: null,
        });
      };
      return (
        <Suspense
          fallback={
            <View style={styles.detailsLoadingStage}>
              <View style={styles.detailsLoadingHeader}>
                <ThemedText type="title">{t("onboarding.loading")}</ThemedText>
                <ThemedText type="caption" style={{ color: color.textMuted }}>
                  {t("onboarding.sheetInstructorSubtitle")}
                </ThemedText>
              </View>
              <View style={styles.detailsLoadingRow}>
                <ActivityIndicator color={color.primary} />
                <ThemedText style={{ color: color.textMuted }}>
                  {t("onboarding.loading")}
                </ThemedText>
              </View>
            </View>
          }
        >
          <StepInstructorProfileBody
            detailsReady={detailsReady}
            isDesktop={isDesktop}
            showLocationSection={showLocationSection}
            isSubmitting={isSubmitting}
            instructorForm={instructorForm}
            mapPane={mapPane}
            onBack={handleInstructorBack}
            onRevealLocation={revealLocationSection}
            onSubmit={submitInstructor}
            styles={styles}
          />
        </Suspense>
      );
    }

    if (bodyStep === 1 && role === "studio") {
      const handleStudioBack = () => {
        if (isForcedWorkspaceSetup) {
          handleBackFromWorkspaceSetup();
          return;
        }
        setStep(0);
        setVisibleStep(0);
        setDetailsReady(false);
        setShowLocationSection(false);
        setStepTransition({
          direction: -1,
          phase: "idle",
          targetStep: null,
        });
      };
      return (
        <Suspense
          fallback={
            <View style={styles.detailsLoadingStage}>
              <View style={styles.detailsLoadingHeader}>
                <ThemedText type="title">{t("onboarding.loading")}</ThemedText>
                <ThemedText type="caption" style={{ color: color.textMuted }}>
                  {t("onboarding.sheetStudioSubtitle")}
                </ThemedText>
              </View>
              <View style={styles.detailsLoadingRow}>
                <ActivityIndicator color={color.primary} />
                <ThemedText style={{ color: color.textMuted }}>
                  {t("onboarding.loading")}
                </ThemedText>
              </View>
            </View>
          }
        >
          <StepStudioProfileBody
            detailsReady={detailsReady}
            isDesktop={isDesktop}
            showLocationSection={showLocationSection}
            isSubmitting={isSubmitting}
            studioForm={studioForm}
            mapPane={mapPane}
            onBack={handleStudioBack}
            onRevealLocation={revealLocationSection}
            onSubmit={submitStudio}
            styles={styles}
          />
        </Suspense>
      );
    }

    if (bodyStep === 2 && role === "instructor") {
      return (
        <Suspense
          fallback={
            <View style={styles.detailsLoadingStage}>
              <View style={styles.detailsLoadingHeader}>
                <ThemedText type="title">{t("profile.compliance.loading")}</ThemedText>
                <ThemedText type="caption" style={{ color: color.textMuted }}>
                  {t("onboarding.verification.body")}
                </ThemedText>
              </View>
              <View style={styles.detailsLoadingRow}>
                <ActivityIndicator color={color.primary} />
                <ThemedText style={{ color: color.textMuted }}>
                  {t("profile.compliance.loading")}
                </ThemedText>
              </View>
            </View>
          }
        >
          <StepInstructorComplianceBody
            currentUser={currentUser}
            diditVerification={diditVerification}
            onboardingCompliance={onboardingCompliance}
            verificationFeedback={verificationFeedback}
            setVerificationFeedback={setVerificationFeedback}
            isUploading={isUploading}
            openInsuranceUploadPicker={openInsuranceUploadPicker}
            openCertificateUploadPicker={openCertificateUploadPicker}
            verificationSports={verificationSports}
            pushToken={pushToken}
            isRequestingPush={isRequestingPush}
            requestPushPermission={requestPushPermission}
            router={router}
            buildRoleTabRoute={buildRoleTabRoute}
            ROLE_TAB_ROUTE_NAMES={ROLE_TAB_ROUTE_NAMES}
            styles={styles}
          />
        </Suspense>
      );
    }

    if (bodyStep === 2 && role === "studio") {
      return (
        <Suspense
          fallback={
            <View style={styles.detailsLoadingStage}>
              <View style={styles.detailsLoadingHeader}>
                <ThemedText type="title">{t("profile.studioCompliance.loading")}</ThemedText>
                <ThemedText type="caption" style={{ color: color.textMuted }}>
                  {t("onboarding.verification.studioBody")}
                </ThemedText>
              </View>
              <View style={styles.detailsLoadingRow}>
                <ActivityIndicator color={color.primary} />
                <ThemedText style={{ color: color.textMuted }}>
                  {t("profile.studioCompliance.loading")}
                </ThemedText>
              </View>
            </View>
          }
        >
          <StepStudioComplianceBody
            currentUser={currentUser}
            studioDiditVerification={studioDiditVerification}
            onboardingStudioCompliance={onboardingStudioCompliance}
            verificationFeedback={verificationFeedback}
            setVerificationFeedback={setVerificationFeedback}
            isStartingStudioDidit={isStartingStudioDidit}
            isSavingStudioBilling={isSavingStudioBilling}
            studioLegalEntityType={studioLegalEntityType}
            setStudioLegalEntityType={setStudioLegalEntityType}
            studioVatReportingType={studioVatReportingType}
            setStudioVatReportingType={setStudioVatReportingType}
            studioLegalBusinessName={studioLegalBusinessName}
            setStudioLegalBusinessName={setStudioLegalBusinessName}
            studioTaxId={studioTaxId}
            setStudioTaxId={setStudioTaxId}
            studioBillingEmail={studioBillingEmail}
            setStudioBillingEmail={setStudioBillingEmail}
            studioBillingAddress={studioBillingAddress}
            setStudioBillingAddress={setStudioBillingAddress}
            router={router}
            buildRoleTabRoute={buildRoleTabRoute}
            ROLE_TAB_ROUTE_NAMES={ROLE_TAB_ROUTE_NAMES}
            saveStudioBillingFromOnboarding={saveStudioBillingFromOnboarding}
            startStudioDiditFromOnboarding={startStudioDiditFromOnboarding}
            refreshStudioDiditFromOnboarding={refreshStudioDiditFromOnboarding}
            styles={styles}
          />
        </Suspense>
      );
    }

    return null;
  };

  return (
    <View style={[styles.screen, { backgroundColor: color.appBg }]}>
      <GlobalTopSheet />
      <ScrollView
        ref={onboardingScrollRef}
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          sheetContentInsets,
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
                backgroundColor: color.dangerSubtle,
                borderColor: color.danger,
              },
            ]}
          >
            <ThemedText style={{ color: color.danger }}>{errorMessage}</ThemedText>
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
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.lg,
    gap: BrandSpacing.sm,
  },
  stageViewport: {
    minHeight: 1,
  },
  detailsLoadingStage: {
    minHeight: 260,
    justifyContent: "center",
    gap: BrandSpacing.sm,
    paddingVertical: BrandSpacing.sm,
  },
  detailsLoadingHeader: {
    gap: BrandSpacing.xs,
  },
  detailsLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.sm,
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
    gap: BrandSpacing.xs,
  },
  roleGrid: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: BrandSpacing.sm,
    marginTop: BrandSpacing.md,
  },
  roleOption: {
    flex: 1,
    minWidth: 0,
  },
  roleStageFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: BrandSpacing.xl,
  },
  navBar: {
    marginTop: BrandSpacing.sm,
    paddingTop: BrandSpacing.sm,
  },
  navRowSplit: {
    flexDirection: "row",
    gap: BrandSpacing.sm,
  },
  navAction: {
    flex: 1,
  },
  stepTwoWrap: {
    gap: BrandSpacing.md,
  },
  stepTwoDesktop: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  formPanel: {
    gap: BrandSpacing.sm,
    flex: 1,
    minWidth: BrandSpacing.shellPanel,
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    padding: BrandSpacing.md,
  },
  mapPanel: {
    flex: 1,
    minWidth: BrandSpacing.shellPanel,
    minHeight: BrandSpacing.shellCommandPanel,
    gap: BrandSpacing.sm,
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    padding: BrandSpacing.md,
  },
  mapHeader: {
    gap: BrandSpacing.xs,
  },
  mapHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: BrandSpacing.sm,
  },
  mapWrap: {
    flex: 1,
    minHeight: BrandSpacing.mapMinHeight,
  },
  mapLoadingState: {
    flex: 1,
    minHeight: BrandSpacing.mapMinHeight,
    alignItems: "center",
    justifyContent: "center",
    gap: BrandSpacing.sm,
    borderRadius: BrandRadius.button,
    borderCurve: "continuous",
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandSpacing.sm,
  },
  sectionBlock: {
    gap: BrandSpacing.sm,
  },
  inlineActions: {
    flexDirection: "row",
    gap: BrandSpacing.sm,
  },
  locationPreviewRow: {
    minHeight: BrandSpacing.controlMd,
    justifyContent: "center",
  },
  multilineInput: {
    minHeight: BrandSpacing.multilineInputMinHeight,
    textAlignVertical: "top",
  },
  verifyActions: {
    gap: BrandSpacing.sm,
  },
  verifyStage: {
    gap: BrandSpacing.sm,
    borderWidth: BorderWidth.medium,
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    padding: BrandSpacing.md,
  },
  verificationCardList: {
    gap: BrandSpacing.sm,
  },
  verificationCard: {
    gap: BrandSpacing.sm,
    borderWidth: BorderWidth.thin,
    borderRadius: BrandRadius.button,
    borderCurve: "continuous",
    padding: BrandSpacing.md,
  },
  verificationCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandSpacing.sm,
  },
  errorBanner: {
    borderWidth: BorderWidth.medium,
    borderRadius: BrandRadius.button,
    borderCurve: "continuous",
    padding: BrandSpacing.md,
  },
});
