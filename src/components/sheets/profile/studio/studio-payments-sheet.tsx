/**
 * Studio Payments Sheet - displays studio payment history and details.
 */

import { useQuery } from "convex/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { LoadingScreen } from "@/components/loading-screen";
import { PaymentActivityList } from "@/components/payments/payment-activity-list";
import { ThemedText } from "@/components/themed-text";
import { KitList, KitListItem } from "@/components/ui/kit";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
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

interface StudioPaymentsSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function StudioPaymentsSheet({ visible, onClose }: StudioPaymentsSheetProps) {
  const { t, i18n } = useTranslation();
  const { color } = useTheme();
  const locale = i18n.resolvedLanguage ?? "en";

  const currentUser = useQuery(api.users.getCurrentUser);
  const isStudioPaymentsRole = currentUser?.role === "studio";

  const paymentRows = useQuery(
    api.paymentsV2.listMyPaymentsV2,
    isStudioPaymentsRole ? { limit: 40 } : "skip",
  );
  const [selectedPaymentId, setSelectedPaymentId] = useState<Id<"paymentOrdersV2"> | null>(null);

  const selectedPaymentDetail = useQuery(
    api.paymentsV2.getMyPaymentDetailV2,
    selectedPaymentId ? { paymentOrderId: selectedPaymentId } : "skip",
  );

  // Loading or not logged in — show skeleton
  if (!currentUser || (isStudioPaymentsRole && paymentRows === undefined)) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <LoadingScreen label={t("jobsTab.loading")} />
      </BaseProfileSheet>
    );
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
    <BaseProfileSheet visible={visible} onClose={onClose}>
      <ScrollView
        style={[styles.container, { backgroundColor: color.appBg }]}
        contentContainerStyle={styles.contentContainer}
      >
        <Box style={{ paddingHorizontal: BrandSpacing.lg, gap: BrandSpacing.xs }}>
          <ThemedText type="caption" style={{ color: color.textMuted }}>
            {t("profile.payments.summarySubtitle")}
          </ThemedText>
          <ThemedText type="caption" style={{ color: color.textMuted }}>
            {t("profile.payments.liveStatusHint")}
          </ThemedText>
        </Box>

        <Box style={{ paddingHorizontal: BrandSpacing.sm }}>
          <KitList inset>
            <KitListItem
              title={t("profile.payments.processedPayments")}
              accessory={
                <ThemedText style={{ color: color.textMuted }}>{processedCount}</ThemedText>
              }
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
          onSelectPaymentId={(paymentId) =>
            setSelectedPaymentId(paymentId as Id<"paymentOrdersV2">)
          }
        />

        {selectedPaymentId ? (
          <Box style={{ gap: BrandSpacing.sm, paddingHorizontal: BrandSpacing.sm }}>
            <Box
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: BrandSpacing.xs,
              }}
            >
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
                </KitList>
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
      </ScrollView>
    </BaseProfileSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    gap: BrandSpacing.lg,
    paddingTop: BrandSpacing.md,
    paddingBottom: BrandSpacing.xxl,
  },
});
