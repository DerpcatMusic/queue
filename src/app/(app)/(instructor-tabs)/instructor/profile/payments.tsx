import { useAction, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { type Href, Redirect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform, Pressable } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { TabSceneTransition } from "@/components/layout/tab-scene-transition";
import { PaymentActivityList } from "@/components/payments/payment-activity-list";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitStatusBadge } from "@/components/ui/kit";
import { SkeletonLine } from "@/components/ui/skeleton";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useContentReveal } from "@/hooks/use-content-reveal";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth } from "@/lib/design-system";
import { formatDateTime } from "@/lib/jobs-utils";
import {
  formatAgorotCurrency,
  getPaymentStatusLabel,
  getPayoutStatusLabel,
} from "@/lib/payments-utils";
import { Box, HStack, Spacer, VStack } from "@/primitives";
import { Motion } from "@/theme/theme";

const INSTRUCTOR_COMPLIANCE_ROUTE = "/instructor/profile/compliance" as const;
const AIRWALLEX_ONBOARDING_ROUTE = "/instructor/profile/airwallex-onboarding" as const;

type ConnectedAccountStatus = "pending" | "action_required" | "active" | "restricted" | "rejected" | "disabled";

const STATUS_TONE: Record<ConnectedAccountStatus, "neutral" | "warning" | "success" | "danger"> = {
  pending: "warning",
  action_required: "warning",
  active: "success",
  restricted: "danger",
  rejected: "danger",
  disabled: "danger",
};

function getReleaseModeLabel(
  t: ReturnType<typeof useTranslation>["t"],
  releaseMode: "automatic" | "manual" | "scheduled",
) {
  switch (releaseMode) {
    case "automatic":
      return t("profile.payments.releaseModeAutomatic");
    case "scheduled":
      return t("profile.payments.releaseModeScheduled");
    default:
      return t("profile.payments.releaseModeManual");
  }
}

function SkeletonProfile() {
  const { color } = useTheme();

  return (
    <Animated.View entering={FadeIn.duration(Motion.skeletonFade)}>
      <Box gap="xl" p="lg">
        <Box
          p="xl"
          style={{ backgroundColor: color.surfaceElevated, borderRadius: BrandRadius.cardSubtle }}
        >
          <VStack gap="lg">
            <SkeletonLine width={120} height={14} />
            <SkeletonLine width="72%" height={36} />
            <SkeletonLine width="88%" height={14} />
            <HStack gap="md">
              <SkeletonLine width="48%" height={44} radius={BrandRadius.medium} />
              <SkeletonLine width="48%" height={44} radius={BrandRadius.medium} />
            </HStack>
          </VStack>
        </Box>
        <Box
          p="lg"
          style={{ backgroundColor: color.surfaceElevated, borderRadius: BrandRadius.soft }}
        >
          <SkeletonLine width={120} height={16} />
          <Spacer size="md" />
          <SkeletonLine width="100%" height={56} radius={BrandRadius.soft} />
        </Box>
      </Box>
    </Animated.View>
  );
}

function statusCopy(t: ReturnType<typeof useTranslation>["t"], status?: ConnectedAccountStatus | null) {
  if (!status) {
    return {
      label: t("profile.payments.airwallexNotConnected"),
      caption: t("profile.payments.airwallexDirectSplitNote"),
      tone: "warning" as const,
    };
  }

  switch (status) {
    case "active":
      return {
        label: t("profile.payments.airwallexActive"),
        caption: t("profile.payments.airwallexActiveHint"),
        tone: "success" as const,
      };
    case "action_required":
    case "pending":
      return {
        label: t("profile.payments.airwallexActionRequired"),
        caption: t("profile.payments.airwallexActionRequiredHint"),
        tone: "warning" as const,
      };
    case "restricted":
    case "rejected":
    case "disabled":
      return {
        label: t("profile.payments.airwallexBlocked"),
        caption: t("profile.payments.airwallexBlockedHint"),
        tone: "danger" as const,
      };
  }
}

export default function ProfilePaymentsScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? "en";
  const router = useRouter();
  const theme = useTheme();
  const { color } = theme;

  useProfileSubpageSheet({
    title: t("profile.navigation.wallet"),
    routeMatchPath: "/profile/payments",
  });

  const currentUser = useQuery(api.users.getCurrentUser);
  const isInstructor = currentUser?.role === "instructor";

  const paymentRows = useQuery(
    api.paymentsV2.listMyPaymentsV2,
    isInstructor ? { limit: 20 } : "skip",
  );
  const connectedAccount = useQuery(
    api.paymentsV2.getMyInstructorConnectedAccountV2,
    isInstructor ? {} : "skip",
  );

  const requestAirwallexAccount = useAction(api.paymentsV2Actions.ensureMyInstructorConnectedAccountV2);

  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectInfo, setConnectInfo] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<Id<"paymentOrdersV2"> | null>(null);

  const selectedPaymentDetail = useQuery(
    api.paymentsV2.getMyPaymentDetailV2,
    selectedPaymentId ? { paymentOrderId: selectedPaymentId } : "skip",
  );

  const isDetailLoading = selectedPaymentId !== null && selectedPaymentDetail === undefined;

  const rows = useMemo(() => paymentRows ?? [], [paymentRows]);
  const accountStatus = (connectedAccount?.status ?? null) as ConnectedAccountStatus | null;
  const accountCopy = statusCopy(t, accountStatus);
  const accountTone = accountStatus ? STATUS_TONE[accountStatus] : accountCopy.tone;
  const primaryAccountActionLabel =
    accountStatus === "active"
      ? t("profile.payments.airwallexRefreshAccount")
      : accountStatus
        ? t("profile.payments.airwallexContinueOnboarding")
        : t("profile.payments.airwallexConnectAccount");

  const isLoading =
    currentUser === undefined ||
    (isInstructor && paymentRows === undefined) ||
    (isInstructor && connectedAccount === undefined);

  const { animatedStyle } = useContentReveal(isLoading);

  useEffect(() => {
    if (!connectInfo) return;
    const timeout = setTimeout(() => setConnectInfo(null), Motion.emphasis);
    return () => clearTimeout(timeout);
  }, [connectInfo]);

  const handleConnect = useCallback(async () => {
    setConnectBusy(true);
    setConnectError(null);
    setConnectInfo(null);
    try {
      const result = await requestAirwallexAccount();
      setConnectInfo(
        result.status === "active"
          ? t("profile.payments.airwallexConnected")
          : t("profile.payments.airwallexConnectStarted"),
      );
      if (result.status !== "active") {
        router.push(AIRWALLEX_ONBOARDING_ROUTE as Href);
      }
      if (Platform.OS === "ios") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      setConnectError(
        error instanceof Error ? error.message : t("profile.payments.airwallexConnectFailed"),
      );
    } finally {
      setConnectBusy(false);
    }
  }, [requestAirwallexAccount, t]);

  const confirmConnect = useCallback(() => {
    Alert.alert(
      t("profile.payments.airwallexConnectTitle"),
      t("profile.payments.airwallexConnectBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: accountStatus ? t("profile.payments.airwallexRefreshAccount") : t("profile.payments.airwallexConnectAccount"),
          style: "default",
          onPress: () => {
            void handleConnect();
          },
        },
      ],
    );
  }, [accountStatus, handleConnect, t]);

  if (isLoading) {
    return (
      <TabSceneTransition>
        <Box style={{ flex: 1, backgroundColor: color.appBg }}>
          <SkeletonProfile />
        </Box>
      </TabSceneTransition>
    );
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

  return (
    <TabSceneTransition>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <ProfileSubpageScrollView
          routeKey="instructor/profile/payments"
          style={{ flex: 1, backgroundColor: color.appBg }}
          contentContainerStyle={{ gap: BrandSpacing.xl }}
          topSpacing={BrandSpacing.md}
          bottomSpacing={BrandSpacing.xxl}
        >
          <Box style={{ paddingHorizontal: BrandSpacing.lg, gap: BrandSpacing.sm }}>
            {connectError || connectInfo ? (
              <Box
                style={{
                  backgroundColor: connectError ? color.dangerSubtle : color.surfaceAlt,
                  borderRadius: BrandRadius.lg,
                  paddingHorizontal: BrandSpacing.component,
                  paddingVertical: BrandSpacing.stackDense,
                  borderWidth: BorderWidth.thin,
                  borderColor: connectError ? (color.danger as string) : color.border,
                }}
              >
                <ThemedText
                  type="caption"
                  style={{ color: connectError ? color.danger : color.textMuted }}
                >
                  {connectError || connectInfo}
                </ThemedText>
              </Box>
            ) : null}

            <KitStatusBadge
              label={accountCopy.label}
              tone={accountTone}
              showDot
            />

            <ThemedText type="caption" style={{ color: color.textMuted, lineHeight: 20 }}>
              {t("profile.payments.airwallexDirectSplitNote")}
            </ThemedText>
            <ThemedText type="caption" style={{ color: color.textMuted }}>
              {t("profile.payments.liveStatusHint")}
            </ThemedText>

            <Box
              style={{
                flexDirection: "row",
                gap: BrandSpacing.md,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  primaryAccountActionLabel
                }
                onPress={confirmConnect}
                disabled={connectBusy}
                style={({ pressed }) => ({
                  flex: 1,
                  borderRadius: BrandRadius.medium,
                  borderCurve: "continuous",
                  minHeight: BrandSpacing.buttonMinHeightXl,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: BrandSpacing.sm,
                  backgroundColor: connectBusy
                    ? color.surfaceAlt
                    : pressed
                        ? "#D9FF4D"
                      : "#CCFF00",
                })}
              >
                <IconSymbol
                  name="building.columns.fill"
                  size={BrandSpacing.iconSm}
                  color={connectBusy ? color.textMuted : "#161E00"}
                />
                <ThemedText type="labelStrong" style={{ color: connectBusy ? color.textMuted : "#161E00" }}>
                  {primaryAccountActionLabel}
                </ThemedText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("profile.compliance.openCompliance")}
                onPress={() => router.push(INSTRUCTOR_COMPLIANCE_ROUTE as Href)}
                style={({ pressed }) => ({
                  paddingHorizontal: BrandSpacing.component,
                  minHeight: BrandSpacing.buttonMinHeightXl,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: BrandRadius.medium,
                  borderCurve: "continuous",
                  borderWidth: BorderWidth.thin,
                  borderColor: color.border,
                  backgroundColor: pressed ? color.surfaceElevated : color.surfaceAlt,
                })}
              >
                <ThemedText type="caption" style={{ color: color.text }}>
                  {t("profile.compliance.openCompliance")}
                </ThemedText>
              </Pressable>
            </Box>

            <ThemedText type="caption" style={{ color: color.textMuted }}>
              {accountCopy.caption}
            </ThemedText>
          </Box>

          <Box style={{ paddingHorizontal: BrandSpacing.md }}>
            <PaymentActivityList
              viewerRole="instructor"
              items={rows}
              locale={locale}
              title={t("profile.payments.recentTransactions")}
              emptyLabel={t("profile.payments.noTransactions")}
              onSelectPaymentId={(paymentId) =>
                setSelectedPaymentId(paymentId as Id<"paymentOrdersV2">)
              }
            />
          </Box>

          {selectedPaymentId ? (
            <Box
              style={{
                paddingHorizontal: BrandSpacing.md,
                gap: BrandSpacing.md,
                marginTop: BrandSpacing.sm,
              }}
            >
              <Box
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
              </Box>
              {isDetailLoading ? (
                <Box
                  style={{
                    backgroundColor: color.surfaceAlt,
                    padding: BrandSpacing.xl,
                    borderRadius: BrandRadius.soft,
                    alignItems: "center",
                  }}
                >
                  <ThemedText style={{ color: color.textMuted }}>
                    {t("profile.payments.loadingReceipt")}
                  </ThemedText>
                </Box>
              ) : !selectedPaymentDetail ? (
                <Box
                  style={{
                    backgroundColor: color.surfaceAlt,
                    padding: BrandSpacing.xl,
                    borderRadius: BrandRadius.soft,
                    alignItems: "center",
                  }}
                >
                  <ThemedText style={{ color: color.textMuted }}>
                    {t("profile.payments.paymentNotFound")}
                  </ThemedText>
                </Box>
              ) : (
                <Box
                  style={{
                    backgroundColor: color.surfaceAlt,
                    borderRadius: BrandRadius.soft,
                    borderCurve: "continuous",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    style={{
                      padding: BrandSpacing.insetComfort,
                      borderBottomWidth: BorderWidth.thin,
                      borderBottomColor: color.border,
                      borderStyle: "dashed",
                      alignItems: "center",
                      gap: BrandSpacing.sm,
                    }}
                  >
                    <Box
                      style={{
                        width: BrandSpacing.avatarMd,
                        height: BrandSpacing.avatarMd,
                        borderRadius: BrandRadius.soft,
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
                    </Box>
                    <ThemedText
                      type="title"
                      style={{
                        fontVariant: ["tabular-nums"],
                        ...BrandType.titleLarge,
                      }}
                    >
                      {formatAgorotCurrency(
                        selectedPaymentDetail.payment.instructorBaseAmountAgorot,
                        locale,
                        selectedPaymentDetail.payment.currency,
                      )}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: color.textMuted }}>
                      {formatDateTime(selectedPaymentDetail.payment.createdAt, locale)}
                    </ThemedText>
                  </Box>
                  <Box
                    style={{
                      padding: BrandSpacing.insetComfort,
                      gap: BrandSpacing.inset,
                    }}
                  >
                    <Box
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
                    </Box>
                    <Box
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
                    </Box>
                    <Box
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <ThemedText type="caption" style={{ color: color.textMuted }}>
                        {t("profile.payments.splitStatus")}
                      </ThemedText>
                      <ThemedText type="bodyStrong">
                        {selectedPaymentDetail.fundSplit
                          ? getPayoutStatusLabel(selectedPaymentDetail.fundSplit.payoutStatus)
                          : t("profile.payments.notCreated")}
                      </ThemedText>
                    </Box>
                    {selectedPaymentDetail.fundSplit ? (
                      <Box
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        <ThemedText type="caption" style={{ color: color.textMuted }}>
                          {t("profile.payments.releaseMode")}
                        </ThemedText>
                        <ThemedText type="bodyStrong">
                          {getReleaseModeLabel(t, selectedPaymentDetail.fundSplit.releaseMode)}
                        </ThemedText>
                      </Box>
                    ) : null}
                    <Box
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <ThemedText type="caption" style={{ color: color.textMuted }}>
                        {t("profile.payments.receiptStatus")}
                      </ThemedText>
                      <ThemedText type="bodyStrong">
                        {selectedPaymentDetail.receipt.status === "ready"
                          ? t("profile.payments.receiptReady")
                          : t("profile.payments.receiptPending")}
                      </ThemedText>
                    </Box>
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
                          backgroundColor: pressed ? color.surfaceAlt : color.surfaceElevated,
                        })}
                      >
                        <ThemedText type="bodyStrong" style={{ color: "#CCFF00" }}>
                          {t("profile.payments.downloadInvoice")}
                        </ThemedText>
                        <IconSymbol
                          name="arrow.up.right"
                          size={BrandSpacing.iconSm}
                          color="#CCFF00"
                        />
                      </Pressable>
                    ) : null}
                  </Box>
                </Box>
              )}
            </Box>
          ) : null}
        </ProfileSubpageScrollView>
      </Animated.View>
    </TabSceneTransition>
  );
}
