import { useAction, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { type Href, Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { TabSceneTransition } from "@/components/layout/tab-scene-transition";
import { PaymentActivityList } from "@/components/payments/payment-activity-list";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
import { StripeConnectEmbeddedModal } from "@/components/sheets/profile/instructor/stripe-connect-embedded";
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

type ConnectedAccountStatus =
  | "pending"
  | "action_required"
  | "active"
  | "restricted"
  | "rejected"
  | "disabled";

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

function statusCopy(
  t: ReturnType<typeof useTranslation>["t"],
  status?: ConnectedAccountStatus | null,
  requirementsSummary?: string | null,
) {
  if (!status) {
    return {
      label: t("profile.payments.statusBankNeeded"),
      caption: t("profile.payments.connectBank"),
      tone: "warning" as const,
    };
  }

  switch (status) {
    case "active":
      return {
        label: t("profile.payments.statusAllSet"),
        caption: t("profile.payments.successBody"),
        tone: "success" as const,
      };
    case "action_required":
    case "pending":
      return {
        label: t("profile.payments.finalizingTitle"),
        caption: requirementsSummary?.trim() || t("profile.payments.finalizingBody"),
        tone: "warning" as const,
      };
    case "restricted":
    case "rejected":
    case "disabled":
      return {
        label: t("profile.payments.onboardingFailed"),
        caption: t("profile.payments.connectBank"),
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

  const refreshStripeAccount = useAction(
    api.paymentsV2Actions.refreshMyInstructorStripeConnectedAccountV2,
  );
  const createStripeEmbeddedSession = useAction(
    api.paymentsV2Actions.createMyInstructorStripeEmbeddedSessionV2,
  );
  const createStripeHostedAccountLink = useAction(
    api.paymentsV2Actions.createMyInstructorStripeAccountLinkV2,
  );

  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectInfo, setConnectInfo] = useState<string | null>(null);
  const [stripeConnectVisible, setStripeConnectVisible] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<Id<"paymentOrdersV2"> | null>(null);

  const selectedPaymentDetail = useQuery(
    api.paymentsV2.getMyPaymentDetailV2,
    selectedPaymentId ? { paymentOrderId: selectedPaymentId } : "skip",
  );

  const isDetailLoading = selectedPaymentId !== null && selectedPaymentDetail === undefined;

  const rows = useMemo(() => paymentRows ?? [], [paymentRows]);
  const accountStatus = (connectedAccount?.status ?? null) as ConnectedAccountStatus | null;
  const accountCopy = statusCopy(t, accountStatus, connectedAccount?.requirementsSummary ?? null);
  const accountTone = accountStatus ? STATUS_TONE[accountStatus] : accountCopy.tone;
  const primaryAccountActionLabel =
    accountStatus === "active"
      ? t("profile.payments.managePayouts")
      : accountStatus
        ? t("profile.payments.resumeOnboarding")
        : t("profile.payments.startOnboarding");

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

  const openConnectFlow = useCallback(() => {
    setConnectBusy(true);
    setConnectError(null);
    setConnectInfo(null);
    setStripeConnectVisible(true);
  }, []);

  const handleConnectFeedback = useCallback(
    (feedback: { tone: "success" | "error"; message: string } | null) => {
      if (!feedback) {
        setConnectError(null);
        setConnectInfo(null);
        return;
      }
      if (feedback.tone === "error") {
        setConnectError(feedback.message);
        setConnectInfo(null);
        return;
      }
      setConnectInfo(feedback.message);
      setConnectError(null);
    },
    [],
  );

  const handleConnectCompleted = useCallback(async () => {
    const refreshed = await refreshStripeAccount();
    setConnectInfo(
      refreshed.status === "active"
        ? t("profile.payments.connectSuccess")
        : t("profile.payments.finalizingBody"),
    );
    if (Platform.OS === "ios") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setConnectBusy(false);
    setStripeConnectVisible(false);
  }, [refreshStripeAccount, t]);

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
                  backgroundColor: connectError ? color.dangerSubtle : color.surfaceMuted,
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

            <KitStatusBadge label={accountCopy.label} tone={accountTone} showDot />

            <ThemedText type="caption" style={{ color: color.textMuted, lineHeight: 20 }}>
              {t("profile.payments.stripeDirectSplitNote")}
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
                accessibilityLabel={primaryAccountActionLabel}
                onPress={openConnectFlow}
                disabled={connectBusy || stripeConnectVisible}
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
                    ? color.surfaceMuted
                    : pressed
                      ? color.primaryPressed
                      : color.primary,
                })}
              >
                <IconSymbol
                  name="building.columns.fill"
                  size={BrandSpacing.iconSm}
                  color={connectBusy ? color.textMuted : color.onPrimary}
                />
                <ThemedText
                  type="labelStrong"
                  style={{ color: connectBusy ? color.textMuted : color.onPrimary }}
                >
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
                  backgroundColor: pressed ? color.surfaceElevated : color.surfaceMuted,
                })}
              >
                <ThemedText type="caption" style={{ color: color.text }}>
                  {t("profile.compliance.openCompliance")}
                </ThemedText>
              </Pressable>
            </Box>

            <StripeConnectEmbeddedModal
              visible={stripeConnectVisible}
              accountStatus={accountStatus}
              createEmbeddedSession={async () => createStripeEmbeddedSession({})}
              createHostedAccountLink={async () => createStripeHostedAccountLink({})}
              onClose={() => {
                setConnectBusy(false);
                setStripeConnectVisible(false);
              }}
              onCompleted={handleConnectCompleted}
              onFeedback={handleConnectFeedback}
            />

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
                    backgroundColor: pressed ? color.surfaceElevated : color.surfaceMuted,
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
                    backgroundColor: color.surfaceMuted,
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
                    backgroundColor: color.surfaceMuted,
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
                    backgroundColor: color.surfaceMuted,
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
                          backgroundColor: pressed ? color.surfaceMuted : color.surfaceElevated,
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
