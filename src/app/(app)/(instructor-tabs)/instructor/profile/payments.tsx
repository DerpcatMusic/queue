import DateTimePicker from "@react-native-community/datetimepicker";
import { useAction, useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import type { Href } from "expo-router";
import { Redirect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { vars } from "nativewind";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform, Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { LoadingScreen } from "@/components/loading-screen";
import { PaymentActivityList } from "@/components/payments/payment-activity-list";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSegmentedToggle, KitStatusBadge, KitSuccessBurst } from "@/components/ui/kit";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { useRapydReturn } from "@/contexts/rapyd-return-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useBrand } from "@/hooks/use-brand";
import { formatDateTime } from "@/lib/jobs-utils";
import {
  formatAgorotCurrency,
  getPaymentStatusLabel,
  getPayoutStatusLabel,
} from "@/lib/payments-utils";
import { buildRapydBridgeUrl, resolveRapydAppReturnUrl } from "@/lib/rapyd-hosted-flow";

const INSTRUCTOR_IDENTITY_VERIFICATION_ROUTE = "/instructor/profile/identity-verification" as const;
type PayoutPreferenceMode = "immediate_when_eligible" | "scheduled_date" | "manual_hold";

function buildDefaultScheduledDate(timestamp?: number | null) {
  if (timestamp && Number.isFinite(timestamp) && timestamp > Date.now()) {
    return new Date(timestamp);
  }
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return next;
}

export default function ProfilePaymentsScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const locale = i18n.resolvedLanguage ?? "en";
  const router = useRouter();
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);
  useProfileSubpageSheet({
    title: t("profile.navigation.wallet"),
    routeMatchPath: "/profile/payments",
  });

  const currentUser = useQuery(api.users.getCurrentUser);
  const isInstructorPaymentsRole = currentUser?.role === "instructor";
  const { consumeReturn: consumeBeneficiaryReturn, latestReturn: latestBeneficiaryReturn } =
    useRapydReturn("beneficiary");

  const paymentRows = useQuery(
    api.payments.listMyPayments,
    isInstructorPaymentsRole ? { limit: 40 } : "skip",
  );
  const payoutSummary = useQuery(
    api.payments.getMyPayoutSummary,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const requestPayoutWithdrawal = useMutation(api.payments.requestMyPayoutWithdrawal);
  const upsertMyPayoutPreference = useMutation(api.payments.upsertMyPayoutPreference);
  const createBeneficiaryOnboardingForInstructor = useAction(
    api.rapyd.createBeneficiaryOnboardingForInstructor,
  );
  const [destinationError, setDestinationError] = useState<string | null>(null);
  const [destinationInfo, setDestinationInfo] = useState<string | null>(null);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [activeOnboardingId, setActiveOnboardingId] =
    useState<Id<"payoutDestinationOnboarding"> | null>(null);
  const [isFinalizingOnboarding, setIsFinalizingOnboarding] = useState(false);
  const [showOnboardingSuccess, setShowOnboardingSuccess] = useState(false);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawInfo, setWithdrawInfo] = useState<string | null>(null);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [preferenceInfo, setPreferenceInfo] = useState<string | null>(null);
  const [pendingPreferenceMode, setPendingPreferenceMode] = useState<PayoutPreferenceMode | null>(
    null,
  );
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState<Date>(buildDefaultScheduledDate());
  const [selectedPaymentId, setSelectedPaymentId] = useState<Id<"payments"> | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  const selectedPaymentDetail = useQuery(
    api.payments.getMyPaymentDetail,
    selectedPaymentId ? { paymentId: selectedPaymentId } : "skip",
  );
  const activeOnboardingSession = useQuery(
    api.payments.getMyPayoutOnboardingSession,
    activeOnboardingId ? { sessionId: activeOnboardingId } : "skip",
  );

  useEffect(() => {
    if (!isFinalizingOnboarding || !activeOnboardingSession) return;

    if (activeOnboardingSession.status === "completed") {
      setIsFinalizingOnboarding(false);
      setActiveOnboardingId(null);
      setDestinationError(null);
      setDestinationInfo(t("profile.payments.connectSuccess"));
      setShowOnboardingSuccess(true);
      if (Platform.OS === "ios") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      return;
    }

    if (
      activeOnboardingSession.status === "failed" ||
      activeOnboardingSession.status === "expired"
    ) {
      setIsFinalizingOnboarding(false);
      setActiveOnboardingId(null);
      setDestinationInfo(null);
      setDestinationError(
        activeOnboardingSession.lastError ??
          (activeOnboardingSession.status === "expired"
            ? t("profile.payments.expired")
            : t("profile.payments.onboardingFailed")),
      );
    }
  }, [activeOnboardingSession, isFinalizingOnboarding, t]);

  useEffect(() => {
    if (!latestBeneficiaryReturn) return;

    consumeBeneficiaryReturn();
    if (latestBeneficiaryReturn.result === "cancel") {
      setActiveOnboardingId(null);
      setIsFinalizingOnboarding(false);
      setDestinationError(null);
      setDestinationInfo(t("profile.payments.cancelled"));
      return;
    }

    setDestinationError(null);
    setDestinationInfo(t("profile.payments.finalizingTitle"));
    setIsFinalizingOnboarding(true);
  }, [consumeBeneficiaryReturn, latestBeneficiaryReturn, t]);

  useEffect(() => {
    if (!isFinalizingOnboarding || activeOnboardingId !== null || !payoutSummary) {
      return;
    }

    if (payoutSummary.hasVerifiedDestination || payoutSummary.onboardingStatus === "completed") {
      setIsFinalizingOnboarding(false);
      setDestinationError(null);
      setDestinationInfo(t("profile.payments.connectSuccess"));
      setShowOnboardingSuccess(true);
      if (Platform.OS === "ios") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      return;
    }

    if (
      payoutSummary.onboardingStatus === "failed" ||
      payoutSummary.onboardingStatus === "expired"
    ) {
      setIsFinalizingOnboarding(false);
      setDestinationInfo(null);
      setDestinationError(
        payoutSummary.onboardingLastError ??
          (payoutSummary.onboardingStatus === "expired"
            ? t("profile.payments.expired")
            : t("profile.payments.onboardingFailed")),
      );
    }
  }, [activeOnboardingId, isFinalizingOnboarding, payoutSummary, t]);

  useEffect(() => {
    if (!showOnboardingSuccess) return;
    const timeout = setTimeout(() => {
      setShowOnboardingSuccess(false);
    }, 1600);
    return () => clearTimeout(timeout);
  }, [showOnboardingSuccess]);

  useEffect(() => {
    if (!payoutSummary || pendingPreferenceMode === "scheduled_date") {
      return;
    }
    setScheduleDraft(buildDefaultScheduledDate(payoutSummary.payoutPreferenceScheduledDate));
  }, [payoutSummary, pendingPreferenceMode]);

  if (
    currentUser === undefined ||
    (isInstructorPaymentsRole && paymentRows === undefined) ||
    (currentUser?.role === "instructor" && payoutSummary === undefined) ||
    (activeOnboardingId !== null && activeOnboardingSession === undefined)
  ) {
    return <LoadingScreen label={t("jobsTab.loading")} />;
  }
  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }
  if (!currentUser.onboardingComplete || currentUser.role === "pending") {
    return <Redirect href="/onboarding" />;
  }
  if (currentUser.role !== "instructor") {
    return <Redirect href="/" />;
  }

  const rows = paymentRows ?? [];
  const role = currentUser.role as "studio" | "instructor";
  const isDetailLoading = selectedPaymentId !== null && selectedPaymentDetail === undefined;
  const isManualPayoutMode = payoutSummary?.payoutReleaseMode !== "automatic";
  const isIdentityVerified = payoutSummary?.isIdentityVerified ?? false;
  const savedPreferenceMode =
    (payoutSummary?.payoutPreferenceMode as PayoutPreferenceMode | undefined) ??
    "immediate_when_eligible";
  const effectivePreferenceMode = pendingPreferenceMode ?? savedPreferenceMode;
  const scheduledAtLabel = formatDateTime(scheduleDraft.getTime(), locale);
  const appReturnUrl = resolveRapydAppReturnUrl("beneficiary");
  const buildBridgeUrl = (result: "complete" | "cancel"): string => {
    return buildRapydBridgeUrl({
      bridgePath: "/rapyd/beneficiary-return-bridge",
      result,
      appReturnUrl,
    });
  };
  const beneficiaryCompleteUrl = buildBridgeUrl("complete");
  const beneficiaryCancelUrl = buildBridgeUrl("cancel");

  const withdrawToBank = async () => {
    setWithdrawBusy(true);
    setWithdrawError(null);
    setWithdrawInfo(null);
    try {
      const result = await requestPayoutWithdrawal({
        maxPayments: 25,
      });
      if (result.scheduledCount === 0) {
        setWithdrawInfo(t("profile.payments.availableBalanceEmpty"));
      } else {
        setWithdrawInfo(
          t("profile.payments.withdrawalStarted", {
            count: result.scheduledCount,
          }),
        );
      }
    } catch (error) {
      setWithdrawError(
        error instanceof Error ? error.message : t("profile.payments.withdrawalFailed"),
      );
    } finally {
      setWithdrawBusy(false);
    }
  };

  const confirmWithdrawToBank = () => {
    Alert.alert(
      t("profile.payments.withdrawConfirmTitle"),
      t("profile.payments.withdrawConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("profile.payments.withdrawConfirmAction"),
          style: "default",
          onPress: () => {
            void withdrawToBank();
          },
        },
      ],
    );
  };

  const startHostedBankOnboarding = async () => {
    setOnboardingBusy(true);
    setIsFinalizingOnboarding(false);
    setShowOnboardingSuccess(false);
    setActiveOnboardingId(null);
    setDestinationError(null);
    setDestinationInfo(null);
    try {
      const session = await createBeneficiaryOnboardingForInstructor({
        completeUrl: beneficiaryCompleteUrl,
        cancelUrl: beneficiaryCancelUrl,
      });
      setActiveOnboardingId(session.onboardingId);
      const authResult = await WebBrowser.openAuthSessionAsync(session.redirectUrl, appReturnUrl);
      if (authResult.type === "success") {
        const resultUrl = authResult.url ? new URL(authResult.url) : null;
        const result = resultUrl?.searchParams.get("result") ?? "complete";
        if (result === "cancel") {
          setActiveOnboardingId(null);
          setDestinationInfo(t("profile.payments.cancelled"));
        } else {
          setDestinationInfo(t("profile.payments.finalizingTitle"));
          setIsFinalizingOnboarding(true);
        }
      } else if (authResult.type === "dismiss" || authResult.type === "cancel") {
        setActiveOnboardingId(null);
        setDestinationInfo(t("profile.payments.closed"));
      } else {
        setDestinationInfo(t("profile.payments.opened"));
      }
    } catch (error) {
      setActiveOnboardingId(null);
      setDestinationError(
        error instanceof Error ? error.message : t("profile.payments.openFailed"),
      );
    } finally {
      setOnboardingBusy(false);
    }
  };

  const savePayoutPreference = async (
    preferenceMode: PayoutPreferenceMode,
    scheduledDate?: number,
  ) => {
    setPreferenceBusy(true);
    setPreferenceError(null);
    setPreferenceInfo(null);
    try {
      if (preferenceMode === "scheduled_date") {
        if (!scheduledDate || scheduledDate <= Date.now()) {
          throw new Error(t("profile.payments.preferenceScheduleInvalid"));
        }
      }

      await upsertMyPayoutPreference({
        preferenceMode,
        ...(preferenceMode === "scheduled_date" && scheduledDate ? { scheduledDate } : {}),
      });
      setPendingPreferenceMode(null);
      setPreferenceInfo(
        preferenceMode === "scheduled_date"
          ? t("profile.payments.preferenceSavedScheduled")
          : preferenceMode === "manual_hold"
            ? t("profile.payments.preferenceSavedHold")
            : t("profile.payments.preferenceSavedImmediate"),
      );
      if (Platform.OS === "ios") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      setPreferenceError(
        error instanceof Error ? error.message : t("profile.payments.preferenceSaveFailed"),
      );
    } finally {
      setPreferenceBusy(false);
    }
  };

  const handlePreferenceModeChange = (mode: PayoutPreferenceMode) => {
    setPreferenceError(null);
    setPreferenceInfo(null);
    if (mode === "scheduled_date") {
      setPendingPreferenceMode(mode);
      setScheduleDraft(buildDefaultScheduledDate(payoutSummary?.payoutPreferenceScheduledDate));
      setShowSchedulePicker(true);
      return;
    }

    setPendingPreferenceMode(null);
    setShowSchedulePicker(false);
    void savePayoutPreference(mode);
  };

  if (isFinalizingOnboarding) {
    return (
      <ProfileSubpageScrollView
        routeKey="instructor/profile/payments"
        className="flex-1"
        style={vars({ "--tw-bg-app-bg": String(palette.appBg) })}
        contentContainerClassName="flex-grow justify-center px-lg"
        bottomSpacing={BrandSpacing.lg}
      >
        <View
          className="items-center border gap-sm rounded-card p-xl"
          style={vars({
            "--tw-bg-surface-alt": String(palette.surfaceAlt),
            "--tw-border": String(palette.border),
          })}
        >
          <ThemedText type="title">{t("profile.payments.finalizingTitle")}</ThemedText>
          <ThemedText
            type="caption"
            className="text-center"
            style={vars({ "--tw-text-muted": String(palette.textMuted) })}
          >
            {t("profile.payments.finalizingBody")}
          </ThemedText>
        </View>
      </ProfileSubpageScrollView>
    );
  }

  if (showOnboardingSuccess) {
    return (
      <ProfileSubpageScrollView
        routeKey="instructor/profile/payments"
        className="flex-1"
        style={vars({ "--tw-bg-app-bg": String(palette.appBg) })}
        contentContainerClassName="flex-grow justify-center px-lg"
        bottomSpacing={BrandSpacing.lg}
      >
        <View
          className="items-center border gap-sm rounded-card p-xl"
          style={vars({
            "--tw-bg-surface-alt": String(palette.surfaceAlt),
            "--tw-border": String(palette.border),
          })}
        >
          <KitSuccessBurst iconName="building.columns.fill" />
          <ThemedText type="title">{t("profile.payments.successTitle")}</ThemedText>
          <ThemedText
            type="caption"
            className="text-center"
            style={vars({ "--tw-text-muted": String(palette.textMuted) })}
          >
            {t("profile.payments.successBody")}
          </ThemedText>
        </View>
      </ProfileSubpageScrollView>
    );
  }

  if (showVerifyModal) {
    return (
      <Animated.View
        entering={FadeIn.duration(250)}
        exiting={FadeOut.duration(200)}
        className="flex-1"
        style={vars({ "--tw-bg-app-bg": String(palette.appBg) })}
      >
        <ProfileSubpageScrollView
          routeKey="instructor/profile/payments"
          className="flex-1"
          style={vars({ "--tw-bg-app-bg": String(palette.appBg) })}
          contentContainerClassName="flex-grow justify-center px-lg"
          bottomSpacing={BrandSpacing.lg}
        >
          <View
            className="items-center border gap-lg rounded-card p-xl"
            style={vars({
              "--tw-bg-surface-alt": String(palette.surfaceAlt),
              "--tw-border": String(palette.border),
            })}
          >
            <View
              className="size-20 items-center justify-center rounded-pill border-[3px]"
              style={vars({
                "--tw-bg-primary": String(palette.didit.accent),
                "--tw-border": String(palette.primarySubtle),
              })}
            >
              <IconSymbol name="person.crop.circle.fill" size={40} color={palette.onPrimary} />
            </View>
            <ThemedText type="title" className="text-center">
              {t("profile.payments.verifyToConnectBankTitle")}
            </ThemedText>
            <ThemedText
              type="caption"
              className="text-center leading-5"
              style={vars({ "--tw-text-muted": String(palette.textMuted) })}
            >
              {t("profile.payments.verifyToConnectBankBody")}
            </ThemedText>
            <View
              className="flex-row items-center rounded-pill gap-xs px-md py-xs"
              style={vars({ "--tw-bg-accent-subtle": String(palette.didit.accentSubtle) })}
            >
              <ThemedText
                type="micro"
                className="font-semibold"
                style={vars({ "--tw-text-accent": String(palette.didit.accent) })}
              >
                {t("profile.identityVerification.providerPill")}
              </ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("profile.payments.verifyToConnectBankCta")}
              onPress={() => {
                setShowVerifyModal(false);
                void router.push(INSTRUCTOR_IDENTITY_VERIFICATION_ROUTE as Href);
              }}
              className="w-full border active:opacity-[0.85] rounded-button px-lg py-md"
              style={({ pressed }) =>
                vars({
                  "--tw-bg-primary": String(palette.didit.accent),
                  "--tw-text": String(palette.onPrimary),
                  opacity: pressed ? 0.85 : 1,
                })
              }
            >
              <ThemedText
                type="bodyStrong"
                className="text-center"
                style={vars({ "--tw-text": String(palette.onPrimary) })}
              >
                {t("profile.payments.verifyToConnectBankCta")}
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
              onPress={() => setShowVerifyModal(false)}
              className="active:opacity-60 px-md py-sm"
            >
              <ThemedText
                type="caption"
                style={vars({ "--tw-text-muted": String(palette.textMuted) })}
              >
                {t("common.cancel")}
              </ThemedText>
            </Pressable>
          </View>
        </ProfileSubpageScrollView>
      </Animated.View>
    );
  }

  return (
    <ProfileSubpageScrollView
      routeKey="instructor/profile/payments"
      className="flex-1"
      style={vars({ "--tw-bg-app-bg": String(palette.appBg) })}
      contentContainerClassName="gap-xl"
      topSpacing={BrandSpacing.md}
      bottomSpacing={BrandSpacing.lg}
    >
      <View className="gap-sm px-lg">
        {/* Consolidated Error/Info Banner */}
        {destinationError || withdrawError || preferenceError ? (
          <View
            className="border rounded-button-subtle px-md py-sm"
            style={vars({
              "--tw-bg-danger-subtle": String(palette.dangerSubtle),
              "--tw-border": String(palette.danger),
            })}
          >
            <ThemedText type="caption" style={vars({ "--tw-text-danger": String(palette.danger) })}>
              {destinationError || withdrawError || preferenceError}
            </ThemedText>
          </View>
        ) : destinationInfo || withdrawInfo || preferenceInfo ? (
          <View
            className="rounded-button-subtle px-md py-sm"
            style={vars({ "--tw-bg-surface-alt": String(palette.surfaceAlt) })}
          >
            <ThemedText
              type="caption"
              style={vars({ "--tw-text-muted": String(palette.textMuted) })}
            >
              {destinationInfo || withdrawInfo || preferenceInfo}
            </ThemedText>
          </View>
        ) : null}

        {/* Simplified Status Pill */}
        <KitStatusBadge
          label={
            isIdentityVerified && payoutSummary?.hasVerifiedDestination
              ? t("profile.payments.statusAllSet")
              : isIdentityVerified
                ? t("profile.payments.statusBankNeeded")
                : t("profile.payments.statusVerificationNeeded")
          }
          tone={
            isIdentityVerified && payoutSummary?.hasVerifiedDestination
              ? "success"
              : isIdentityVerified || payoutSummary?.hasVerifiedDestination
                ? "warning"
                : "danger"
          }
          showDot
        />

        {/* Action hint if needed */}
        {!isIdentityVerified ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("profile.setup.verifyIdentity")}
            onPress={() => router.push(INSTRUCTOR_IDENTITY_VERIFICATION_ROUTE as Href)}
            className="self-start rounded-pill border active:bg-surface-alt px-md py-sm"
            style={({ pressed }) =>
              vars({
                "--tw-bg-primary-subtle": String(palette.primarySubtle),
                "--tw-border": String(palette.primary),
                "--tw-text-primary": String(palette.primary),
                backgroundColor: String(pressed ? palette.surfaceAlt : palette.primarySubtle),
              })
            }
          >
            <ThemedText
              type="caption"
              style={vars({ "--tw-text-primary": String(palette.primary) })}
            >
              {t("profile.setup.verifyIdentity")}
            </ThemedText>
          </Pressable>
        ) : !payoutSummary?.hasVerifiedDestination ? (
          <ThemedText type="caption" style={vars({ "--tw-text-muted": String(palette.textMuted) })}>
            {payoutSummary?.onboardingStatus === "pending"
              ? t("profile.payments.onboardingPending")
              : payoutSummary?.onboardingStatus === "failed"
                ? (payoutSummary?.onboardingLastError ?? t("profile.payments.onboardingFailed"))
                : t("profile.payments.kycRequiredHint")}
          </ThemedText>
        ) : null}
      </View>

      {/* Hero Balance Card */}
      <View className="px-md">
        <View
          className="gap-xl rounded-card p-xl"
          style={vars({ "--tw-bg-payments-accent": String(palette.payments.accent) })}
        >
          <View className="flex-row justify-between items-start gap-md">
            <View className="min-w-0 flex-1">
              <ThemedText
                type="caption"
                className="uppercase tracking-wide opacity-80"
                style={vars({ "--tw-text-primary": String(palette.onPrimary) })}
              >
                {t("profile.payments.available")}
              </ThemedText>
              <ThemedText
                numberOfLines={1}
                minimumFontScale={0.76}
                adjustsFontSizeToFit
                className="mt-xs shrink"
                style={vars({
                  "--tw-text-primary": String(palette.onPrimary),
                  fontSize: BrandType.display.fontSize,
                  lineHeight: BrandType.display.lineHeight,
                  fontWeight: BrandType.display.fontWeight,
                  letterSpacing: BrandType.display.letterSpacing,
                })}
              >
                {formatAgorotCurrency(
                  payoutSummary?.availableAmountAgorot ?? 0,
                  locale,
                  payoutSummary?.currency ?? "ILS",
                )}
              </ThemedText>
            </View>
            <View
              className="rounded-pill px-md py-xs"
              style={vars({ "--tw-bg-primary": String(palette.onPrimary), opacity: 0.2 })}
            >
              <ThemedText
                type="micro"
                className="font-bold"
                style={vars({ "--tw-text-primary": String(palette.onPrimary) })}
              >
                {payoutSummary?.currency ?? "ILS"}
              </ThemedText>
            </View>
          </View>

          <View className="flex-row gap-md">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("profile.payments.withdrawToBank")}
              className="flex-1 flex-row items-center justify-center overflow-hidden active:scale-[0.985] gap-sm rounded-button px-lg py-md"
              style={() => {
                const isDisabled =
                  !isManualPayoutMode ||
                  !isIdentityVerified ||
                  !payoutSummary?.hasVerifiedDestination ||
                  (payoutSummary?.availableAmountAgorot ?? 0) <= 0;
                return vars({
                  "--tw-bg-primary": String(palette.onPrimary),
                  "--tw-text-primary": String(palette.onPrimary),
                  minHeight: BrandSpacing.xxl + BrandSpacing.xl,
                  opacity: withdrawBusy ? 0.5 : isDisabled ? 0.1 : 0.25,
                });
              }}
              onPress={() => {
                confirmWithdrawToBank();
              }}
              disabled={
                withdrawBusy ||
                !isManualPayoutMode ||
                !isIdentityVerified ||
                !payoutSummary?.hasVerifiedDestination ||
                (payoutSummary?.availableAmountAgorot ?? 0) <= 0
              }
            >
              <IconSymbol name="arrow.down" size={18} color={palette.onPrimary} />
              <ThemedText
                type="bodyStrong"
                style={vars({ "--tw-text-primary": String(palette.onPrimary) })}
              >
                {t("profile.payments.withdraw")}
              </ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                payoutSummary?.hasVerifiedDestination
                  ? t("profile.payments.manageBank")
                  : t("profile.payments.connectBank")
              }
              className="flex-1 flex-row items-center justify-center border active:scale-[0.985] gap-sm rounded-button px-lg py-md"
              style={({ pressed }) => {
                const hasDestination = payoutSummary?.hasVerifiedDestination;
                return vars({
                  "--tw-bg-primary": String(hasDestination ? palette.onPrimary : palette.text),
                  "--tw-border": String(hasDestination ? palette.onPrimary : palette.border),
                  "--tw-text-primary": String(palette.onPrimary),
                  minHeight: BrandSpacing.xxl + BrandSpacing.xl,
                  opacity: hasDestination ? (pressed ? 0.2 : 0.14) : pressed ? 0.88 : 1,
                });
              }}
              onPress={() => {
                if (!isIdentityVerified) {
                  setShowVerifyModal(true);
                  return;
                }
                void startHostedBankOnboarding();
              }}
              disabled={onboardingBusy}
            >
              <IconSymbol name="building.columns.fill" size={18} color={palette.onPrimary} />
              <ThemedText
                type="bodyStrong"
                style={vars({ "--tw-text-primary": String(palette.onPrimary) })}
              >
                {payoutSummary?.hasVerifiedDestination
                  ? t("profile.payments.manageBank")
                  : t("profile.payments.connectBank")}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Stats Row - Merged into Hero Card */}
        <View className="flex-row justify-center gap-xl">
          <View className="flex-row items-center gap-sm">
            <View
              className="size-2 rounded-full"
              style={vars({ "--tw-bg-warning": String(palette.warning) })}
            />
            <ThemedText
              type="caption"
              className="opacity-70"
              style={vars({ "--tw-text-primary": String(palette.onPrimary) })}
            >
              {t("profile.payments.pending")}
            </ThemedText>
            <ThemedText
              type="bodyStrong"
              className="tabular-nums"
              style={vars({ "--tw-text-primary": String(palette.onPrimary) })}
            >
              {formatAgorotCurrency(
                payoutSummary?.pendingAmountAgorot ?? 0,
                locale,
                payoutSummary?.currency ?? "ILS",
              )}
            </ThemedText>
          </View>
          <View className="flex-row items-center gap-sm">
            <View
              className="size-2 rounded-full"
              style={vars({ "--tw-bg-success": String(palette.success) })}
            />
            <ThemedText
              type="caption"
              className="opacity-70"
              style={vars({ "--tw-text-primary": String(palette.onPrimary) })}
            >
              {t("profile.payments.paid")}
            </ThemedText>
            <ThemedText
              type="bodyStrong"
              className="tabular-nums"
              style={vars({ "--tw-text-primary": String(palette.onPrimary) })}
            >
              {formatAgorotCurrency(
                payoutSummary?.paidAmountAgorot ?? 0,
                locale,
                payoutSummary?.currency ?? "ILS",
              )}
            </ThemedText>
          </View>
        </View>
      </View>

      <View className="gap-lg px-md">
        <View className="flex-row justify-between items-center">
          <ThemedText type="bodyStrong">{t("profile.payments.preferenceTitle")}</ThemedText>
        </View>

        <KitSegmentedToggle<PayoutPreferenceMode>
          value={effectivePreferenceMode}
          onChange={handlePreferenceModeChange}
          options={[
            {
              label: t("profile.payments.preferenceImmediate"),
              value: "immediate_when_eligible",
            },
            {
              label: t("profile.payments.preferenceScheduled"),
              value: "scheduled_date",
            },
            {
              label: t("profile.payments.preferenceHold"),
              value: "manual_hold",
            },
          ]}
        />

        <ThemedText type="caption" style={vars({ "--tw-text-muted": String(palette.textMuted) })}>
          {effectivePreferenceMode === "scheduled_date"
            ? t("profile.payments.preferenceScheduledHint")
            : effectivePreferenceMode === "manual_hold"
              ? t("profile.payments.preferenceHoldHint")
              : t("profile.payments.preferenceImmediateHint")}
        </ThemedText>

        {effectivePreferenceMode === "scheduled_date" ? (
          <View className="gap-sm">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("profile.payments.preferenceChooseDate")}
              onPress={() => setShowSchedulePicker((value) => !value)}
              className="border active:bg-surface rounded-button-subtle px-lg py-md"
              style={({ pressed }) =>
                vars({
                  "--tw-border": String(palette.border),
                  "--tw-bg-app-bg": String(palette.appBg),
                  backgroundColor: String(pressed ? palette.surface : palette.appBg),
                })
              }
            >
              <ThemedText
                type="micro"
                style={vars({ "--tw-text-muted": String(palette.textMuted) })}
              >
                {t("profile.payments.preferenceScheduleAt")}
              </ThemedText>
              <ThemedText type="bodyStrong">{scheduledAtLabel}</ThemedText>
            </Pressable>

            {showSchedulePicker ? (
              <View
                className="border rounded-button-subtle px-md py-sm gap-sm"
                style={vars({
                  "--tw-border": String(palette.border),
                  "--tw-bg-app-bg": String(palette.appBg),
                })}
              >
                <DateTimePicker
                  value={scheduleDraft}
                  mode="datetime"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  minimumDate={new Date(Date.now() + 60_000)}
                  onChange={(event, value) => {
                    if (Platform.OS !== "ios") {
                      setShowSchedulePicker(false);
                    }
                    if (event.type === "dismissed" || !value) {
                      return;
                    }
                    setScheduleDraft(value);
                  }}
                />
                {Platform.OS === "ios" ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("common.done")}
                    onPress={() => setShowSchedulePicker(false)}
                    className="self-start rounded-full active:bg-surface px-md py-sm"
                    style={({ pressed }) =>
                      vars({
                        "--tw-bg-primary-subtle": String(palette.primarySubtle),
                        backgroundColor: String(pressed ? palette.surface : palette.primarySubtle),
                      })
                    }
                  >
                    <ThemedText
                      type="bodyStrong"
                      style={vars({ "--tw-text-primary": String(palette.primary) })}
                    >
                      {t("common.done")}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View className="flex-row gap-sm">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("common.cancel")}
                onPress={() => {
                  setPendingPreferenceMode(null);
                  setShowSchedulePicker(false);
                  setScheduleDraft(
                    buildDefaultScheduledDate(payoutSummary?.payoutPreferenceScheduledDate),
                  );
                }}
                className="flex-1 items-center justify-center border active:bg-surface rounded-button-subtle"
                style={({ pressed }) =>
                  vars({
                    "--tw-border": String(palette.border),
                    "--tw-bg-app-bg": String(palette.appBg),
                    minHeight: BrandSpacing.xxl + BrandSpacing.md,
                    backgroundColor: String(pressed ? palette.surface : palette.appBg),
                  })
                }
              >
                <ThemedText type="bodyStrong">{t("common.cancel")}</ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("profile.payments.preferenceSaveSchedule")}
                onPress={() => {
                  void savePayoutPreference("scheduled_date", scheduleDraft.getTime());
                }}
                disabled={preferenceBusy}
                className="flex-1 items-center justify-center active:scale-[0.985] rounded-button-subtle"
                style={() =>
                  vars({
                    "--tw-bg-payments-accent": String(palette.payments.accent),
                    minHeight: BrandSpacing.xxl + BrandSpacing.md,
                    opacity: preferenceBusy ? 0.6 : 1,
                  })
                }
              >
                <ThemedText
                  type="bodyStrong"
                  style={vars({ "--tw-text-primary": String(palette.onPrimary) })}
                >
                  {preferenceBusy
                    ? t("profile.payments.preferenceSaving")
                    : t("profile.payments.preferenceSaveSchedule")}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : null}

        {preferenceError ? (
          <ThemedText type="caption" style={vars({ "--tw-text-danger": String(palette.danger) })}>
            {preferenceError}
          </ThemedText>
        ) : preferenceInfo ? (
          <ThemedText type="caption" style={vars({ "--tw-text-muted": String(palette.textMuted) })}>
            {preferenceInfo}
          </ThemedText>
        ) : null}
      </View>

      {selectedPaymentId ? (
        <View className="mt-xs gap-sm px-md">
          <View className="flex-row items-center justify-between">
            <ThemedText type="title">{t("profile.payments.receipt")}</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("profile.payments.close")}
              onPress={() => setSelectedPaymentId(null)}
              className="rounded-pill active:opacity-[0.84] px-md py-sm"
              style={vars({ "--tw-bg-surface-alt": String(palette.surfaceAlt) })}
            >
              <ThemedText
                type="caption"
                className="font-semibold"
                style={vars({ "--tw-text": String(palette.text) })}
              >
                {t("profile.payments.close")}
              </ThemedText>
            </Pressable>
          </View>
          {isDetailLoading ? (
            <View
              className="items-center rounded-card p-xl"
              style={vars({ "--tw-bg-surface-alt": String(palette.surfaceAlt) })}
            >
              <ThemedText style={vars({ "--tw-text-muted": String(palette.textMuted) })}>
                {t("profile.payments.loadingReceipt")}
              </ThemedText>
            </View>
          ) : !selectedPaymentDetail ? (
            <View
              className="items-center rounded-card p-xl"
              style={vars({ "--tw-bg-surface-alt": String(palette.surfaceAlt) })}
            >
              <ThemedText style={vars({ "--tw-text-muted": String(palette.textMuted) })}>
                {t("profile.payments.paymentNotFound")}
              </ThemedText>
            </View>
          ) : (
            <View
              className="overflow-hidden rounded-card"
              style={vars({ "--tw-bg-surface-alt": String(palette.surfaceAlt) })}
            >
              <View
                className="items-center border-b border-dashed gap-sm p-lg"
                style={vars({ "--tw-border": String(palette.border) })}
              >
                <View
                  className="size-12 items-center justify-center rounded-pill mb-xs"
                  style={vars({ "--tw-bg-success-subtle": String(palette.successSubtle) })}
                >
                  <IconSymbol name="checkmark" size={24} color={palette.success} />
                </View>
                <ThemedText
                  type="title"
                  className="tabular-nums"
                  style={vars({
                    "--tw-text": String(palette.text),
                    fontSize: BrandType.heroCompact.fontSize,
                    lineHeight: BrandType.heroCompact.lineHeight,
                    fontWeight: BrandType.heroCompact.fontWeight,
                  })}
                >
                  {formatAgorotCurrency(
                    role === "studio"
                      ? selectedPaymentDetail.payment.studioChargeAmountAgorot
                      : selectedPaymentDetail.payment.instructorBaseAmountAgorot,
                    locale,
                    selectedPaymentDetail.payment.currency,
                  )}
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={vars({ "--tw-text-muted": String(palette.textMuted) })}
                >
                  {formatDateTime(selectedPaymentDetail.payment.createdAt, locale)}
                </ThemedText>
              </View>
              <View className="gap-lg" style={{ padding: BrandSpacing.lg + BrandSpacing.xs }}>
                <View className="flex-row justify-between">
                  <ThemedText
                    type="caption"
                    style={vars({ "--tw-text-muted": String(palette.textMuted) })}
                  >
                    {t("profile.payments.status")}
                  </ThemedText>
                  <ThemedText type="bodyStrong">
                    {getPaymentStatusLabel(selectedPaymentDetail.payment.status)}
                  </ThemedText>
                </View>
                <View className="flex-row justify-between">
                  <ThemedText
                    type="caption"
                    style={vars({ "--tw-text-muted": String(palette.textMuted) })}
                  >
                    {t("profile.payments.payout")}
                  </ThemedText>
                  <ThemedText type="bodyStrong">
                    {selectedPaymentDetail.payout
                      ? getPayoutStatusLabel(selectedPaymentDetail.payout.status)
                      : t("profile.payments.pending")}
                  </ThemedText>
                </View>
                {selectedPaymentDetail.invoice?.externalInvoiceUrl ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("profile.payments.downloadInvoice")}
                    onPress={() => {
                      void WebBrowser.openBrowserAsync(
                        selectedPaymentDetail.invoice!.externalInvoiceUrl!,
                      );
                    }}
                    className="flex-row items-center justify-between py-sm active:opacity-[0.84]"
                  >
                    <ThemedText
                      type="bodyStrong"
                      style={vars({ "--tw-text-primary": String(palette.primary) })}
                    >
                      {t("profile.payments.downloadInvoice")}
                    </ThemedText>
                    <IconSymbol name="arrow.up.right" size={16} color={palette.primary} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        </View>
      ) : null}

      <View className="mt-sm">
        <PaymentActivityList
          viewerRole={role}
          items={rows}
          locale={locale}
          palette={palette}
          title={t("profile.payments.recentTransactions")}
          emptyLabel={t("profile.payments.noTransactions")}
          onSelectPaymentId={setSelectedPaymentId}
        />
      </View>
    </ProfileSubpageScrollView>
  );
}
