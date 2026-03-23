import DateTimePicker from "@react-native-community/datetimepicker";
import { useAction, useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import type { Href } from "expo-router";
import { Redirect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
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
import { BrandSpacing } from "@/constants/brand";
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
        style={{ flex: 1, backgroundColor: palette.appBg }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: BrandSpacing.lg,
          justifyContent: "center",
        }}
        bottomSpacing={BrandSpacing.lg}
      >
        <View
          style={{
            backgroundColor: palette.surfaceAlt,
            borderRadius: 28,
            borderCurve: "continuous",
            padding: 24,
            gap: 10,
            alignItems: "center",
          }}
        >
          <ThemedText type="title">{t("profile.payments.finalizingTitle")}</ThemedText>
          <ThemedText type="caption" style={{ color: palette.textMuted, textAlign: "center" }}>
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
        style={{ flex: 1, backgroundColor: palette.appBg }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: BrandSpacing.lg,
          justifyContent: "center",
        }}
        bottomSpacing={BrandSpacing.lg}
      >
        <View
          style={{
            backgroundColor: palette.surfaceAlt,
            borderRadius: 28,
            borderCurve: "continuous",
            padding: 24,
            gap: 10,
            alignItems: "center",
          }}
        >
          <KitSuccessBurst iconName="building.columns.fill" />
          <ThemedText type="title">{t("profile.payments.successTitle")}</ThemedText>
          <ThemedText type="caption" style={{ color: palette.textMuted, textAlign: "center" }}>
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
        style={{ flex: 1, backgroundColor: palette.appBg }}
      >
        <ProfileSubpageScrollView
          routeKey="instructor/profile/payments"
          style={{ flex: 1, backgroundColor: palette.appBg }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: BrandSpacing.lg,
            justifyContent: "center",
          }}
          bottomSpacing={BrandSpacing.lg}
        >
          <View
            style={{
              backgroundColor: palette.surfaceAlt,
              borderRadius: 28,
              borderCurve: "continuous",
              padding: 24,
              gap: 20,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: palette.didit.accent,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 3,
                borderColor: "rgba(255,255,255,0.3)",
              }}
            >
              <IconSymbol name="person.crop.circle.fill" size={40} color="#FFF" />
            </View>
            <ThemedText type="title" style={{ textAlign: "center" }}>
              {t("profile.payments.verifyToConnectBankTitle")}
            </ThemedText>
            <ThemedText
              type="caption"
              style={{ color: palette.textMuted, textAlign: "center", lineHeight: 20 }}
            >
              {t("profile.payments.verifyToConnectBankBody")}
            </ThemedText>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: palette.didit.accentSubtle,
              }}
            >
              <ThemedText type="micro" style={{ color: palette.didit.accent, fontWeight: "600" }}>
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
              style={({ pressed }) => ({
                width: "100%",
                paddingVertical: 16,
                paddingHorizontal: 18,
                borderRadius: 20,
                borderCurve: "continuous",
                alignItems: "center",
                backgroundColor: palette.didit.accent,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <ThemedText type="bodyStrong" style={{ color: "#FFF" }}>
                {t("profile.payments.verifyToConnectBankCta")}
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
              onPress={() => setShowVerifyModal(false)}
              style={({ pressed }) => ({
                paddingVertical: 10,
                paddingHorizontal: 14,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <ThemedText type="caption" style={{ color: palette.textMuted }}>
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
      style={{ flex: 1, backgroundColor: palette.appBg }}
      contentContainerStyle={{
        gap: 24,
      }}
      topSpacing={BrandSpacing.md}
      bottomSpacing={40}
    >
      <View style={{ paddingHorizontal: BrandSpacing.lg, gap: 8 }}>
        {/* Consolidated Error/Info Banner */}
        {destinationError || withdrawError || preferenceError ? (
          <View
            style={{
              backgroundColor: palette.dangerSubtle,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: palette.danger as string,
            }}
          >
            <ThemedText type="caption" style={{ color: palette.danger }}>
              {destinationError || withdrawError || preferenceError}
            </ThemedText>
          </View>
        ) : destinationInfo || withdrawInfo || preferenceInfo ? (
          <View
            style={{
              backgroundColor: palette.surfaceAlt,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}
          >
            <ThemedText type="caption" style={{ color: palette.textMuted }}>
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
            style={({ pressed }) => ({
              alignSelf: "flex-start",
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              borderCurve: "continuous",
              backgroundColor: pressed ? palette.surfaceAlt : palette.primarySubtle,
              borderWidth: 1,
              borderColor: palette.primary as string,
            })}
          >
            <ThemedText type="caption" style={{ color: palette.primary }}>
              {t("profile.setup.verifyIdentity")}
            </ThemedText>
          </Pressable>
        ) : !payoutSummary?.hasVerifiedDestination ? (
          <ThemedText type="caption" style={{ color: palette.textMuted }}>
            {payoutSummary?.onboardingStatus === "pending"
              ? t("profile.payments.onboardingPending")
              : payoutSummary?.onboardingStatus === "failed"
                ? (payoutSummary?.onboardingLastError ?? t("profile.payments.onboardingFailed"))
                : t("profile.payments.kycRequiredHint")}
          </ThemedText>
        ) : null}
      </View>

      {/* Hero Balance Card */}
      <View style={{ paddingHorizontal: BrandSpacing.md }}>
        <View
          style={{
            backgroundColor: palette.payments.accent,
            borderRadius: 28,
            padding: 24,
            gap: 24,
            borderCurve: "continuous",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <ThemedText
                type="caption"
                style={{
                  color: "rgba(255,255,255,0.8)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  fontWeight: "600",
                }}
              >
                {t("profile.payments.available")}
              </ThemedText>
              <ThemedText
                numberOfLines={1}
                minimumFontScale={0.76}
                adjustsFontSizeToFit
                style={{
                  color: "#FFF",
                  fontSize: 40,
                  lineHeight: 44,
                  fontWeight: "800",
                  fontVariant: ["tabular-nums"],
                  marginTop: 4,
                  letterSpacing: -1,
                  flexShrink: 1,
                }}
              >
                {formatAgorotCurrency(
                  payoutSummary?.availableAmountAgorot ?? 0,
                  locale,
                  payoutSummary?.currency ?? "ILS",
                )}
              </ThemedText>
            </View>
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.2)",
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
              }}
            >
              <ThemedText type="micro" style={{ color: "#FFF", fontWeight: "700" }}>
                {payoutSummary?.currency ?? "ILS"}
              </ThemedText>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("profile.payments.withdrawToBank")}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor:
                  !isManualPayoutMode ||
                  !isIdentityVerified ||
                  !payoutSummary?.hasVerifiedDestination ||
                  (payoutSummary?.availableAmountAgorot ?? 0) <= 0
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(255,255,255,0.25)",
                borderRadius: 20,
                minHeight: 54,
                padding: 14,
                alignItems: "center",
                borderCurve: "continuous",
                opacity: withdrawBusy ? 0.5 : 1,
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
                overflow: "hidden",
                transform: [{ scale: pressed ? 0.985 : 1 }],
              })}
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
              <IconSymbol name="arrow.down" size={18} color="#FFF" />
              <ThemedText type="bodyStrong" style={{ color: "#FFF", fontSize: 16 }}>
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
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: payoutSummary?.hasVerifiedDestination
                  ? pressed
                    ? "rgba(255,255,255,0.2)"
                    : "rgba(255,255,255,0.14)"
                  : pressed
                    ? "rgba(0,0,0,0.88)"
                    : "#000",
                borderRadius: 20,
                minHeight: 54,
                padding: 14,
                alignItems: "center",
                borderCurve: "continuous",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: payoutSummary?.hasVerifiedDestination
                  ? "rgba(255,255,255,0.18)"
                  : "rgba(255,255,255,0.22)",
                transform: [{ scale: pressed ? 0.985 : 1 }],
              })}
              onPress={() => {
                if (!isIdentityVerified) {
                  setShowVerifyModal(true);
                  return;
                }
                void startHostedBankOnboarding();
              }}
              disabled={onboardingBusy}
            >
              <IconSymbol name="building.columns.fill" size={18} color="#FFF" />
              <ThemedText type="bodyStrong" style={{ color: "#FFF", fontSize: 16 }}>
                {payoutSummary?.hasVerifiedDestination
                  ? t("profile.payments.manageBank")
                  : t("profile.payments.connectBank")}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Stats Row - Merged into Hero Card */}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: palette.warning,
              }}
            />
            <ThemedText type="caption" style={{ color: "rgba(255,255,255,0.7)" }}>
              {t("profile.payments.pending")}
            </ThemedText>
            <ThemedText type="bodyStrong" style={{ color: "#FFF", fontVariant: ["tabular-nums"] }}>
              {formatAgorotCurrency(
                payoutSummary?.pendingAmountAgorot ?? 0,
                locale,
                payoutSummary?.currency ?? "ILS",
              )}
            </ThemedText>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: palette.success,
              }}
            />
            <ThemedText type="caption" style={{ color: "rgba(255,255,255,0.7)" }}>
              {t("profile.payments.paid")}
            </ThemedText>
            <ThemedText type="bodyStrong" style={{ color: "#FFF", fontVariant: ["tabular-nums"] }}>
              {formatAgorotCurrency(
                payoutSummary?.paidAmountAgorot ?? 0,
                locale,
                payoutSummary?.currency ?? "ILS",
              )}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: BrandSpacing.md, gap: 12 }}>
        <View
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
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

        <ThemedText type="caption" style={{ color: palette.textMuted }}>
          {effectivePreferenceMode === "scheduled_date"
            ? t("profile.payments.preferenceScheduledHint")
            : effectivePreferenceMode === "manual_hold"
              ? t("profile.payments.preferenceHoldHint")
              : t("profile.payments.preferenceImmediateHint")}
        </ThemedText>

        {effectivePreferenceMode === "scheduled_date" ? (
          <View style={{ gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("profile.payments.preferenceChooseDate")}
              onPress={() => setShowSchedulePicker((value) => !value)}
              style={({ pressed }) => ({
                borderRadius: 16,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: palette.border as string,
                backgroundColor: pressed ? palette.surface : palette.appBg,
                paddingHorizontal: 16,
                paddingVertical: 12,
                gap: 4,
              })}
            >
              <ThemedText type="micro" style={{ color: palette.textMuted }}>
                {t("profile.payments.preferenceScheduleAt")}
              </ThemedText>
              <ThemedText type="bodyStrong">{scheduledAtLabel}</ThemedText>
            </Pressable>

            {showSchedulePicker ? (
              <View
                style={{
                  borderRadius: 16,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: palette.border as string,
                  backgroundColor: palette.appBg,
                  padding: 12,
                  gap: 10,
                }}
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
                    style={({ pressed }) => ({
                      alignSelf: "flex-start",
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 999,
                      borderCurve: "continuous",
                      backgroundColor: pressed ? palette.surface : palette.primarySubtle,
                    })}
                  >
                    <ThemedText type="bodyStrong" style={{ color: palette.primary }}>
                      {t("common.done")}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View style={{ flexDirection: "row", gap: 12 }}>
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
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 44,
                  borderRadius: 16,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: palette.border as string,
                  backgroundColor: pressed ? palette.surface : palette.appBg,
                })}
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
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 44,
                  borderRadius: 16,
                  borderCurve: "continuous",
                  backgroundColor: palette.payments.accent,
                  opacity: preferenceBusy ? 0.6 : 1,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                })}
              >
                <ThemedText type="bodyStrong" style={{ color: "#FFFFFF" }}>
                  {preferenceBusy
                    ? t("profile.payments.preferenceSaving")
                    : t("profile.payments.preferenceSaveSchedule")}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : null}

        {preferenceError ? (
          <ThemedText type="caption" style={{ color: palette.danger }}>
            {preferenceError}
          </ThemedText>
        ) : preferenceInfo ? (
          <ThemedText type="caption" style={{ color: palette.textMuted }}>
            {preferenceInfo}
          </ThemedText>
        ) : null}
      </View>

      {selectedPaymentId ? (
        <View style={{ paddingHorizontal: BrandSpacing.md, gap: 12, marginTop: 8 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <ThemedText type="title">{t("profile.payments.receipt")}</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("profile.payments.close")}
              onPress={() => setSelectedPaymentId(null)}
              style={({ pressed }) => ({
                backgroundColor: palette.surfaceAlt,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                opacity: pressed ? 0.84 : 1,
              })}
            >
              <ThemedText type="caption" style={{ color: palette.text, fontWeight: "600" }}>
                {t("profile.payments.close")}
              </ThemedText>
            </Pressable>
          </View>
          {isDetailLoading ? (
            <View
              style={{
                backgroundColor: palette.surfaceAlt,
                padding: 24,
                borderRadius: 24,
                alignItems: "center",
              }}
            >
              <ThemedText style={{ color: palette.textMuted }}>
                {t("profile.payments.loadingReceipt")}
              </ThemedText>
            </View>
          ) : !selectedPaymentDetail ? (
            <View
              style={{
                backgroundColor: palette.surfaceAlt,
                padding: 24,
                borderRadius: 24,
                alignItems: "center",
              }}
            >
              <ThemedText style={{ color: palette.textMuted }}>
                {t("profile.payments.paymentNotFound")}
              </ThemedText>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: palette.surfaceAlt,
                borderRadius: 24,
                borderCurve: "continuous",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  padding: 20,
                  borderBottomWidth: 1,
                  borderBottomColor: palette.border,
                  borderStyle: "dashed",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: palette.successSubtle,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 4,
                  }}
                >
                  <IconSymbol
                    name="checkmark"
                    size={24}
                    color={palette.success as import("react-native").ColorValue}
                  />
                </View>
                <ThemedText type="title" style={{ fontSize: 32, fontVariant: ["tabular-nums"] }}>
                  {formatAgorotCurrency(
                    role === "studio"
                      ? selectedPaymentDetail.payment.studioChargeAmountAgorot
                      : selectedPaymentDetail.payment.instructorBaseAmountAgorot,
                    locale,
                    selectedPaymentDetail.payment.currency,
                  )}
                </ThemedText>
                <ThemedText type="caption" style={{ color: palette.textMuted }}>
                  {formatDateTime(selectedPaymentDetail.payment.createdAt, locale)}
                </ThemedText>
              </View>
              <View style={{ padding: 20, gap: 16 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <ThemedText type="caption" style={{ color: palette.textMuted }}>
                    {t("profile.payments.status")}
                  </ThemedText>
                  <ThemedText type="bodyStrong">
                    {getPaymentStatusLabel(selectedPaymentDetail.payment.status)}
                  </ThemedText>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <ThemedText type="caption" style={{ color: palette.textMuted }}>
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
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 8,
                      opacity: pressed ? 0.84 : 1,
                    })}
                  >
                    <ThemedText type="bodyStrong" style={{ color: palette.primary }}>
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

      <View style={{ marginTop: 8 }}>
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
