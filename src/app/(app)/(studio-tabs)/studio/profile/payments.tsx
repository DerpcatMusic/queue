import { useAction, useQuery } from "convex/react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable } from "react-native";
import { LoadingScreen } from "@/components/loading-screen";
import { PaymentActivityList } from "@/components/payments/payment-activity-list";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
import { StripeCustomerSheet } from "@/components/sheets/profile/studio/stripe-customer-sheet";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { KitList, KitListItem } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getPaymentMethodOrder } from "@/features/payments/lib/get-payment-method-order";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth } from "@/lib/design-system";
import { formatDateTime } from "@/lib/jobs-utils";
import {
  formatAgorotCurrency,
  getPaymentStatusLabel,
  getPayoutStatusLabel,
} from "@/lib/payments-utils";
import { getStripeMarketDefaults } from "@/lib/stripe";
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
  const params = useLocalSearchParams<{ setup?: string }>();
  useProfileSubpageSheet({
    title: t("profile.navigation.studioChargeActivity"),
    routeMatchPath: "/profile/payments",
  });

  const currentUser = useQuery(api.users.getCurrent.getCurrentUser);
  const isStudioPaymentsRole = currentUser?.role === "studio";
  const createCustomerSheetSession = useAction(
    api.payments.actions.createMyStudioStripeCustomerSheetSessionV2,
  );

  const paymentRows = useQuery(
    api.payments.core.listMyPaymentsV2,
    isStudioPaymentsRole ? { limit: 40 } : "skip",
  );
  const [selectedPaymentId, setSelectedPaymentId] = useState<Id<"paymentOrdersV2"> | null>(null);
  const [customerSheetVisible, setCustomerSheetVisible] = useState(false);
  const customerSheetSessionPromiseRef = useRef<Promise<{
    customerId: string;
    customerSessionClientSecret: string;
    setupIntentClientSecret: string;
  }> | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(
    null,
  );

  const selectedPaymentDetail = useQuery(
    api.payments.core.getMyPaymentDetailV2,
    selectedPaymentId ? { paymentOrderId: selectedPaymentId } : "skip",
  );
  const canOpenCustomerSheet = currentUser?.role === "studio" && Platform.OS !== "web";
  const paymentMethodTypes = getPaymentMethodOrder(getStripeMarketDefaults().currency);

  useEffect(() => {
    if (params.setup === "1" && canOpenCustomerSheet) {
      customerSheetSessionPromiseRef.current = null;
      setCustomerSheetVisible(true);
    }
  }, [canOpenCustomerSheet, params.setup]);

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
      {feedback ? (
        <Box
          style={{
            marginHorizontal: BrandSpacing.lg,
            padding: BrandSpacing.component,
            borderRadius: BrandRadius.lg,
            borderWidth: BorderWidth.thin,
            borderColor: color.border,
            backgroundColor: feedback.tone === "error" ? color.dangerSubtle : color.surfaceMuted,
          }}
        >
          <ThemedText type="caption" style={{ color: color.textMuted }}>
            {feedback.message}
          </ThemedText>
        </Box>
      ) : null}

      <Box style={{ paddingHorizontal: BrandSpacing.lg, gap: BrandSpacing.xs }}>
        <ThemedText type="caption" style={{ color: color.textMuted }}>
          {t("profile.payments.summarySubtitle")}
        </ThemedText>
        <ThemedText type="caption" style={{ color: color.textMuted }}>
          {t("profile.payments.liveStatusHint")}
        </ThemedText>
      </Box>

      {canOpenCustomerSheet ? (
        <Box style={{ paddingHorizontal: BrandSpacing.lg }}>
          <ActionButton
            label={t("profile.payments.savedMethods")}
            fullWidth
            onPress={() => {
              customerSheetSessionPromiseRef.current = null;
              setFeedback(null);
              setCustomerSheetVisible(true);
            }}
          />
        </Box>
      ) : null}

      <Box style={{ paddingHorizontal: BrandSpacing.sm }}>
        <KitList inset>
          {canOpenCustomerSheet ? (
            <KitListItem
              title={t("profile.payments.savedMethods")}
              accessory={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("profile.payments.savedMethods")}
                  onPress={() => {
                    customerSheetSessionPromiseRef.current = null;
                    setFeedback(null);
                    setCustomerSheetVisible(true);
                  }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <ThemedText style={{ color: color.primary }}>{t("common.edit")}</ThemedText>
                </Pressable>
              }
            />
          ) : null}
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

      {canOpenCustomerSheet ? (
        <StripeCustomerSheet
          visible={customerSheetVisible}
          onResult={(result) => {
            setCustomerSheetVisible(false);
            customerSheetSessionPromiseRef.current = null;
            if (result.error) {
              setFeedback({
                tone: "error",
                message: result.error.localizedMessage ?? result.error.message,
              });
              return;
            }
            if (result.paymentMethod || result.paymentOption) {
              setFeedback({
                tone: "success",
                message: t("profile.payments.savedMethodsUpdated"),
              });
            }
          }}
          merchantDisplayName="Queue"
          headerTextForSelectionScreen={t("profile.payments.savedMethods")}
          intentConfiguration={{
            paymentMethodTypes,
          }}
          clientSecretProvider={{
            provideCustomerSessionClientSecret: async () => {
              customerSheetSessionPromiseRef.current ??= createCustomerSheetSession();
              const session = await customerSheetSessionPromiseRef.current;
              return {
                customerId: session.customerId,
                clientSecret: session.customerSessionClientSecret,
              };
            },
            provideSetupIntentClientSecret: async () => {
              customerSheetSessionPromiseRef.current ??= createCustomerSheetSession();
              const session = await customerSheetSessionPromiseRef.current;
              return session.setupIntentClientSecret;
            },
          }}
          defaultBillingDetails={currentUser.email ? { email: currentUser.email } : undefined}
          billingDetailsCollectionConfiguration={{
            name: "always",
            email: "automatic",
            address: "full",
            attachDefaultsToPaymentMethod: true,
          }}
        />
      ) : null}

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
                backgroundColor: pressed ? color.surfaceElevated : color.surfaceMuted,
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
    </ProfileSubpageScrollView>
  );
}
