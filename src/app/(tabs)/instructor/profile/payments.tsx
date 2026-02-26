import { useAction, useMutation, useQuery } from "convex/react";
import { Redirect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import { PaymentActivityList } from "@/components/payments/payment-activity-list";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandSpacing } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useBrand } from "@/hooks/use-brand";
import { formatDateTime } from "@/lib/jobs-utils";
import {
  formatAgorotCurrency,
  getPaymentStatusLabel,
  getPayoutStatusLabel,
} from "@/lib/payments-utils";

WebBrowser.maybeCompleteAuthSession();

const DEFAULT_RAPYD_APP_RETURN_URL = "queue://rapyd/beneficiary-return";
const DEFAULT_CONVEX_SITE_URL = "https://curious-stingray-854.convex.site";

const ensureAbsoluteUrl = (value: string, fallback: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  try {
    return new URL(trimmed).toString();
  } catch {
    return fallback;
  }
};

const resolveConvexSiteUrl = (): string => {
  const explicit = process.env.EXPO_PUBLIC_CONVEX_SITE_URL?.trim();
  if (explicit) {
    return ensureAbsoluteUrl(explicit, DEFAULT_CONVEX_SITE_URL);
  }
  const cloud = process.env.EXPO_PUBLIC_CONVEX_URL?.trim() ?? "";
  try {
    const parsed = new URL(cloud);
    if (parsed.hostname.endsWith(".convex.cloud")) {
      parsed.hostname = parsed.hostname.replace(".convex.cloud", ".convex.site");
    }
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return DEFAULT_CONVEX_SITE_URL;
  }
};

export default function ProfilePaymentsScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const locale = i18n.resolvedLanguage ?? "en";
  const router = useRouter();

  const currentUser = useQuery(api.users.getCurrentUser);
  const isInstructorPaymentsRole = currentUser?.role === "instructor";

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
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawInfo, setWithdrawInfo] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<Id<"payments"> | null>(null);

  const selectedPaymentDetail = useQuery(
    api.payments.getMyPaymentDetail,
    selectedPaymentId ? { paymentId: selectedPaymentId } : "skip",
  );

  if (
    currentUser === undefined ||
    (isInstructorPaymentsRole && paymentRows === undefined) ||
    (currentUser?.role === "instructor" && payoutSummary === undefined)
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
    return <Redirect href="/(tabs)/studio/profile/payments" />;
  }

  const rows = paymentRows ?? [];
  const role = currentUser.role as "studio" | "instructor";
  const isDetailLoading = selectedPaymentId !== null && selectedPaymentDetail === undefined;
  const isManualPayoutMode = payoutSummary?.payoutReleaseMode !== "automatic";
  const isIdentityVerified = payoutSummary?.isIdentityVerified ?? false;
  const appReturnUrl = ensureAbsoluteUrl(
    process.env.EXPO_PUBLIC_RAPYD_APP_RETURN_URL ?? "",
    DEFAULT_RAPYD_APP_RETURN_URL,
  );
  const convexSiteUrl = resolveConvexSiteUrl();
  const buildBridgeUrl = (result: "complete" | "cancel"): string => {
    const bridge = new URL("/rapyd/beneficiary-return-bridge", convexSiteUrl);
    bridge.searchParams.set("result", result);
    bridge.searchParams.set("target", appReturnUrl);
    return bridge.toString();
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
        setWithdrawInfo("No available balance to withdraw right now.");
      } else {
        setWithdrawInfo(
          `Withdrawal started for ${result.scheduledCount} payment${
            result.scheduledCount === 1 ? "" : "s"
          }.`,
        );
      }
    } catch (error) {
      setWithdrawError(error instanceof Error ? error.message : "Failed to start withdrawal.");
    } finally {
      setWithdrawBusy(false);
    }
  };

  const startHostedBankOnboarding = async () => {
    setOnboardingBusy(true);
    setDestinationError(null);
    setDestinationInfo(null);
    try {
      const session = await createBeneficiaryOnboardingForInstructor({
        beneficiaryCountry: "IL",
        beneficiaryEntityType: "individual",
        category: "bank",
        payoutCurrency: "ILS",
        completeUrl: beneficiaryCompleteUrl,
        cancelUrl: beneficiaryCancelUrl,
      });
      const authResult = await WebBrowser.openAuthSessionAsync(session.redirectUrl, appReturnUrl);
      if (authResult.type === "success") {
        const resultUrl = authResult.url ? new URL(authResult.url) : null;
        const result = resultUrl?.searchParams.get("result") ?? "complete";
        if (result === "cancel") {
          setDestinationInfo("Bank onboarding cancelled.");
        } else {
          setDestinationInfo(
            "Bank onboarding returned successfully. Waiting for provider confirmation.",
          );
        }
      } else if (authResult.type === "dismiss" || authResult.type === "cancel") {
        setDestinationInfo("Bank onboarding closed before completion.");
      } else {
        setDestinationInfo("Bank onboarding opened. Complete it, then return.");
      }
    } catch (error) {
      setDestinationError(
        error instanceof Error ? error.message : "Failed to open secure bank onboarding.",
      );
    } finally {
      setOnboardingBusy(false);
    }
  };

  return (
    <TabScreenScrollView
      routeKey="instructor/profile"
      style={{ flex: 1, backgroundColor: palette.appBg }}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 40, gap: 24 }}
    >
      <View
        style={{ paddingHorizontal: BrandSpacing.lg, flexDirection: "row", alignItems: "center" }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ padding: 8, marginLeft: -8, marginRight: 8 }}
        >
          <IconSymbol name="chevron.left" size={24} color={palette.text} />
        </Pressable>
        <ThemedText type="heading" style={{ flex: 1, fontSize: 24 }}>
          Wallet
        </ThemedText>
      </View>
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
            {payoutSummary?.hasVerifiedDestination ? "Bank connected" : "Bank not connected"}
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
            {isIdentityVerified ? "KYC verified" : "KYC required"}
          </ThemedText>
        </View>
        {!isIdentityVerified ? (
          <ThemedText type="caption" style={{ color: palette.textMuted, marginTop: 6 }}>
            Complete identity verification in Profile before connecting bank or withdrawing funds.
          </ThemedText>
        ) : null}
        {!payoutSummary?.hasVerifiedDestination && payoutSummary?.onboardingStatus === "pending" ? (
          <ThemedText type="caption" style={{ color: palette.textMuted, marginTop: 6 }}>
            Onboarding submitted. Complete hosted flow and wait for provider confirmation.
          </ThemedText>
        ) : null}
        {!payoutSummary?.hasVerifiedDestination && payoutSummary?.onboardingStatus === "failed" ? (
          <ThemedText type="caption" style={{ color: palette.danger, marginTop: 6 }}>
            {payoutSummary?.onboardingLastError ?? "Bank onboarding failed. Try again."}
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
            shadowColor: palette.primary,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.3,
            shadowRadius: 24,
            elevation: 12,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <View>
              <ThemedText
                type="caption"
                style={{
                  color: "rgba(255,255,255,0.8)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  fontWeight: "600",
                }}
              >
                Available
              </ThemedText>
              <ThemedText
                style={{
                  color: "#FFF",
                  fontSize: 44,
                  fontWeight: "800",
                  fontVariant: ["tabular-nums"],
                  marginTop: 4,
                  letterSpacing: -1,
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
                padding: 14,
                alignItems: "center",
                borderCurve: "continuous",
                opacity: withdrawBusy ? 0.5 : 1,
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
              }}
              onPress={withdrawToBank}
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
                Withdraw
              </ThemedText>
            </Pressable>

            <Pressable
              style={{
                flex: 1,
                backgroundColor: payoutSummary?.hasVerifiedDestination
                  ? "rgba(255,255,255,0.1)"
                  : "#000",
                borderRadius: 20,
                padding: 14,
                alignItems: "center",
                borderCurve: "continuous",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
              }}
              onPress={startHostedBankOnboarding}
              disabled={onboardingBusy || !isIdentityVerified}
            >
              <IconSymbol name="building.columns.fill" size={18} color="#FFF" />
              <ThemedText type="bodyStrong" style={{ color: "#FFF", fontSize: 16 }}>
                {payoutSummary?.hasVerifiedDestination ? "Manage bank" : "Connect bank"}
              </ThemedText>
            </Pressable>
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
              Pending
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
              Paid
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
            <ThemedText type="title">Receipt</ThemedText>
            <Pressable
              onPress={() => setSelectedPaymentId(null)}
              style={{
                backgroundColor: palette.surfaceAlt,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
              }}
            >
              <ThemedText type="caption" style={{ color: palette.text, fontWeight: "600" }}>
                Close
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
              <ThemedText style={{ color: palette.textMuted }}>Loading receipt...</ThemedText>
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
              <ThemedText style={{ color: palette.textMuted }}>Payment not found.</ThemedText>
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
                    Status
                  </ThemedText>
                  <ThemedText type="bodyStrong">
                    {getPaymentStatusLabel(selectedPaymentDetail.payment.status)}
                  </ThemedText>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <ThemedText type="caption" style={{ color: palette.textMuted }}>
                    Payout
                  </ThemedText>
                  <ThemedText type="bodyStrong">
                    {selectedPaymentDetail.payout
                      ? getPayoutStatusLabel(selectedPaymentDetail.payout.status)
                      : "Pending"}
                  </ThemedText>
                </View>
                {selectedPaymentDetail.invoice?.externalInvoiceUrl ? (
                  <Pressable
                    onPress={() =>
                      WebBrowser.openBrowserAsync(
                        selectedPaymentDetail.invoice!.externalInvoiceUrl!,
                      )
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 8,
                    }}
                  >
                    <ThemedText type="bodyStrong" style={{ color: palette.primary }}>
                      Download Invoice
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
          title="Recent Transactions"
          emptyLabel="No transactions yet."
          onSelectPaymentId={setSelectedPaymentId}
        />
      </View>
    </TabScreenScrollView>
  );
}
