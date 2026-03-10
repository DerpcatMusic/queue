import { useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import { PaymentActivityList } from "@/components/payments/payment-activity-list";
import { ThemedText } from "@/components/themed-text";
import { KitList, KitListItem, KitPressable } from "@/components/ui/kit";
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

export default function ProfilePaymentsScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const locale = i18n.resolvedLanguage ?? "en";

  const currentUser = useQuery(api.users.getCurrentUser);
  const isStudioPaymentsRole = currentUser?.role === "studio";

  const paymentRows = useQuery(
    api.payments.listMyPayments,
    isStudioPaymentsRole ? { limit: 40 } : "skip",
  );
  const [selectedPaymentId, setSelectedPaymentId] = useState<Id<"payments"> | null>(null);

  const selectedPaymentDetail = useQuery(
    api.payments.getMyPaymentDetail,
    selectedPaymentId ? { paymentId: selectedPaymentId } : "skip",
  );

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
    <TabScreenScrollView
      style={{ flex: 1, backgroundColor: palette.appBg }}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 28, gap: 16 }}
    >
      <View style={{ paddingHorizontal: BrandSpacing.lg, gap: 4 }}>
        <ThemedText type="caption" style={{ color: palette.textMuted }}>
          Track amounts, payment processing, and payout delivery status.
        </ThemedText>
      </View>

      <View style={{ paddingHorizontal: BrandSpacing.sm }}>
        <KitList inset>
          <KitListItem
            title="Processed payments"
            accessory={
              <ThemedText style={{ color: palette.textMuted }}>{processedCount}</ThemedText>
            }
          />
          <KitListItem
            title="Paid out"
            accessory={<ThemedText style={{ color: palette.textMuted }}>{paidOutCount}</ThemedText>}
          />
          <KitListItem
            title="Failed"
            accessory={<ThemedText style={{ color: palette.danger }}>{failedCount}</ThemedText>}
          />
        </KitList>
      </View>

      <PaymentActivityList
        viewerRole={role}
        items={rows}
        locale={locale}
        palette={palette}
        title="Recent activity"
        subtitle={
          role === "studio"
            ? "What studios were charged and what instructors should receive."
            : "What you should receive and payout progress."
        }
        emptyLabel="No payments yet."
        onSelectPaymentId={setSelectedPaymentId}
      />

      {selectedPaymentId ? (
        <View style={{ gap: 8, paddingHorizontal: BrandSpacing.sm }}>
          <View
            style={{
              paddingHorizontal: BrandSpacing.xs,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <ThemedText type="title">Payment detail</ThemedText>
            <KitPressable
              accessibilityRole="button"
              accessibilityLabel="Clear payment detail"
              onPress={() => setSelectedPaymentId(null)}
            >
              <ThemedText type="caption" style={{ color: palette.textMuted }}>
                Clear
              </ThemedText>
            </KitPressable>
          </View>
          {isDetailLoading ? (
            <KitList inset>
              <KitListItem>
                <ThemedText style={{ color: palette.textMuted }}>
                  Loading payment detail...
                </ThemedText>
              </KitListItem>
            </KitList>
          ) : !selectedPaymentDetail ? (
            <KitList inset>
              <KitListItem>
                <ThemedText style={{ color: palette.textMuted }}>
                  Payment not found or no longer accessible.
                </ThemedText>
              </KitListItem>
            </KitList>
          ) : (
            <View style={{ gap: 8 }}>
              <KitList inset>
                <KitListItem
                  title="Payment status"
                  accessory={
                    <ThemedText style={{ color: palette.textMuted }}>
                      {getPaymentStatusLabel(selectedPaymentDetail.payment.status)}
                    </ThemedText>
                  }
                />
                <KitListItem
                  title="Payout status"
                  accessory={
                    <ThemedText style={{ color: palette.textMuted }}>
                      {selectedPaymentDetail.payout
                        ? getPayoutStatusLabel(selectedPaymentDetail.payout.status)
                        : "Not created"}
                    </ThemedText>
                  }
                />
                <KitListItem
                  title="Invoice status"
                  accessory={
                    <ThemedText
                      style={{
                        color:
                          selectedPaymentDetail.invoice?.status === "failed"
                            ? palette.danger
                            : palette.textMuted,
                      }}
                    >
                      {selectedPaymentDetail.invoice
                        ? selectedPaymentDetail.invoice.status
                        : "Not issued"}
                    </ThemedText>
                  }
                />
                {selectedPaymentDetail.invoice?.externalInvoiceId ? (
                  <KitListItem
                    title="Invoice ID"
                    accessory={
                      <ThemedText style={{ color: palette.textMuted }}>
                        {selectedPaymentDetail.invoice.externalInvoiceId}
                      </ThemedText>
                    }
                  />
                ) : null}
                <KitListItem
                  title={role === "studio" ? "Studio charged" : "Instructor amount"}
                  accessory={
                    <ThemedText style={{ color: palette.textMuted }}>
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
                  title="Platform markup"
                  accessory={
                    <ThemedText style={{ color: palette.textMuted }}>
                      {formatAgorotCurrency(
                        selectedPaymentDetail.payment.platformMarkupAmountAgorot,
                        locale,
                        selectedPaymentDetail.payment.currency,
                      )}
                    </ThemedText>
                  }
                />
                <KitListItem
                  title="Created"
                  accessory={
                    <ThemedText style={{ color: palette.textMuted }}>
                      {formatDateTime(selectedPaymentDetail.payment.createdAt, locale)}
                    </ThemedText>
                  }
                />
              </KitList>
              <KitList inset>
                {selectedPaymentDetail.timeline.length === 0 ? (
                  <KitListItem>
                    <ThemedText style={{ color: palette.textMuted }}>
                      No provider events recorded yet.
                    </ThemedText>
                  </KitListItem>
                ) : (
                  selectedPaymentDetail.timeline.map((event: PaymentTimelineEvent) => (
                    <KitListItem
                      key={event._id}
                      title={event.title}
                      accessory={
                        <ThemedText style={{ color: palette.textMuted }}>
                          {formatDateTime(event.createdAt, locale)}
                        </ThemedText>
                      }
                    >
                      <ThemedText type="caption" style={{ color: palette.textMuted }}>
                        {event.description}
                        {event.signatureValid ? "" : " | signature_invalid"}
                        {event.processed ? "" : " | not_processed"}
                      </ThemedText>
                    </KitListItem>
                  ))
                )}
              </KitList>
            </View>
          )}
        </View>
      ) : null}

      <View style={{ paddingHorizontal: BrandSpacing.sm }}>
        <KitList inset>
          <KitListItem>
            <ThemedText type="caption" style={{ color: palette.textMuted }}>
              Instructor payout onboarding and bank connection are managed from the instructor app
              profile.
            </ThemedText>
          </KitListItem>
        </KitList>
      </View>
    </TabScreenScrollView>
  );
}
