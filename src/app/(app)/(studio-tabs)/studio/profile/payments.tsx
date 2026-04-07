import { useAction, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { LoadingScreen } from "@/components/loading-screen";
import { PaymentActivityList } from "@/components/payments/payment-activity-list";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
import { ThemedText } from "@/components/themed-text";
import { KitList, KitListItem } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
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
import { Box } from "@/primitives";

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

export default function ProfilePaymentsScreen() {
  const { t, i18n } = useTranslation();
  const { color } = useTheme();
  const locale = i18n.resolvedLanguage ?? "en";
  useProfileSubpageSheet({
    title: t("profile.navigation.paymentsPayouts"),
    routeMatchPath: "/profile/payments",
  });

  const currentUser = useQuery(api.users.getCurrentUser);
  const isStudioPaymentsRole = currentUser?.role === "studio";

  const paymentRows = useQuery(
    api.paymentsV2.listMyPaymentsV2,
    isStudioPaymentsRole ? { limit: 40 } : "skip",
  );
  const releaseFundSplit = useAction(api.paymentsV2Actions.releaseAirwallexFundSplitForPaymentOrderV2);
  const [selectedPaymentId, setSelectedPaymentId] = useState<Id<"paymentOrdersV2"> | null>(null);
  const [releaseBusy, setReleaseBusy] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releaseInfo, setReleaseInfo] = useState<string | null>(null);

  const selectedPaymentDetail = useQuery(
    api.paymentsV2.getMyPaymentDetailV2,
    selectedPaymentId ? { paymentOrderId: selectedPaymentId } : "skip",
  );

  useEffect(() => {
    if (!releaseInfo) return;
    const timeout = setTimeout(() => setReleaseInfo(null), 4000);
    return () => clearTimeout(timeout);
  }, [releaseInfo]);

  if (currentUser === undefined || (isStudioPaymentsRole && paymentRows === undefined)) {
    return <LoadingScreen label={t("jobsTab.loading")} />;
  }
  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }
  if (!currentUser.onboardingComplete || currentUser.role === "pending") {
    return <Redirect href="/onboarding" />;
  }
  if (currentUser.role !== "studio") {
    return <Redirect href="/" />;
  }

  type PaymentListRow = NonNullable<typeof paymentRows>[number];
  type PaymentTimelineEvent = NonNullable<typeof selectedPaymentDetail>["timeline"][number];

  const rows = (paymentRows ?? []) as PaymentListRow[];
  const role = currentUser.role as "studio" | "instructor";
  const failedCount = rows.filter((row) => row.payment.status === "failed").length;
  const processedCount = rows.filter((row) =>
    ["captured", "refunded"].includes(row.payment.status),
  ).length;
  const paidOutCount = rows.filter((row) => row.payout?.status === "paid").length;
  const isDetailLoading = selectedPaymentId !== null && selectedPaymentDetail === undefined;

  return (
    <ProfileSubpageScrollView
      routeKey="studio/profile/payments"
      style={{ flex: 1, backgroundColor: color.appBg }}
      contentContainerStyle={{ gap: BrandSpacing.lg }}
      topSpacing={BrandSpacing.md}
      bottomSpacing={BrandSpacing.xxl}
    >
      <Box style={{ paddingHorizontal: BrandSpacing.lg, gap: BrandSpacing.xs }}>
        <ThemedText type="caption" style={{ color: color.textMuted }}>
          {t("profile.payments.summarySubtitle")}
        </ThemedText>
        <ThemedText type="caption" style={{ color: color.textMuted }}>
          {t("profile.payments.liveStatusHint")}
        </ThemedText>
        {releaseError || releaseInfo ? (
          <Box
            style={{
              backgroundColor: releaseError ? color.dangerSubtle : color.surfaceAlt,
              borderRadius: BrandRadius.lg,
              paddingHorizontal: BrandSpacing.component,
              paddingVertical: BrandSpacing.stackDense,
              borderWidth: BorderWidth.thin,
              borderColor: releaseError ? (color.danger as string) : color.border,
            }}
          >
            <ThemedText
              type="caption"
              style={{ color: releaseError ? color.danger : color.textMuted }}
            >
              {releaseError || releaseInfo}
            </ThemedText>
          </Box>
        ) : null}
      </Box>

      <Box style={{ paddingHorizontal: BrandSpacing.sm }}>
        <KitList inset>
          <KitListItem
            title={t("profile.payments.processedPayments")}
            accessory={<ThemedText style={{ color: color.textMuted }}>{processedCount}</ThemedText>}
          />
          <KitListItem
            title={t("profile.payments.paidOut")}
            accessory={<ThemedText style={{ color: color.textMuted }}>{paidOutCount}</ThemedText>}
          />
          <KitListItem
            title={t("profile.payments.failed")}
            accessory={<ThemedText style={{ color: color.danger }}>{failedCount}</ThemedText>}
          />
        </KitList>
      </Box>

      <PaymentActivityList
        viewerRole={role}
        items={rows}
        locale={locale}
        title={t("profile.payments.recentActivity")}
        subtitle={
          role === "studio"
            ? t("profile.payments.studioSubtitle")
            : t("profile.payments.instructorSubtitle")
        }
        emptyLabel={t("profile.payments.empty")}
        onSelectPaymentId={(paymentId) => setSelectedPaymentId(paymentId as Id<"paymentOrdersV2">)}
      />

      {selectedPaymentId ? (
        <Box style={{ gap: BrandSpacing.sm, paddingHorizontal: BrandSpacing.sm }}>
          <Box style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: BrandSpacing.xs }}>
            <ThemedText type="title">{t("profile.payments.detailTitle")}</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("profile.payments.clearDetail")}
              onPress={() => setSelectedPaymentId(null)}
              style={({ pressed }) => ({
                paddingHorizontal: BrandSpacing.md,
                paddingVertical: BrandSpacing.stackMicro,
                borderRadius: BrandRadius.pill,
                borderCurve: "continuous",
                borderWidth: BorderWidth.thin,
                borderColor: pressed ? color.borderStrong : color.border,
                backgroundColor: pressed ? color.surfaceElevated : color.surfaceAlt,
              })}
            >
              <ThemedText type="caption" style={{ color: color.textMuted }}>
                {t("common.clear")}
              </ThemedText>
            </Pressable>
          </Box>
          {isDetailLoading ? (
            <KitList inset>
              <KitListItem>
                <ThemedText style={{ color: color.textMuted }}>
                  {t("profile.payments.loadingDetail")}
                </ThemedText>
              </KitListItem>
            </KitList>
          ) : !selectedPaymentDetail ? (
            <KitList inset>
              <KitListItem>
                <ThemedText style={{ color: color.textMuted }}>
                  {t("profile.payments.detailUnavailable")}
                </ThemedText>
              </KitListItem>
            </KitList>
          ) : (
            <Box style={{ gap: BrandSpacing.sm }}>
              <KitList inset>
                <KitListItem
                  title={t("profile.payments.paymentStatus")}
                  accessory={
                    <ThemedText style={{ color: color.textMuted }}>
                      {getPaymentStatusLabel(selectedPaymentDetail.payment.status)}
                    </ThemedText>
                  }
                />
                <KitListItem
                  title={t("profile.payments.payoutStatus")}
                  accessory={
                    <ThemedText style={{ color: color.textMuted }}>
                      {selectedPaymentDetail.payout
                        ? getPayoutStatusLabel(selectedPaymentDetail.payout.status)
                        : t("profile.payments.notCreated")}
                    </ThemedText>
                  }
                />
                <KitListItem
                  title={t("profile.payments.splitStatus")}
                  accessory={
                    <ThemedText style={{ color: color.textMuted }}>
                      {selectedPaymentDetail.fundSplit
                        ? getPayoutStatusLabel(selectedPaymentDetail.fundSplit.payoutStatus)
                        : t("profile.payments.notCreated")}
                    </ThemedText>
                  }
                />
                {selectedPaymentDetail.fundSplit ? (
                  <KitListItem
                    title={t("profile.payments.releaseMode")}
                    accessory={
                      <ThemedText style={{ color: color.textMuted }}>
                        {getReleaseModeLabel(t, selectedPaymentDetail.fundSplit.releaseMode)}
                      </ThemedText>
                    }
                  />
                ) : null}
                <KitListItem
                  title={t("profile.payments.receiptStatus")}
                  accessory={
                    <ThemedText style={{ color: color.textMuted }}>
                      {selectedPaymentDetail.receipt.status === "ready"
                        ? t("profile.payments.receiptReady")
                        : t("profile.payments.receiptPending")}
                    </ThemedText>
                  }
                />
                <KitListItem
                  title={t("profile.payments.invoiceStatus")}
                  accessory={
                    <ThemedText
                      style={
                        selectedPaymentDetail.invoice?.status === "failed"
                          ? { color: color.danger }
                          : { color: color.textMuted }
                      }
                    >
                      {selectedPaymentDetail.invoice
                        ? selectedPaymentDetail.invoice.status
                        : t("profile.payments.notIssued")}
                    </ThemedText>
                  }
                />
                {selectedPaymentDetail.invoice?.externalInvoiceId ? (
                  <KitListItem
                    title={t("profile.payments.invoiceId")}
                    accessory={
                      <ThemedText style={{ color: color.textMuted }}>
                        {selectedPaymentDetail.invoice.externalInvoiceId}
                      </ThemedText>
                    }
                  />
                ) : null}
                <KitListItem
                  title={
                    role === "studio"
                      ? t("profile.payments.studioCharged")
                      : t("profile.payments.instructorAmount")
                  }
                  accessory={
                    <ThemedText style={{ color: color.textMuted }}>
                      {formatAgorotCurrency(
                        role === "studio"
                          ? selectedPaymentDetail.payment.studioChargeAmountAgorot
                          : selectedPaymentDetail.payment.instructorBaseAmountAgorot,
                        locale,
                        selectedPaymentDetail.payment.currency,
                      )}
                    </ThemedText>
                  }
                />
                <KitListItem
                  title={t("profile.payments.platformMarkup")}
                  accessory={
                    <ThemedText style={{ color: color.textMuted }}>
                      {formatAgorotCurrency(
                        selectedPaymentDetail.payment.platformMarkupAmountAgorot,
                        locale,
                        selectedPaymentDetail.payment.currency,
                      )}
                    </ThemedText>
                  }
                />
                <KitListItem
                  title={t("profile.payments.created")}
                  accessory={
                    <ThemedText style={{ color: color.textMuted }}>
                      {formatDateTime(selectedPaymentDetail.payment.createdAt, locale)}
                    </ThemedText>
                  }
                />
                {selectedPaymentDetail.fundSplit?.releasedAt ? (
                  <KitListItem
                    title={t("profile.payments.releaseInstructorFunds")}
                    accessory={
                      <ThemedText style={{ color: color.textMuted }}>
                        {formatDateTime(selectedPaymentDetail.fundSplit.releasedAt, locale)}
                      </ThemedText>
                    }
                  />
                ) : null}
              </KitList>
              {selectedPaymentDetail.fundSplit?.canRelease ? (
                <Box style={{ paddingHorizontal: BrandSpacing.sm }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("profile.payments.releaseInstructorFunds")}
                    disabled={releaseBusy}
                    onPress={() => {
                      if (!selectedPaymentId) return;
                      setReleaseBusy(true);
                      setReleaseError(null);
                      setReleaseInfo(null);
                      void releaseFundSplit({ paymentOrderId: selectedPaymentId })
                        .then(() => {
                          setReleaseInfo(t("profile.payments.releaseInstructorFundsSuccess"));
                        })
                        .catch((error: unknown) => {
                          setReleaseError(
                            error instanceof Error
                              ? error.message
                              : t("profile.payments.releaseInstructorFundsFailed"),
                          );
                        })
                        .finally(() => {
                          setReleaseBusy(false);
                        });
                    }}
                    style={({ pressed }) => ({
                      minHeight: BrandSpacing.buttonMinHeightXl,
                      borderRadius: BrandRadius.medium,
                      borderCurve: "continuous",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: releaseBusy
                        ? color.surfaceAlt
                        : pressed
                          ? "#D9FF4D"
                          : "#CCFF00",
                    })}
                  >
                    <ThemedText
                      type="labelStrong"
                      style={{ color: releaseBusy ? color.textMuted : "#161E00" }}
                    >
                      {releaseBusy
                        ? t("profile.payments.releasingInstructorFunds")
                        : t("profile.payments.releaseInstructorFunds")}
                    </ThemedText>
                  </Pressable>
                </Box>
              ) : null}
              <KitList inset>
                {selectedPaymentDetail.timeline.length === 0 ? (
                  <KitListItem>
                    <ThemedText style={{ color: color.textMuted }}>
                      {t("profile.payments.noProviderEvents")}
                    </ThemedText>
                  </KitListItem>
                ) : (
                  selectedPaymentDetail.timeline.map((event: PaymentTimelineEvent) => (
                    <KitListItem
                      key={event._id}
                      title={event.title}
                      accessory={
                        <ThemedText style={{ color: color.textMuted }}>
                          {formatDateTime(event.createdAt, locale)}
                        </ThemedText>
                      }
                    >
                      <ThemedText type="caption" style={{ color: color.textMuted }}>
                        {event.description}
                        {event.signatureValid ? "" : " | signature_invalid"}
                        {event.processed ? "" : " | not_processed"}
                      </ThemedText>
                    </KitListItem>
                  ))
                )}
              </KitList>
            </Box>
          )}
        </Box>
      ) : null}

      <Box style={{ paddingHorizontal: BrandSpacing.sm }}>
        <KitList inset>
          <KitListItem>
            <ThemedText type="caption" style={{ color: color.textMuted }}>
              Instructor payout onboarding and bank connection are managed from the instructor app
              profile.
            </ThemedText>
          </KitListItem>
        </KitList>
      </Box>
    </ProfileSubpageScrollView>
  );
}
