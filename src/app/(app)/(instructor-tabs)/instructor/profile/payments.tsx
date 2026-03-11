import { useAction, useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import type { Href } from "expo-router";
import { Redirect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform, View } from "react-native";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import { PaymentActivityList } from "@/components/payments/payment-activity-list";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitPressable, KitSuccessBurst } from "@/components/ui/kit";
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

WebBrowser.maybeCompleteAuthSession();

const INSTRUCTOR_IDENTITY_VERIFICATION_ROUTE = "/instructor/profile/identity-verification" as const;

export default function ProfilePaymentsScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const locale = i18n.resolvedLanguage ?? "en";
  const router = useRouter();

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
  const [selectedPaymentId, setSelectedPaymentId] = useState<Id<"payments"> | null>(null);

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
      setWithdrawError(error instanceof Error ? error.message : t("profile.payments.withdrawalFailed"));
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
      setDestinationError(error instanceof Error ? error.message : t("profile.payments.openFailed"));
    } finally {
      setOnboardingBusy(false);
    }
  };

  if (isFinalizingOnboarding) {
    return (
      <TabScreenScrollView
        routeKey="instructor/profile"
        style={{ flex: 1, backgroundColor: palette.appBg }}
        contentContainerStyle={{ flexGrow: 1, padding: BrandSpacing.lg, justifyContent: "center" }}
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
      </TabScreenScrollView>
    );
  }

  if (showOnboardingSuccess) {
    return (
      <TabScreenScrollView
        routeKey="instructor/profile"
        style={{ flex: 1, backgroundColor: palette.appBg }}
        contentContainerStyle={{ flexGrow: 1, padding: BrandSpacing.lg, justifyContent: "center" }}
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
      </TabScreenScrollView>
    );
  }

  return (
    <TabScreenScrollView
      routeKey="instructor/profile"
      style={{ flex: 1, backgroundColor: palette.appBg }}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 40, gap: 24 }}
    >
      <View style={{ paddingHorizontal: BrandSpacing.lg }}>
        <View
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: payoutSummary?.hasVerifiedDestination
              ? palette.successSubtle
              : palette.warningSubtle,
          }}
        >
          <ThemedText
            type="micro"
            style={{
              color: payoutSummary?.hasVerifiedDestination ? palette.success : palette.warning,
              fontWeight: "700",
            }}
          >
            {payoutSummary?.hasVerifiedDestination
              ? t("profile.payments.bankConnected")
              : t("profile.payments.bankNotConnected")}
          </ThemedText>
        </View>
        <View
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            marginTop: 8,
            backgroundColor: isIdentityVerified ? palette.successSubtle : palette.warningSubtle,
          }}
        >
          <ThemedText
            type="micro"
            style={{
              color: isIdentityVerified ? palette.success : palette.warning,
              fontWeight: "700",
            }}
          >
            {isIdentityVerified ? t("profile.payments.kycVerified") : t("profile.payments.kycRequired")}
          </ThemedText>
        </View>
        {!isIdentityVerified ? (
          <View style={{ marginTop: 8, gap: 10, alignItems: "flex-start" }}>
            <ThemedText type="caption" style={{ color: palette.textMuted }}>
              {t("profile.payments.kycRequiredHint")}
            </ThemedText>
            <KitPressable
              accessibilityRole="button"
              accessibilityLabel={t("profile.setup.verifyIdentity")}
              haptic="impact"
              pressedOpacity={0.9}
              onPress={() => router.push(INSTRUCTOR_IDENTITY_VERIFICATION_ROUTE as Href)}
              style={({ pressed }) => ({
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 999,
                borderCurve: "continuous",
                backgroundColor: pressed ? palette.surfaceAlt : palette.primarySubtle,
                borderWidth: 1,
                borderColor: palette.primary as string,
              })}
            >
              <ThemedText type="bodyStrong" style={{ color: palette.primary }}>
                {t("profile.setup.verifyIdentity")}
              </ThemedText>
            </KitPressable>
          </View>
        ) : null}
        {!payoutSummary?.hasVerifiedDestination && payoutSummary?.onboardingStatus === "pending" ? (
          <ThemedText type="caption" style={{ color: palette.textMuted, marginTop: 6 }}>
            {t("profile.payments.onboardingPending")}
          </ThemedText>
        ) : null}
        {!payoutSummary?.hasVerifiedDestination && payoutSummary?.onboardingStatus === "failed" ? (
          <ThemedText type="caption" style={{ color: palette.danger, marginTop: 6 }}>
            {payoutSummary?.onboardingLastError ?? t("profile.payments.onboardingFailed")}
          </ThemedText>
        ) : null}
      </View>

      {/* Hero Balance Card */}
      <View style={{ paddingHorizontal: BrandSpacing.md }}>
        <View
          style={{
            backgroundColor: palette.primary,
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
            <KitPressable
              accessibilityRole="button"
              accessibilityLabel={t("profile.payments.withdrawToBank")}
              haptic="impact"
              pressedOpacity={0.96}
              pressStyle={{ transform: [{ scale: 0.985 }] }}
              style={{
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
              <IconSymbol name="arrow.down" size={18} color="#FFF" />
              <ThemedText type="bodyStrong" style={{ color: "#FFF", fontSize: 16 }}>
                {t("profile.payments.withdraw")}
              </ThemedText>
            </KitPressable>

            <KitPressable
              accessibilityRole="button"
              accessibilityLabel={
                payoutSummary?.hasVerifiedDestination
                  ? t("profile.payments.manageBank")
                  : t("profile.payments.connectBank")
              }
              pressedOpacity={0.96}
              pressStyle={{ transform: [{ scale: 0.985 }] }}
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
              })}
              onPress={() => {
                void startHostedBankOnboarding();
              }}
              disabled={onboardingBusy || !isIdentityVerified}
            >
              <IconSymbol name="building.columns.fill" size={18} color="#FFF" />
              <ThemedText type="bodyStrong" style={{ color: "#FFF", fontSize: 16 }}>
                {payoutSummary?.hasVerifiedDestination
                  ? t("profile.payments.manageBank")
                  : t("profile.payments.connectBank")}
              </ThemedText>
            </KitPressable>
          </View>
        </View>

        {withdrawError || destinationError ? (
          <ThemedText
            style={{ color: palette.danger, marginTop: 12, textAlign: "center", fontWeight: "500" }}
          >
            {withdrawError || destinationError}
          </ThemedText>
        ) : withdrawInfo || destinationInfo ? (
          <ThemedText style={{ color: palette.textMuted, marginTop: 12, textAlign: "center" }}>
            {withdrawInfo || destinationInfo}
          </ThemedText>
        ) : null}
      </View>

      {/* Stats Row */}
      <View style={{ flexDirection: "row", paddingHorizontal: BrandSpacing.md, gap: 12 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: palette.surfaceAlt,
            padding: 16,
            borderRadius: 24,
            borderCurve: "continuous",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: palette.warning as import("react-native").ColorValue,
              }}
            />
            <ThemedText type="caption" style={{ color: palette.textMuted, fontWeight: "600" }}>
              {t("profile.payments.pending")}
            </ThemedText>
          </View>
          <ThemedText type="title" style={{ fontSize: 22, fontVariant: ["tabular-nums"] }}>
            {formatAgorotCurrency(
              payoutSummary?.pendingAmountAgorot ?? 0,
              locale,
              payoutSummary?.currency ?? "ILS",
            )}
          </ThemedText>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: palette.surfaceAlt,
            padding: 16,
            borderRadius: 24,
            borderCurve: "continuous",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: palette.success as import("react-native").ColorValue,
              }}
            />
            <ThemedText type="caption" style={{ color: palette.textMuted, fontWeight: "600" }}>
              {t("profile.payments.paid")}
            </ThemedText>
          </View>
          <ThemedText type="title" style={{ fontSize: 22, fontVariant: ["tabular-nums"] }}>
            {formatAgorotCurrency(
              payoutSummary?.paidAmountAgorot ?? 0,
              locale,
              payoutSummary?.currency ?? "ILS",
            )}
          </ThemedText>
        </View>
      </View>

      {selectedPaymentId ? (
        <View style={{ paddingHorizontal: BrandSpacing.md, gap: 12, marginTop: 8 }}>
          <View
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <ThemedText type="title">{t("profile.payments.receipt")}</ThemedText>
            <KitPressable
              accessibilityRole="button"
              accessibilityLabel={t("profile.payments.close")}
              onPress={() => setSelectedPaymentId(null)}
              pressedOpacity={0.94}
              style={{
                backgroundColor: palette.surfaceAlt,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
              }}
            >
              <ThemedText type="caption" style={{ color: palette.text, fontWeight: "600" }}>
                {t("profile.payments.close")}
              </ThemedText>
            </KitPressable>
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
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <ThemedText type="caption" style={{ color: palette.textMuted }}>
                    {t("profile.payments.status")}
                  </ThemedText>
                  <ThemedText type="bodyStrong">
                    {getPaymentStatusLabel(selectedPaymentDetail.payment.status)}
                  </ThemedText>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
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
                  <KitPressable
                    accessibilityRole="button"
                    accessibilityLabel={t("profile.payments.downloadInvoice")}
                    onPress={() => {
                      void WebBrowser.openBrowserAsync(
                        selectedPaymentDetail.invoice!.externalInvoiceUrl!,
                      );
                    }}
                    pressedOpacity={0.94}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 8,
                    }}
                    >
                    <ThemedText type="bodyStrong" style={{ color: palette.primary }}>
                      {t("profile.payments.downloadInvoice")}
                    </ThemedText>
                    <IconSymbol name="arrow.up.right" size={16} color={palette.primary} />
                  </KitPressable>
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
    </TabScreenScrollView>
  );
}
