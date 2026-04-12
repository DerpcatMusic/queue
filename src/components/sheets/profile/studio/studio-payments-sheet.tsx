import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useAction, useQuery } from "convex/react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable } from "react-native";
import { LoadingScreen } from "@/components/loading-screen";
import { PaymentActivityList } from "@/components/payments/payment-activity-list";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { StripeCustomerSheet } from "@/components/sheets/profile/studio/stripe-customer-sheet";
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

interface StudioPaymentsSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function StudioPaymentsSheet({ visible, onClose }: StudioPaymentsSheetProps) {
  const { t, i18n } = useTranslation();
  const { color } = useTheme();
  const locale = i18n.resolvedLanguage ?? "en";

  const currentUser = useQuery(api.users.getCurrentUser);
  const isStudio = currentUser?.role === "studio";
  const paymentRows = useQuery(api.paymentsV2.listMyPaymentsV2, isStudio ? { limit: 40 } : "skip");
  const createCustomerSheetSession = useAction(
    api.paymentsV2Actions.createMyStudioStripeCustomerSheetSessionV2,
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
    api.paymentsV2.getMyPaymentDetailV2,
    selectedPaymentId ? { paymentOrderId: selectedPaymentId } : "skip",
  );

  if (!currentUser || (isStudio && paymentRows === undefined)) {
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
  const canOpenCustomerSheet = currentUser.role === "studio" && Platform.OS !== "web";

  const customerSheetDefaultBillingDetails = currentUser.email
    ? {
        email: currentUser.email,
      }
    : undefined;

  return (
    <BaseProfileSheet visible={visible} onClose={onClose} scrollable={false}>
      <BottomSheetScrollView
        style={{ flex: 1, backgroundColor: color.appBg }}
        contentContainerStyle={{
          gap: BrandSpacing.lg,
          paddingTop: BrandSpacing.md,
          paddingBottom: BrandSpacing.xxl,
        }}
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
                    <ThemedText style={{ color: color.primary }}>{t("common.manage")}</ThemedText>
                  </Pressable>
                }
              />
            ) : null}
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
              paymentMethodTypes: ["card", "us_bank_account"],
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
            defaultBillingDetails={customerSheetDefaultBillingDetails}
            billingDetailsCollectionConfiguration={{
              name: "always",
              email: "automatic",
              address: "automatic",
              attachDefaultsToPaymentMethod: true,
            }}
            returnURL="queue://stripe-redirect"
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
                        </ThemedText>
                      </KitListItem>
                    ))
                  )}
                </KitList>
                <KitList inset>
                  <KitListItem
                    accessory={
                      <ThemedText style={{ color: color.textMuted }}>
                        {formatAgorotCurrency(
                          selectedPaymentDetail.payment.studioChargeAmountAgorot,
                          locale,
                          selectedPaymentDetail.payment.currency,
                        )}
                      </ThemedText>
                    }
                    title={t("profile.payments.studioCharged")}
                  />
                </KitList>
              </Box>
            )}
          </Box>
        ) : null}

        <Box style={{ paddingHorizontal: BrandSpacing.sm }}>
          <KitList inset>
            <KitListItem
              accessory={<ThemedText style={{ color: color.textMuted }}>Stripe</ThemedText>}
            />
          </KitList>
        </Box>
      </BottomSheetScrollView>
    </BaseProfileSheet>
  );
}
