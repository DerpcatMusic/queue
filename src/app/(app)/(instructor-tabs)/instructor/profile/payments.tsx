import DateTimePicker from "@react-native-community/datetimepicker";
import { useAction, useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import type { Href } from "expo-router";
import { Redirect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform, Pressable, View } from "react-native";
import { LoadingScreen } from "@/components/loading-screen";
import { PaymentActivityList } from "@/components/payments/payment-activity-list";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSegmentedToggle, KitStatusBadge, KitSuccessBurst } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useRapydReturn } from "@/contexts/rapyd-return-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth } from "@/lib/design-system";
import { formatDateTime } from "@/lib/jobs-utils";
import {
  formatAgorotCurrency,
  getPaymentStatusLabel,
  getPayoutStatusLabel,
} from "@/lib/payments-utils";
import { buildRapydBridgeUrl, resolveRapydAppReturnUrl } from "@/lib/rapyd-hosted-flow";

const INSTRUCTOR_IDENTITY_VERIFICATION_ROUTE = "/instructor/profile/identity-verification" as const;
type PayoutPreferenceMode = "immediate_when_eligible" | "scheduled_date" | "manual_hold";

// ─── Local Style Constants ─────────────────────────────────────────────────────
const VERIFY_MODAL_AVATAR_SIZE = 80;
const VERIFY_MODAL_AVATAR_RADIUS = VERIFY_MODAL_AVATAR_SIZE / 2;
const VERIFY_MODAL_ICON_SIZE = 40;

const HERO_CARD_RADIUS = BrandRadius.cardSubtle; // 28
const HERO_CARD_PADDING = BrandSpacing.xl; // 24
const HERO_BUTTON_RADIUS = BrandRadius.medium; // 18
const HERO_BUTTON_MIN_HEIGHT = 54;
const HERO_BUTTON_PADDING = BrandSpacing.component; // 14

const STATUS_DOT_SIZE = BrandSpacing.statusDot; // 6
const STATUS_DOT_RADIUS = BrandSpacing.statusDot / 2; // 3

const BANNER_RADIUS = BrandRadius.lg; // 12
const BANNER_PADDING_H = BrandSpacing.component; // 14
const BANNER_PADDING_V = BrandSpacing.stackDense; // 10

const ACTION_HINT_RADIUS = BrandRadius.pill; // 999
const ACTION_HINT_PADDING_H = BrandSpacing.component; // 14
const ACTION_HINT_PADDING_V = BrandSpacing.sm; // 8

const PREFERENCE_CARD_RADIUS = BrandRadius.xl; // 16
const PREFERENCE_BUTTON_RADIUS = BrandRadius.xl; // 16
const PREFERENCE_BUTTON_MIN_HEIGHT = BrandSpacing.controlSm; // 38
const PREFERENCE_BUTTON_PADDING_H = BrandSpacing.component; // 14
const PREFERENCE_BUTTON_PADDING_V = BrandSpacing.stackDense; // 10

const RECEIPT_CARD_RADIUS = BrandRadius.soft; // 24
const RECEIPT_ICON_SIZE = 48;
const RECEIPT_ICON_RADIUS = RECEIPT_ICON_SIZE / 2;

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
  const locale = i18n.resolvedLanguage ?? "en";
  const router = useRouter();
  const theme = useTheme();
  const { color } = theme;

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
  const hasVerifiedDestination = payoutSummary?.hasVerifiedDestination ?? false;
  const withdrawDisabled =
    !isManualPayoutMode ||
    !isIdentityVerified ||
    !hasVerifiedDestination ||
    (payoutSummary?.availableAmountAgorot ?? 0) <= 0;
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
        style={{ flex: 1, backgroundColor: color.appBg }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: BrandSpacing.lg,
          justifyContent: "center",
        }}
        bottomSpacing={BrandSpacing.lg}
      >
        <View
          style={{
            backgroundColor: color.surfaceAlt,
            borderRadius: HERO_CARD_RADIUS,
            borderCurve: "continuous",
            padding: HERO_CARD_PADDING,
            gap: BrandSpacing.stackDense,
            alignItems: "center",
          }}
        >
          <ThemedText type="title">{t("profile.payments.finalizingTitle")}</ThemedText>
          <ThemedText type="caption" style={{ color: color.textMuted, textAlign: "center" }}>
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
        style={{ flex: 1, backgroundColor: color.appBg }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: BrandSpacing.lg,
          justifyContent: "center",
        }}
        bottomSpacing={BrandSpacing.lg}
      >
        <View
          style={{
            backgroundColor: color.surfaceAlt,
            borderRadius: HERO_CARD_RADIUS,
            borderCurve: "continuous",
            padding: HERO_CARD_PADDING,
            gap: BrandSpacing.stackDense,
            alignItems: "center",
          }}
        >
          <KitSuccessBurst iconName="building.columns.fill" />
          <ThemedText type="title">{t("profile.payments.successTitle")}</ThemedText>
          <ThemedText type="caption" style={{ color: color.textMuted, textAlign: "center" }}>
            {t("profile.payments.successBody")}
          </ThemedText>
        </View>
      </ProfileSubpageScrollView>
    );
  }

  if (showVerifyModal) {
    return (
      <ProfileSubpageScrollView
        routeKey="instructor/profile/payments"
        style={{ flex: 1, backgroundColor: color.appBg }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: BrandSpacing.lg,
          justifyContent: "center",
        }}
        bottomSpacing={BrandSpacing.lg}
      >
        <View
          style={{
            backgroundColor: color.surfaceAlt,
            borderRadius: HERO_CARD_RADIUS,
            borderCurve: "continuous",
            padding: HERO_CARD_PADDING,
            gap: BrandSpacing.insetComfort,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: VERIFY_MODAL_AVATAR_SIZE,
              height: VERIFY_MODAL_AVATAR_SIZE,
              borderRadius: VERIFY_MODAL_AVATAR_RADIUS,
              backgroundColor: color.tertiary,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: BorderWidth.thin,
              borderColor: color.onPrimary,
            }}
          >
            <IconSymbol
              name="person.crop.circle.fill"
              size={VERIFY_MODAL_ICON_SIZE}
              color={color.onPrimary}
            />
          </View>
          <ThemedText type="title" style={{ textAlign: "center" }}>
            {t("profile.payments.verifyToConnectBankTitle")}
          </ThemedText>
          <ThemedText
            type="caption"
            style={{
              color: color.textMuted,
              textAlign: "center",
              lineHeight: BrandType.caption.lineHeight,
            }}
          >
            {t("profile.payments.verifyToConnectBankBody")}
          </ThemedText>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: BrandSpacing.stackMicro,
              paddingHorizontal: BrandSpacing.md,
              paddingVertical: BrandSpacing.stackMicro,
              borderRadius: BrandRadius.pill,
              backgroundColor: color.tertiarySubtle,
            }}
          >
            <ThemedText type="micro" style={{ color: color.tertiary, fontWeight: "600" }}>
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
              paddingVertical: BrandSpacing.inset,
              paddingHorizontal: BrandSpacing.component,
              borderRadius: BrandRadius.medium,
              borderCurve: "continuous",
              alignItems: "center",
              backgroundColor: pressed ? color.primaryPressed : color.tertiary,
            })}
          >
            <ThemedText type="bodyStrong" style={{ color: color.onPrimary }}>
              {t("profile.payments.verifyToConnectBankCta")}
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
            onPress={() => setShowVerifyModal(false)}
            style={({ pressed }) => ({
              paddingVertical: PREFERENCE_BUTTON_PADDING_V,
              paddingHorizontal: PREFERENCE_BUTTON_PADDING_H,
              borderRadius: BrandRadius.pill,
              borderCurve: "continuous",
              borderWidth: BorderWidth.thin,
              borderColor: color.border,
              backgroundColor: pressed ? color.surfaceElevated : color.surfaceAlt,
            })}
          >
            <ThemedText type="caption" style={{ color: color.textMuted }}>
              {t("common.cancel")}
            </ThemedText>
          </Pressable>
        </View>
      </ProfileSubpageScrollView>
    );
  }

  return (
    <ProfileSubpageScrollView
      routeKey="instructor/profile/payments"
      style={{ flex: 1, backgroundColor: color.appBg }}
      contentContainerStyle={{
        gap: BrandSpacing.xl,
      }}
      topSpacing={BrandSpacing.md}
      bottomSpacing={40}
    >
      <View style={{ paddingHorizontal: BrandSpacing.lg, gap: BrandSpacing.sm }}>
        {/* Consolidated Error/Info Banner */}
        {destinationError || withdrawError || preferenceError ? (
          <View
            style={{
              backgroundColor: color.dangerSubtle,
              borderRadius: BANNER_RADIUS,
              paddingHorizontal: BANNER_PADDING_H,
              paddingVertical: BANNER_PADDING_V,
              borderWidth: BorderWidth.thin,
              borderColor: color.danger as string,
            }}
          >
            <ThemedText type="caption" style={{ color: color.danger }}>
              {destinationError || withdrawError || preferenceError}
            </ThemedText>
          </View>
        ) : destinationInfo || withdrawInfo || preferenceInfo ? (
          <View
            style={{
              backgroundColor: color.surfaceAlt,
              borderRadius: BANNER_RADIUS,
              paddingHorizontal: BANNER_PADDING_H,
              paddingVertical: BANNER_PADDING_V,
            }}
          >
            <ThemedText type="caption" style={{ color: color.textMuted }}>
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
              paddingHorizontal: ACTION_HINT_PADDING_H,
              paddingVertical: ACTION_HINT_PADDING_V,
              borderRadius: ACTION_HINT_RADIUS,
              borderCurve: "continuous",
              backgroundColor: pressed ? color.surfaceAlt : color.primarySubtle,
              borderWidth: BorderWidth.thin,
              borderColor: color.primary as string,
            })}
          >
            <ThemedText type="caption" style={{ color: color.primary }}>
              {t("profile.setup.verifyIdentity")}
            </ThemedText>
          </Pressable>
        ) : !payoutSummary?.hasVerifiedDestination ? (
          <ThemedText type="caption" style={{ color: color.textMuted }}>
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
            backgroundColor: color.success,
            borderRadius: HERO_CARD_RADIUS,
            padding: HERO_CARD_PADDING,
            gap: BrandSpacing.xl,
            borderCurve: "continuous",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: BrandSpacing.md,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <ThemedText
                type="caption"
                style={{
                  color: color.onPrimary,
                  textTransform: "uppercase",
                  letterSpacing: BrandSpacing.xs + BrandSpacing.xxs,
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
                  ...BrandType.display,
                  color: color.onPrimary,
                  marginTop: BrandSpacing.xs,
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
                backgroundColor: color.surface,
                paddingHorizontal: BrandSpacing.stackDense,
                paddingVertical: BrandSpacing.stackMicro,
                borderRadius: BrandRadius.pill,
              }}
            >
              <ThemedText type="micro" style={{ color: color.text, fontWeight: "700" }}>
                {payoutSummary?.currency ?? "ILS"}
              </ThemedText>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: BrandSpacing.md }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("profile.payments.withdrawToBank")}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: withdrawDisabled
                  ? color.surfaceAlt
                  : pressed
                    ? color.primaryPressed
                    : color.primary,
                borderRadius: HERO_BUTTON_RADIUS,
                minHeight: HERO_BUTTON_MIN_HEIGHT,
                padding: HERO_BUTTON_PADDING,
                alignItems: "center",
                borderCurve: "continuous",
                flexDirection: "row",
                justifyContent: "center",
                gap: BrandSpacing.sm,
                overflow: "hidden",
              })}
              onPress={() => {
                confirmWithdrawToBank();
              }}
              disabled={withdrawBusy || withdrawDisabled}
            >
              <IconSymbol name="arrow.down" size={BrandSpacing.iconSm} color={color.onPrimary} />
              <ThemedText type="labelStrong" style={{ color: color.onPrimary }}>
                {t("profile.payments.withdraw")}
              </ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                hasVerifiedDestination
                  ? t("profile.payments.manageBank")
                  : t("profile.payments.connectBank")
              }
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: hasVerifiedDestination
                  ? pressed
                    ? color.surfaceElevated
                    : color.surfaceAlt
                  : pressed
                    ? color.primaryPressed
                    : color.text,
                borderRadius: HERO_BUTTON_RADIUS,
                minHeight: HERO_BUTTON_MIN_HEIGHT,
                padding: HERO_BUTTON_PADDING,
                alignItems: "center",
                borderCurve: "continuous",
                flexDirection: "row",
                justifyContent: "center",
                gap: BrandSpacing.sm,
                overflow: "hidden",
                borderWidth: BorderWidth.thin,
                borderColor: hasVerifiedDestination ? color.borderStrong : color.text,
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
              <IconSymbol
                name="building.columns.fill"
                size={BrandSpacing.iconSm}
                color={hasVerifiedDestination ? color.text : color.onPrimary}
              />
              <ThemedText
                type="labelStrong"
                style={{ color: hasVerifiedDestination ? color.text : color.onPrimary }}
              >
                {hasVerifiedDestination
                  ? t("profile.payments.manageBank")
                  : t("profile.payments.connectBank")}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Stats Row - Merged into Hero Card */}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: BrandSpacing.xl }}>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.stackMicro }}
          >
            <View
              style={{
                width: STATUS_DOT_SIZE,
                height: STATUS_DOT_SIZE,
                borderRadius: STATUS_DOT_RADIUS,
                backgroundColor: color.warning,
              }}
            />
            <ThemedText type="caption" style={{ color: color.onPrimary }}>
              {t("profile.payments.pending")}
            </ThemedText>
            <ThemedText
              type="bodyStrong"
              style={{ color: color.onPrimary, fontVariant: ["tabular-nums"] }}
            >
              {formatAgorotCurrency(
                payoutSummary?.pendingAmountAgorot ?? 0,
                locale,
                payoutSummary?.currency ?? "ILS",
              )}
            </ThemedText>
          </View>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.stackMicro }}
          >
            <View
              style={{
                width: STATUS_DOT_SIZE,
                height: STATUS_DOT_SIZE,
                borderRadius: STATUS_DOT_RADIUS,
                backgroundColor: color.success,
              }}
            />
            <ThemedText type="caption" style={{ color: color.onPrimary }}>
              {t("profile.payments.paid")}
            </ThemedText>
            <ThemedText
              type="bodyStrong"
              style={{ color: color.onPrimary, fontVariant: ["tabular-nums"] }}
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

      <View style={{ paddingHorizontal: BrandSpacing.md, gap: BrandSpacing.md }}>
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

        <ThemedText type="caption" style={{ color: color.textMuted }}>
          {effectivePreferenceMode === "scheduled_date"
            ? t("profile.payments.preferenceScheduledHint")
            : effectivePreferenceMode === "manual_hold"
              ? t("profile.payments.preferenceHoldHint")
              : t("profile.payments.preferenceImmediateHint")}
        </ThemedText>

        {effectivePreferenceMode === "scheduled_date" ? (
          <View style={{ gap: BrandSpacing.md }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("profile.payments.preferenceChooseDate")}
              onPress={() => setShowSchedulePicker((value) => !value)}
              style={({ pressed }) => ({
                borderRadius: PREFERENCE_CARD_RADIUS,
                borderCurve: "continuous",
                borderWidth: BorderWidth.thin,
                borderColor: color.border as string,
                backgroundColor: pressed ? color.surfaceElevated : color.appBg,
                paddingHorizontal: BrandSpacing.inset,
                paddingVertical: BrandSpacing.md,
                gap: BrandSpacing.xs,
              })}
            >
              <ThemedText type="micro" style={{ color: color.textMuted }}>
                {t("profile.payments.preferenceScheduleAt")}
              </ThemedText>
              <ThemedText type="bodyStrong">{scheduledAtLabel}</ThemedText>
            </Pressable>

            {showSchedulePicker ? (
              <View
                style={{
                  borderRadius: PREFERENCE_CARD_RADIUS,
                  borderCurve: "continuous",
                  borderWidth: BorderWidth.thin,
                  borderColor: color.border as string,
                  backgroundColor: color.surface,
                  padding: BrandSpacing.md,
                  gap: BrandSpacing.stackDense,
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
                      paddingHorizontal: PREFERENCE_BUTTON_PADDING_H,
                      paddingVertical: PREFERENCE_BUTTON_PADDING_V,
                      borderRadius: BrandRadius.pill,
                      borderCurve: "continuous",
                      backgroundColor: pressed ? color.primaryPressed : color.primary,
                    })}
                  >
                    <ThemedText type="bodyStrong" style={{ color: color.onPrimary }}>
                      {t("common.done")}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View style={{ flexDirection: "row", gap: BrandSpacing.md }}>
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
                  minHeight: PREFERENCE_BUTTON_MIN_HEIGHT,
                  borderRadius: PREFERENCE_BUTTON_RADIUS,
                  borderCurve: "continuous",
                  borderWidth: BorderWidth.thin,
                  borderColor: color.border as string,
                  backgroundColor: pressed ? color.surfaceAlt : color.appBg,
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
                  minHeight: PREFERENCE_BUTTON_MIN_HEIGHT,
                  borderRadius: PREFERENCE_BUTTON_RADIUS,
                  borderCurve: "continuous",
                  backgroundColor: preferenceBusy
                    ? color.surfaceAlt
                    : pressed
                      ? color.primaryPressed
                      : color.success,
                })}
              >
                <ThemedText
                  type="bodyStrong"
                  style={{
                    color: preferenceBusy ? color.textMuted : color.onPrimary,
                  }}
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
          <ThemedText type="caption" style={{ color: color.danger }}>
            {preferenceError}
          </ThemedText>
        ) : preferenceInfo ? (
          <ThemedText type="caption" style={{ color: color.textMuted }}>
            {preferenceInfo}
          </ThemedText>
        ) : null}
      </View>

      {selectedPaymentId ? (
        <View
          style={{
            paddingHorizontal: BrandSpacing.md,
            gap: BrandSpacing.md,
            marginTop: BrandSpacing.sm,
          }}
        >
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
                backgroundColor: pressed ? color.surfaceElevated : color.surfaceAlt,
                paddingHorizontal: BrandSpacing.md,
                paddingVertical: BrandSpacing.stackMicro,
                borderRadius: BrandRadius.pill,
                borderCurve: "continuous",
                borderWidth: BorderWidth.thin,
                borderColor: color.border,
              })}
            >
              <ThemedText type="caption" style={{ color: color.text, fontWeight: "600" }}>
                {t("profile.payments.close")}
              </ThemedText>
            </Pressable>
          </View>
          {isDetailLoading ? (
            <View
              style={{
                backgroundColor: color.surfaceAlt,
                padding: HERO_CARD_PADDING,
                borderRadius: RECEIPT_CARD_RADIUS,
                alignItems: "center",
              }}
            >
              <ThemedText style={{ color: color.textMuted }}>
                {t("profile.payments.loadingReceipt")}
              </ThemedText>
            </View>
          ) : !selectedPaymentDetail ? (
            <View
              style={{
                backgroundColor: color.surfaceAlt,
                padding: HERO_CARD_PADDING,
                borderRadius: RECEIPT_CARD_RADIUS,
                alignItems: "center",
              }}
            >
              <ThemedText style={{ color: color.textMuted }}>
                {t("profile.payments.paymentNotFound")}
              </ThemedText>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: color.surfaceAlt,
                borderRadius: RECEIPT_CARD_RADIUS,
                borderCurve: "continuous",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  padding: BrandSpacing.insetComfort,
                  borderBottomWidth: BorderWidth.thin,
                  borderBottomColor: color.border,
                  borderStyle: "dashed",
                  alignItems: "center",
                  gap: BrandSpacing.sm,
                }}
              >
                <View
                  style={{
                    width: RECEIPT_ICON_SIZE,
                    height: RECEIPT_ICON_SIZE,
                    borderRadius: RECEIPT_ICON_RADIUS,
                    backgroundColor: color.successSubtle,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: BrandSpacing.xs,
                  }}
                >
                  <IconSymbol
                    name="checkmark"
                    size={BrandSpacing.iconMd}
                    color={color.success as import("react-native").ColorValue}
                  />
                </View>
                <ThemedText
                  type="title"
                  style={{ fontVariant: ["tabular-nums"], ...BrandType.titleLarge }}
                >
                  {formatAgorotCurrency(
                    role === "studio"
                      ? selectedPaymentDetail.payment.studioChargeAmountAgorot
                      : selectedPaymentDetail.payment.instructorBaseAmountAgorot,
                    locale,
                    selectedPaymentDetail.payment.currency,
                  )}
                </ThemedText>
                <ThemedText type="caption" style={{ color: color.textMuted }}>
                  {formatDateTime(selectedPaymentDetail.payment.createdAt, locale)}
                </ThemedText>
              </View>
              <View style={{ padding: BrandSpacing.insetComfort, gap: BrandSpacing.inset }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <ThemedText type="caption" style={{ color: color.textMuted }}>
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
                  <ThemedText type="caption" style={{ color: color.textMuted }}>
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
                      paddingVertical: BrandSpacing.sm,
                      paddingHorizontal: BrandSpacing.md,
                      borderRadius: BrandRadius.lg,
                      borderCurve: "continuous",
                      borderWidth: BorderWidth.thin,
                      borderColor: color.border,
                      backgroundColor: pressed ? color.surfaceAlt : color.surface,
                    })}
                  >
                    <ThemedText type="bodyStrong" style={{ color: color.primary }}>
                      {t("profile.payments.downloadInvoice")}
                    </ThemedText>
                    <IconSymbol
                      name="arrow.up.right"
                      size={BrandSpacing.iconSm}
                      color={color.primary}
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        </View>
      ) : null}

      <View style={{ marginTop: BrandSpacing.sm }}>
        <PaymentActivityList
          viewerRole={role}
          items={rows}
          locale={locale}
          title={t("profile.payments.recentTransactions")}
          emptyLabel={t("profile.payments.noTransactions")}
          onSelectPaymentId={setSelectedPaymentId}
        />
      </View>
    </ProfileSubpageScrollView>
  );
}
