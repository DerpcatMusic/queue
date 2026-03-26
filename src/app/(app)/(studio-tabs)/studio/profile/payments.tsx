import { useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
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
    <ProfileSubpageScrollView
      routeKey="studio/profile/payments"
      style={{ flex: 1, backgroundColor: color.appBg }}
      contentContainerStyle={{ gap: BrandSpacing.lg }}
      topSpacing={BrandSpacing.md}
      bottomSpacing={BrandSpacing.xxl}
    >
      <View style={{ paddingHorizontal: BrandSpacing.lg, gap: BrandSpacing.xs }}>
        <ThemedText type="caption" style={{ color: color.textMuted }}>
          {t("profile.payments.summarySubtitle")}
        </ThemedText>
      </View>

      <View style={{ paddingHorizontal: BrandSpacing.sm }}>
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
      </View>

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
        onSelectPaymentId={setSelectedPaymentId}
      />

      {selectedPaymentId ? (
        <View style={{ gap: BrandSpacing.sm, paddingHorizontal: BrandSpacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: BrandSpacing.xs }}>
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
          </View>
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
            <View style={{ gap: BrandSpacing.sm }}>
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
            </View>
          )}
        </View>
      ) : null}

      <View style={{ paddingHorizontal: BrandSpacing.sm }}>
        <KitList inset>
          <KitListItem>
            <ThemedText type="caption" style={{ color: color.textMuted }}>
              Instructor payout onboarding and bank connection are managed from the instructor app
              profile.
            </ThemedText>
          </KitListItem>
        </KitList>
      </View>
    </ProfileSubpageScrollView>
  );
}
