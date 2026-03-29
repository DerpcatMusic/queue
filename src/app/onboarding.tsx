import { useAuthActions } from "@convex-dev/auth/react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAction, useMutation, useQuery } from "convex/react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { GlobalTopSheet } from "@/components/layout/global-top-sheet";
import { ScrollSheetProvider } from "@/components/layout/scroll-sheet-provider";
import {
  GlobalTopSheetProvider,
  useGlobalTopSheet,
} from "@/components/layout/top-sheet-registry";
import { useTopSheetContentInsets } from "@/components/layout/use-top-sheet-content-insets";
import { LoadingScreen } from "@/components/loading-screen";
import { QueueMap } from "@/components/maps/queue-map";
import {
  getIdentityStatusLabel,
  IdentityStatusBadge,
} from "@/components/profile/identity-status-ui";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { ChoicePill } from "@/components/ui/choice-pill";
import { IconButton } from "@/components/ui/icon-button";
import { KitChip, KitTextField } from "@/components/ui/kit";
import { SheetHeaderBlock } from "@/components/ui/sheet-header-block";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
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
import {
  buildRoleTabRoute,
  ROLE_TAB_ROUTE_NAMES,
} from "@/navigation/role-routes";
import { startDiditNativeVerification } from "@/lib/didit-native";

type OnboardingRole = "instructor" | "studio";
type OnboardingStep = 0 | 1 | 2;

const MAX_INSTRUCTOR_ZONES = 25;
const STEP_EXIT_MS = 170;
const STEP_ENTER_MS = 220;
const DETAILS_READY_DELAY_MS = 110;
const LOCATION_MAP_READY_DELAY_MS = 60;

type OnboardingComplianceCertificateRow = {
  sport?: string;
  coveredSports?: string[];
  machineTags?: string[];
  reviewStatus:
    | "uploaded"
    | "ai_pending"
    | "ai_reviewing"
    | "approved"
    | "rejected"
    | "needs_resubmission";
  issuerName?: string;
  certificateTitle?: string;
  uploadedAt: number;
  reviewedAt?: number;
};

type OnboardingComplianceInsuranceRow = {
  reviewStatus:
    | "uploaded"
    | "ai_pending"
    | "ai_reviewing"
    | "approved"
    | "rejected"
    | "expired"
    | "needs_resubmission";
  issuerName?: string;
  policyNumber?: string;
  expiresOn?: string;
  expiresAt?: number;
  uploadedAt: number;
  reviewedAt?: number;
};

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

function formatComplianceDate(value: number | undefined, locale: string) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getLatestCertificateForSport(
  rows: OnboardingComplianceCertificateRow[],
  sport: string,
) {
  const matchingRows = rows.filter((row) => {
    const coveredSports =
      row.coveredSports && row.coveredSports.length > 0
        ? row.coveredSports
        : row.sport
          ? [row.sport]
          : [];
    return coveredSports.includes(sport);
  });
  if (matchingRows.length === 0) {
    return null;
  }

  return [...matchingRows].sort((left, right) => {
    const leftPriority = left.reviewStatus === "approved" ? 1 : 0;
    const rightPriority = right.reviewStatus === "approved" ? 1 : 0;
    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }
    return (
      (right.reviewedAt ?? right.uploadedAt) -
      (left.reviewedAt ?? left.uploadedAt)
    );
  })[0];
}

function getLatestCertificate(rows: OnboardingComplianceCertificateRow[]) {
  if (rows.length === 0) {
    return null;
  }

  return [...rows].sort(
    (left, right) =>
      (right.reviewedAt ?? right.uploadedAt) -
      (left.reviewedAt ?? left.uploadedAt),
  )[0];
}

function getPreferredInsurancePolicy(
  rows: OnboardingComplianceInsuranceRow[],
  now: number,
) {
  if (rows.length === 0) {
    return null;
  }

  return [...rows].sort((left, right) => {
    const leftActiveApproved =
      left.reviewStatus === "approved" &&
      (!left.expiresAt || left.expiresAt > now)
        ? 1
        : 0;
    const rightActiveApproved =
      right.reviewStatus === "approved" &&
      (!right.expiresAt || right.expiresAt > now)
        ? 1
        : 0;
    if (leftActiveApproved !== rightActiveApproved) {
      return rightActiveApproved - leftActiveApproved;
    }
    return (
      (right.reviewedAt ?? right.uploadedAt) -
      (left.reviewedAt ?? left.uploadedAt)
    );
  })[0];
}

function getCertificateSubtitle(
  row: OnboardingComplianceCertificateRow | null,
  locale: string,
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (!row) {
    return t("profile.compliance.certificate.missingBody");
  }

  const reviewedAt = formatComplianceDate(row.reviewedAt, locale);
  const coverage = (row.coveredSports ?? (row.sport ? [row.sport] : []))
    .map((sport) => (isSportType(sport) ? toSportLabel(sport) : sport))
    .join(", ");
  switch (row.reviewStatus) {
    case "approved": {
      const source = [row.certificateTitle, row.issuerName]
        .filter(Boolean)
        .join(" · ");
      const summary = [coverage, source].filter(Boolean).join(" · ");
      if (summary) {
        return reviewedAt
          ? t("profile.compliance.certificate.approvedWithSourceAndDate", {
              source: summary,
              date: reviewedAt,
            })
          : t("profile.compliance.certificate.approvedWithSource", {
              source: summary,
            });
      }
      return reviewedAt
        ? t("profile.compliance.certificate.approvedWithDate", {
            date: reviewedAt,
          })
        : t("profile.compliance.certificate.approvedBody");
    }
    case "uploaded":
    case "ai_pending":
    case "ai_reviewing":
      return t("profile.compliance.certificate.pendingBody");
    case "rejected":
    case "needs_resubmission":
      return t("profile.compliance.certificate.reuploadBody");
    default:
      return t("profile.compliance.certificate.missingBody");
  }
}

function getInsuranceSubtitle(
  row: OnboardingComplianceInsuranceRow | null,
  locale: string,
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (!row) {
    return t("profile.compliance.insurance.missingBody");
  }

  const expiresLabel = formatComplianceDate(row.expiresAt, locale);
  switch (row.reviewStatus) {
    case "approved":
      return expiresLabel
        ? t("profile.compliance.insurance.approvedWithDate", {
            date: expiresLabel,
          })
        : t("profile.compliance.insurance.approvedBody");
    case "expired":
      return expiresLabel
        ? t("profile.compliance.insurance.expiredWithDate", {
            date: expiresLabel,
          })
        : t("profile.compliance.insurance.expiredBody");
    case "uploaded":
    case "ai_pending":
    case "ai_reviewing":
      return t("profile.compliance.insurance.pendingBody");
    case "rejected":
    case "needs_resubmission":
      return t("profile.compliance.insurance.reuploadBody");
    default:
      return t("profile.compliance.insurance.missingBody");
  }
}

function getBlockingSummary(
  reasons: string[],
  t: ReturnType<typeof useTranslation>["t"],
) {
  return reasons
    .map((reason) => {
      switch (reason) {
        case "identity_verification_required":
          return t("profile.compliance.blockers.identity");
        case "insurance_verification_required":
          return t("profile.compliance.blockers.insurance");
        case "sport_certificate_required":
          return t("profile.compliance.blockers.certificate");
        default:
          return reason;
      }
    })
    .join(" · ");
}

function getStudioBlockingSummary(
  reasons: string[],
  t: ReturnType<typeof useTranslation>["t"],
) {
  return reasons
    .map((reason) => {
      switch (reason) {
        case "owner_identity_required":
          return t("profile.studioCompliance.blockers.identity");
        case "business_profile_required":
          return t("profile.studioCompliance.blockers.billing");
        case "payment_method_required":
          return t("profile.studioCompliance.blockers.payment");
        default:
          return reason;
      }
    })
    .join(" · ");
}

function getDocumentValue(
  reviewStatus:
    | OnboardingComplianceCertificateRow["reviewStatus"]
    | OnboardingComplianceInsuranceRow["reviewStatus"]
    | undefined,
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (reviewStatus === "approved") {
    return t("profile.compliance.values.approved");
  }
  if (
    reviewStatus === "uploaded" ||
    reviewStatus === "ai_pending" ||
    reviewStatus === "ai_reviewing"
  ) {
    return t("profile.compliance.values.pending");
  }
  return t("profile.compliance.values.actionRequired");
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
      translateX.value = withTiming(0, { duration: STEP_ENTER_MS });
      return;
    }

    if (phase === "exit") {
      translateX.value = withTiming(outgoingOffset, { duration: STEP_EXIT_MS });
      return;
    }

    translateX.value = 0;
  }, [direction, phase, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[{ flex: 1, width: "100%" }, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

function OnboardingSheetHeader({
  title,
  subtitle,
  currentStep,
  totalSteps,
  signOutLabel,
  onSignOut,
  dangerColor,
}: {
  title: string;
  subtitle: string;
  currentStep: number;
  totalSteps: number;
  signOutLabel: string;
  onSignOut: () => void;
  dangerColor: string;
}) {
  return (
    <SheetHeaderBlock
      title={title}
      subtitle={subtitle}
      progressCount={totalSteps}
      progressIndex={currentStep}
      trailingLabel={signOutLabel}
      trailingIcon={
        <MaterialIcons
          name="logout"
          size={BrandSpacing.iconSm}
          color={dangerColor}
        />
      }
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
  const { role: roleParam } = useLocalSearchParams<{ role?: string }>();
  const { t, i18n } = useTranslation();
  const { color } = useTheme();

  const { contentContainerStyle: sheetContentInsets } =
    useTopSheetContentInsets({
      topSpacing: BrandSpacing.lg,
      bottomSpacing: BrandSpacing.insetComfort,
      horizontalPadding: BrandSpacing.inset,
    });
  const { width } = useWindowDimensions();
  const isDesktop = width >= 980;
  const language = i18n.resolvedLanguage?.startsWith("he") ? "he" : "en";
  const { signOut } = useAuthActions();

  const currentUser = useQuery(api.users.getCurrentUser);
  const completeInstructorOnboarding = useMutation(
    api.onboarding.completeInstructorOnboarding,
  );
  const completeStudioOnboarding = useMutation(
    api.onboarding.completeStudioOnboarding,
  );
  const { isUploading, pickAndUploadComplianceDocument } =
    useComplianceDocumentUpload();

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
  const isAdditionalProfileSetup =
    requestedRole !== null && !ownedRoles.includes(requestedRole);
  const isForcedWorkspaceSetup =
    isAdditionalProfileSetup && ownedRoles.length > 0;
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
  const totalSteps = isForcedWorkspaceSetup ? 1 : 3;
  const displayedStep = stepTransition.phase === "idle" ? step : visibleStep;
  const currentStep = isForcedWorkspaceSetup
    ? Math.max(1, displayedStep)
    : displayedStep + 1;

  const onboardingSheetTitle =
    displayedStep === 0 && !isForcedWorkspaceSetup
      ? t("onboarding.title")
      : displayedStep === 2
        ? t("onboarding.verification.title")
        : role === "studio"
          ? t("onboarding.studioDetailsTitle")
          : t("onboarding.instructorDetailsTitle");
  const onboardingSheetSubtitle =
    displayedStep === 0 && !isForcedWorkspaceSetup
      ? t("onboarding.subtitle")
      : displayedStep === 2
        ? role === "studio"
          ? t("onboarding.verification.studioBody")
          : t("onboarding.verification.body")
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
          signOutLabel={t("auth.signOutButton")}
          onSignOut={() => {
            void signOut();
          }}
          dangerColor={color.danger}
        />
      ),
      backgroundColor: color.primary,
      topInsetColor: color.primary,
      padding: {
        horizontal: BrandSpacing.lg,
        vertical: BrandSpacing.sm,
      },
      steps: [0],
      initialStep: 0,
      collapsedHeightMode: "content" as const,
    }),
    [
      color,
      currentStep,
      onboardingSheetSubtitle,
      onboardingSheetTitle,
      signOut,
      t,
      totalSteps,
    ],
  );

  useGlobalTopSheet("onboarding", onboardingSheetConfig);
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
  const [studioLegalEntityType, setStudioLegalEntityType] = useState<
    "individual" | "company"
  >("individual");
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
  const [verificationRefreshAt, setVerificationRefreshAt] = useState<
    number | null
  >(null);
  const [verificationFeedback, setVerificationFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const instructorResolver = useLocationResolution();
  const studioResolver = useLocationResolution();
  const stepTransitionTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>(
    [],
  );
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
  const verificationQueryArgs = verificationRefreshAt
    ? { now: verificationRefreshAt }
    : {};
  const diditVerification = useQuery(
    api.didit.getMyDiditVerification,
    shouldLoadInstructorVerification ? {} : "skip",
  );
  const shouldLoadStudioVerification =
    role === "studio" && step === 2 && currentUser?.role === "studio";
  const onboardingInstructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    shouldLoadInstructorVerification ? {} : "skip",
  );
  const onboardingCompliance = useQuery(
    api.compliance.getMyInstructorComplianceDetails,
    shouldLoadInstructorVerification ? verificationQueryArgs : "skip",
  );
  const studioDiditVerification = useQuery(
    api.didit.getMyStudioDiditVerification,
    shouldLoadStudioVerification ? {} : "skip",
  );
  const onboardingStudioCompliance = useQuery(
    api.complianceStudio.getMyStudioComplianceDetails,
    shouldLoadStudioVerification ? {} : "skip",
  );
  const createStudioDiditSession = useAction(
    api.didit.createSessionForCurrentStudioOwner,
  );
  const refreshStudioDiditVerification = useAction(
    api.didit.refreshMyStudioDiditVerification,
  );
  const saveStudioBillingProfile = useMutation(
    api.complianceStudio.upsertMyStudioBillingProfile,
  );
  useEffect(() => {
    if (!shouldLoadStudioVerification) {
      return;
    }

    const billingProfile = onboardingStudioCompliance?.billingProfile;
    if (billingProfile) {
      setStudioLegalEntityType(billingProfile.legalEntityType);
      setStudioVatReportingType(billingProfile.vatReportingType ?? null);
      setStudioLegalBusinessName(
        billingProfile.legalBusinessName ?? studioName.trim(),
      );
      setStudioTaxId(billingProfile.taxId ?? "");
      setStudioBillingEmail(
        billingProfile.billingEmail ?? currentUser?.email ?? "",
      );
      setStudioBillingAddress(
        billingProfile.billingAddress ?? studioAddress.trim(),
      );
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

  const uploadInsuranceFromOnboarding = async (
    source: "document" | "image",
  ) => {
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

  const uploadCertificateFromOnboarding = async (
    source: "document" | "image",
  ) => {
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
      const latest = await refreshStudioDiditVerification({});
      setVerificationFeedback({
        tone: "success",
        message: latest.isVerified
          ? t("profile.studioCompliance.feedback.identityApproved")
          : t("profile.studioCompliance.feedback.identityRefreshStarted"),
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
      const session = await createStudioDiditSession({});
      const result = await startDiditNativeVerification({
        sessionToken: session.sessionToken,
        locale: i18n.resolvedLanguage ?? "en",
      });
      if (result.outcome !== "cancelled") {
        const latest = await refreshStudioDiditVerification({});
        setVerificationFeedback({
          tone: "success",
          message: latest.isVerified
            ? t("profile.studioCompliance.feedback.identityApproved")
            : t("profile.studioCompliance.feedback.identityRefreshStarted"),
        });
      }
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
        ...(studioVatReportingType
          ? { vatReportingType: studioVatReportingType }
          : {}),
        ...(studioContactPhone.trim()
          ? { billingPhone: studioContactPhone }
          : {}),
        ...(studioBillingAddress.trim()
          ? { billingAddress: studioBillingAddress }
          : {}),
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
    } catch (error) {
      if (
        isPushRegistrationError(error) &&
        error.code === "permission_denied"
      ) {
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
            current?.targetStep === nextStep
              ? { ...current, phase: "enter" }
              : current,
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

      if (isForcedWorkspaceSetup) {
        router.replace(
          buildRoleTabRoute("instructor", ROLE_TAB_ROUTE_NAMES.profile),
        );
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

      if (isForcedWorkspaceSetup) {
        router.replace(
          buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.profile),
        );
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
                  ? instructorLatitude !== undefined &&
                    instructorLongitude !== undefined
                    ? {
                        latitude: instructorLatitude,
                        longitude: instructorLongitude,
                      }
                    : null
                  : studioLatitude !== undefined &&
                      studioLongitude !== undefined
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
                role === "instructor"
                  ? instructorDetectedZone
                  : studioDetectedZone
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
              <ThemedText style={{ color: color.textMuted }}>
                {t("onboarding.loading")}
              </ThemedText>
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
      <ThemedText type="subtitle">
        {t("onboarding.instructorDetailsTitle")}
      </ThemedText>
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
      <ThemedText type="subtitle">
        {t("onboarding.studioDetailsTitle")}
      </ThemedText>
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
        );
      }

      return (
        <View
          style={[styles.stepTwoWrap, isDesktop ? styles.stepTwoDesktop : null]}
        >
          {instructorForm}
          {mapPane}
          <View style={styles.navBar}>
            <View style={styles.navRowSplit}>
              <View style={styles.navAction}>
                <ActionButton
                  label={t("onboarding.back")}
                  tone="secondary"
                  fullWidth
                  onPress={() => {
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
        );
      }

      return (
        <View
          style={[styles.stepTwoWrap, isDesktop ? styles.stepTwoDesktop : null]}
        >
          {studioForm}
          {mapPane}
          <View style={styles.navBar}>
            <View style={styles.navRowSplit}>
              <View style={styles.navAction}>
                <ActionButton
                  label={t("onboarding.back")}
                  tone="secondary"
                  fullWidth
                  onPress={() => {
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
                  }}
                />
              </View>

              <View style={styles.navAction}>
                <ActionButton
                  label={
                    showLocationSection
                      ? isSubmitting
                        ? t("onboarding.save")
                        : t("onboarding.continue")
                      : t("onboarding.continue")
                  }
                  disabled={isSubmitting}
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
      if (
        currentUser.role !== "instructor" ||
        diditVerification === undefined ||
        diditVerification === null ||
        onboardingCompliance === undefined ||
        onboardingCompliance === null
      ) {
        return (
          <View style={styles.detailsLoadingStage}>
            <View style={styles.detailsLoadingHeader}>
              <ThemedText type="title">
                {t("profile.compliance.loading")}
              </ThemedText>
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
        );
      }

      const complianceDetails = onboardingCompliance;
      const diditState = diditVerification;
      const blockersSummary = getBlockingSummary(
        complianceDetails.summary.blockingReasons,
        t,
      );
      const preferredInsurance = getPreferredInsurancePolicy(
        complianceDetails.insurancePolicies,
        Date.now(),
      );
      const latestCertificate = getLatestCertificate(
        complianceDetails.certificates,
      );
      const diditButtonColors = diditState.isVerified
        ? undefined
        : {
            backgroundColor: color.tertiary,
            pressedBackgroundColor: color.tertiary,
            disabledBackgroundColor: color.tertiarySubtle,
            labelColor: color.onPrimary,
            disabledLabelColor: color.onPrimary,
            nativeTintColor: color.tertiary,
          };

      return (
        <View
          style={[
            styles.verifyStage,
            {
              backgroundColor: color.surface,
              borderColor: color.borderStrong,
            },
          ]}
        >
          {verificationFeedback ? (
            <NoticeBanner
              tone={verificationFeedback.tone}
              message={verificationFeedback.message}
              onDismiss={() => setVerificationFeedback(null)}
            />
          ) : null}

          <View style={styles.sectionBlock}>
            <ThemedText type="subtitle">
              {complianceDetails.summary.canApplyToJobs
                ? t("profile.compliance.hero.readyTitle")
                : t("onboarding.verification.subtitle")}
            </ThemedText>
            <ThemedText style={{ color: color.textMuted }}>
              {complianceDetails.summary.canApplyToJobs
                ? t("profile.compliance.hero.readyBody")
                : t("profile.compliance.hero.blockedBody", {
                    blockers: blockersSummary,
                  })}
            </ThemedText>
          </View>

          {!diditState.isVerified ? (
            <ActionButton
              label={t("profile.compliance.actions.startIdentity")}
              fullWidth
              {...(diditButtonColors ? { colors: diditButtonColors } : {})}
              onPress={() => {
                router.replace("/instructor/profile/compliance");
              }}
            />
          ) : null}

          <View
            style={[
              styles.verificationCard,
              {
                backgroundColor: color.surfaceAlt,
                borderColor: color.borderStrong,
              },
            ]}
          >
            <View style={styles.verificationCardHeader}>
              <ThemedText type="defaultSemiBold">
                {t("profile.compliance.sections.identity")}
              </ThemedText>
              <IdentityStatusBadge status={diditState.status} />
            </View>
            <ThemedText style={{ color: color.textMuted }}>
              {diditState.isVerified
                ? t("profile.compliance.identity.approved")
                : t("profile.compliance.identity.required")}
            </ThemedText>
            <ActionButton
              label={
                diditState.isVerified
                  ? t("profile.navigation.identityVerification")
                  : t("profile.compliance.actions.startIdentity")
              }
              fullWidth
              {...(diditButtonColors ? { colors: diditButtonColors } : {})}
              {...(diditState.isVerified ? { tone: "secondary" as const } : {})}
              onPress={() => {
                router.replace("/instructor/profile/compliance");
              }}
            />
          </View>

          <View
            style={[
              styles.verificationCard,
              {
                backgroundColor: color.surfaceAlt,
                borderColor: color.borderStrong,
              },
            ]}
          >
            <View style={styles.verificationCardHeader}>
              <ThemedText type="defaultSemiBold">
                {t("profile.compliance.sections.insurance")}
              </ThemedText>
              <ThemedText type="caption" style={{ color: color.textMuted }}>
                {getDocumentValue(preferredInsurance?.reviewStatus, t)}
              </ThemedText>
            </View>
            <ThemedText style={{ color: color.textMuted }}>
              {getInsuranceSubtitle(
                preferredInsurance ?? null,
                i18n.resolvedLanguage ?? "en",
                t,
              )}
            </ThemedText>
            <ActionButton
              label={
                complianceDetails.summary.hasApprovedInsurance
                  ? t("profile.compliance.actions.replaceInsurance")
                  : t("profile.compliance.actions.uploadInsurance")
              }
              fullWidth
              loading={isUploading}
              disabled={isUploading}
              onPress={() => {
                openInsuranceUploadPicker();
              }}
            />
          </View>

          <View style={styles.sectionBlock}>
            <ThemedText type="defaultSemiBold">
              {t("profile.compliance.sections.certificates")}
            </ThemedText>
          </View>

          <View style={styles.verificationCardList}>
            <View
              style={[
                styles.verificationCard,
                {
                  backgroundColor: color.surfaceAlt,
                  borderColor: color.borderStrong,
                },
              ]}
            >
              <View style={styles.verificationCardHeader}>
                <ThemedText type="defaultSemiBold">
                  {t("profile.compliance.certificate.title")}
                </ThemedText>
                <ThemedText type="caption" style={{ color: color.textMuted }}>
                  {getDocumentValue(latestCertificate?.reviewStatus, t)}
                </ThemedText>
              </View>
              <ThemedText style={{ color: color.textMuted }}>
                {getCertificateSubtitle(
                  latestCertificate ?? null,
                  i18n.resolvedLanguage ?? "en",
                  t,
                )}
              </ThemedText>
              <ActionButton
                label={t("profile.compliance.actions.uploadCertificate")}
                fullWidth
                loading={isUploading}
                disabled={isUploading}
                onPress={() => {
                  openCertificateUploadPicker();
                }}
              />
            </View>
            {verificationSports.map((sport) => {
              const certificateRow = getLatestCertificateForSport(
                complianceDetails.certificates,
                sport,
              );

              return (
                <View
                  key={sport}
                  style={[
                    styles.verificationCard,
                    {
                      backgroundColor: color.surfaceAlt,
                      borderColor: color.borderStrong,
                    },
                  ]}
                >
                  <View style={styles.verificationCardHeader}>
                    <ThemedText type="defaultSemiBold">
                      {toDisplayLabel(sport)}
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={{ color: color.textMuted }}
                    >
                      {getDocumentValue(certificateRow?.reviewStatus, t)}
                    </ThemedText>
                  </View>
                  <ThemedText style={{ color: color.textMuted }}>
                    {getCertificateSubtitle(
                      certificateRow ?? null,
                      i18n.resolvedLanguage ?? "en",
                      t,
                    )}
                  </ThemedText>
                </View>
              );
            })}
          </View>

          <View
            style={[
              styles.verificationCard,
              {
                backgroundColor: color.surfaceAlt,
                borderColor: color.borderStrong,
              },
            ]}
          >
            <View style={styles.verificationCardHeader}>
              <ThemedText type="defaultSemiBold">
                {t("onboarding.push.title")}
              </ThemedText>
              <ThemedText type="caption" style={{ color: color.textMuted }}>
                {pushToken
                  ? t("onboarding.push.enabled")
                  : t("profile.compliance.values.pending")}
              </ThemedText>
            </View>
            <ThemedText style={{ color: color.textMuted }}>
              {pushToken
                ? t("onboarding.verification.reviewUpdatesEnabled")
                : t("onboarding.verification.reviewUpdatesDisabled")}
            </ThemedText>
            {!pushToken ? (
              <ActionButton
                disabled={isRequestingPush}
                loading={isRequestingPush}
                label={
                  isRequestingPush
                    ? t("onboarding.push.requesting")
                    : t("onboarding.push.requestPermission")
                }
                tone="secondary"
                fullWidth
                onPress={() => {
                  void requestPushPermission();
                }}
              />
            ) : null}
          </View>

          <View style={styles.verifyActions}>
            <ActionButton
              label={
                complianceDetails.summary.canApplyToJobs
                  ? t("onboarding.verification.openJobsReady")
                  : t("onboarding.verification.openJobsWhileReviewing")
              }
              fullWidth
              onPress={() => {
                router.replace(
                  buildRoleTabRoute("instructor", ROLE_TAB_ROUTE_NAMES.jobs),
                );
              }}
            />
            <ActionButton
              label={t("onboarding.verification.openCompliance")}
              tone="secondary"
              fullWidth
              onPress={() => {
                router.replace("/instructor/profile/compliance");
              }}
            />
          </View>
        </View>
      );
    }

    if (bodyStep === 2 && role === "studio") {
      if (
        currentUser.role !== "studio" ||
        studioDiditVerification === undefined ||
        studioDiditVerification === null ||
        onboardingStudioCompliance === undefined ||
        onboardingStudioCompliance === null
      ) {
        return (
          <View style={styles.detailsLoadingStage}>
            <View style={styles.detailsLoadingHeader}>
              <ThemedText type="title">
                {t("profile.studioCompliance.loading")}
              </ThemedText>
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
        );
      }

      const studioComplianceDetails = onboardingStudioCompliance;
      const studioDiditState = studioDiditVerification;
      const blockersSummary = getStudioBlockingSummary(
        studioComplianceDetails.summary.blockingReasons,
        t,
      );

      return (
        <View
          style={[
            styles.verifyStage,
            {
              backgroundColor: color.surface,
              borderColor: color.borderStrong,
            },
          ]}
        >
          {verificationFeedback ? (
            <NoticeBanner
              tone={verificationFeedback.tone}
              message={verificationFeedback.message}
              onDismiss={() => setVerificationFeedback(null)}
            />
          ) : null}

          <View style={styles.sectionBlock}>
            <ThemedText type="subtitle">
              {studioComplianceDetails.summary.canPublishJobs
                ? t("profile.studioCompliance.hero.readyTitle")
                : t("profile.studioCompliance.hero.blockedTitle")}
            </ThemedText>
            <ThemedText style={{ color: color.textMuted }}>
              {studioComplianceDetails.summary.canPublishJobs
                ? t("profile.studioCompliance.hero.readyBody")
                : t("profile.studioCompliance.hero.blockedBody", {
                    blockers: blockersSummary,
                  })}
            </ThemedText>
          </View>

          <View
            style={[
              styles.verificationCard,
              {
                backgroundColor: color.surfaceAlt,
                borderColor: color.borderStrong,
              },
            ]}
          >
            <View style={styles.verificationCardHeader}>
              <ThemedText type="defaultSemiBold">
                {t("profile.studioCompliance.sections.identity")}
              </ThemedText>
              <IdentityStatusBadge status={studioDiditState.status} />
            </View>
            <ThemedText style={{ color: color.textMuted }}>
              {studioDiditState.isVerified
                ? t("profile.studioCompliance.identity.approvedBody", {
                    legalName:
                      studioDiditState.legalName ??
                      currentUser.fullName ??
                      t("profile.account.fallbackName"),
                  })
                : t("profile.studioCompliance.identity.requiredBody", {
                    status: getIdentityStatusLabel(studioDiditState.status),
                  })}
            </ThemedText>
            <ActionButton
              label={
                studioDiditState.isVerified
                  ? t("profile.studioCompliance.actions.refreshIdentity")
                  : t("profile.studioCompliance.actions.startIdentity")
              }
              fullWidth
              loading={isStartingStudioDidit}
              disabled={isStartingStudioDidit}
              onPress={() => {
                if (studioDiditState.isVerified) {
                  void refreshStudioDiditFromOnboarding();
                  return;
                }
                void startStudioDiditFromOnboarding();
              }}
            />
          </View>

          <View
            style={[
              styles.verificationCard,
              {
                backgroundColor: color.surfaceAlt,
                borderColor: color.borderStrong,
              },
            ]}
          >
            <View style={styles.sectionBlock}>
              <View style={styles.verificationCardHeader}>
                <ThemedText type="defaultSemiBold">
                  {t("profile.studioCompliance.sections.billing")}
                </ThemedText>
                <ThemedText type="caption" style={{ color: color.textMuted }}>
                  {studioComplianceDetails.summary.businessProfileStatus ===
                  "complete"
                    ? t("profile.compliance.values.approved")
                    : t("profile.compliance.values.actionRequired")}
                </ThemedText>
              </View>

              <View style={styles.chipGrid}>
                <ChoicePill
                  label={t("profile.studioCompliance.billing.entityIndividual")}
                  selected={studioLegalEntityType === "individual"}
                  onPress={() => setStudioLegalEntityType("individual")}
                />
                <ChoicePill
                  label={t("profile.studioCompliance.billing.entityCompany")}
                  selected={studioLegalEntityType === "company"}
                  onPress={() => setStudioLegalEntityType("company")}
                />
              </View>

              <KitTextField
                label={t("profile.studioCompliance.billing.legalBusinessName")}
                value={studioLegalBusinessName}
                onChangeText={setStudioLegalBusinessName}
              />
              <KitTextField
                label={t("profile.studioCompliance.billing.taxId")}
                value={studioTaxId}
                onChangeText={setStudioTaxId}
              />
              <KitTextField
                label={t("profile.studioCompliance.billing.billingEmail")}
                value={studioBillingEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setStudioBillingEmail}
              />
              <KitTextField
                label={t("profile.studioCompliance.billing.billingAddress")}
                value={studioBillingAddress}
                onChangeText={setStudioBillingAddress}
              />

              <View style={styles.chipGrid}>
                {(
                  ["osek_patur", "osek_murshe", "company", "other"] as const
                ).map((value) => (
                  <ChoicePill
                    key={value}
                    label={t(
                      `profile.studioCompliance.billing.vatOptions.${value}` as const,
                    )}
                    selected={studioVatReportingType === value}
                    onPress={() => setStudioVatReportingType(value)}
                  />
                ))}
              </View>

              <ActionButton
                label={t("profile.studioCompliance.actions.saveBilling")}
                fullWidth
                loading={isSavingStudioBilling}
                disabled={isSavingStudioBilling}
                onPress={() => {
                  void saveStudioBillingFromOnboarding();
                }}
              />
            </View>
          </View>

          <View
            style={[
              styles.verificationCard,
              {
                backgroundColor: color.surfaceAlt,
                borderColor: color.borderStrong,
              },
            ]}
          >
            <View style={styles.verificationCardHeader}>
              <ThemedText type="defaultSemiBold">
                {t("profile.studioCompliance.sections.payment")}
              </ThemedText>
              <ThemedText type="caption" style={{ color: color.textMuted }}>
                {studioComplianceDetails.summary.paymentStatus === "ready"
                  ? t("profile.compliance.values.approved")
                  : t("profile.compliance.values.pending")}
              </ThemedText>
            </View>
            <ThemedText style={{ color: color.textMuted }}>
              {t(
                studioComplianceDetails.summary.paymentStatus === "ready"
                  ? "profile.studioCompliance.payment.readyBody"
                  : studioComplianceDetails.summary.paymentReadinessSource ===
                      "legacy_env"
                    ? "onboarding.verification.studioPaymentGroundwork"
                    : "profile.studioCompliance.payment.pendingBody",
              )}
            </ThemedText>
            <ActionButton
              label={t("onboarding.verification.openCompliance")}
              tone="secondary"
              fullWidth
              onPress={() => {
                router.replace("/studio/profile/compliance");
              }}
            />
          </View>

          <View style={styles.verifyActions}>
            <ActionButton
              label={
                studioComplianceDetails.summary.canPublishJobs
                  ? t("onboarding.verification.openJobsReady")
                  : t("onboarding.verification.openJobsWhileReviewing")
              }
              fullWidth
              onPress={() => {
                router.replace(
                  buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.jobs),
                );
              }}
            />
            <ActionButton
              label={t("onboarding.verification.openCompliance")}
              tone="secondary"
              fullWidth
              onPress={() => {
                router.replace("/studio/profile/compliance");
              }}
            />
          </View>
        </View>
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
            <OnboardingStageLayer
              phase="exit"
              direction={stepTransition.direction}
            >
              {renderBody(visibleStep)}
            </OnboardingStageLayer>
          ) : stepTransition.phase === "enter" ? (
            <OnboardingStageLayer
              phase="enter"
              direction={stepTransition.direction}
            >
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
            <ThemedText style={{ color: color.danger }}>
              {errorMessage}
            </ThemedText>
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
    marginTop: "auto",
    paddingTop: BrandSpacing.xl,
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
