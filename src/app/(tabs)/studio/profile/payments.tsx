import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LoadingScreen } from "@/components/loading-screen";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { PaymentActivityList } from "@/components/payments/payment-activity-list";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitButton, KitList, KitListItem, KitSwitchRow, KitTextField } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import { formatDateTime } from "@/lib/jobs-utils";
import {
  formatAgorotCurrency,
  getPaymentStatusLabel,
  getPayoutStatusLabel,
} from "@/lib/payments-utils";
import { useMutation, useQuery } from "convex/react";
import { Redirect, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useState } from "react";

export default function ProfilePaymentsScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const locale = i18n.resolvedLanguage ?? "en";
  const router = useRouter();

  const currentUser = useQuery(api.users.getCurrentUser);
  const isStudioPaymentsRole = currentUser?.role === "studio";

  const paymentRows = useQuery(
    api.payments.listMyPayments,
    isStudioPaymentsRole ? { limit: 40 } : "skip",
  );
  const payoutDestinations = useQuery(
    api.payments.listMyPayoutDestinations,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const payoutSummary = useQuery(api.payments.getMyPayoutSummary, "skip");
  const upsertPayoutDestination = useMutation(api.payments.upsertMyPayoutDestination);
  const requestPayoutWithdrawal = useMutation(api.payments.requestMyPayoutWithdrawal);
  const verifyPayoutDestinationForTesting = useMutation(
    api.payments.verifyMyPayoutDestinationForTesting,
  );
  const [destinationType, setDestinationType] = useState("il_bank");
  const [destinationRecipientId, setDestinationRecipientId] = useState("");
  const [destinationLabel, setDestinationLabel] = useState("");
  const [destinationCountry, setDestinationCountry] = useState("IL");
  const [destinationCurrency, setDestinationCurrency] = useState("ILS");
  const [destinationLast4, setDestinationLast4] = useState("");
  const [destinationIsDefault, setDestinationIsDefault] = useState(true);
  const [destinationSaveBusy, setDestinationSaveBusy] = useState(false);
  const [destinationVerifyBusyId, setDestinationVerifyBusyId] = useState<
    Id<"payoutDestinations"> | null
  >(null);
  const [destinationError, setDestinationError] = useState<string | null>(null);
  const [destinationInfo, setDestinationInfo] = useState<string | null>(null);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawInfo, setWithdrawInfo] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<Id<"payments"> | null>(
    null,
  );

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
    return <Redirect href="/(tabs)/instructor/profile/payments" />;
  }

  const rows = paymentRows ?? [];
  const role = currentUser.role as "studio" | "instructor";
  const failedCount = rows.filter((row) => row.payment.status === "failed").length;
  const processedCount = rows.filter((row) =>
    ["captured", "refunded"].includes(row.payment.status),
  ).length;
  const paidOutCount = rows.filter((row) => row.payout?.status === "paid").length;
  const isDetailLoading = selectedPaymentId !== null && selectedPaymentDetail === undefined;
  const isManualPayoutMode = payoutSummary?.payoutReleaseMode !== "automatic";

  const saveDestination = async () => {
    const recipientId = destinationRecipientId.trim();
    const payoutMethodType = destinationType.trim();
    if (!recipientId) {
      setDestinationError("Recipient ID is required.");
      return;
    }
    if (!payoutMethodType) {
      setDestinationError("Payout method type is required.");
      return;
    }

    setDestinationSaveBusy(true);
    setDestinationError(null);
    setDestinationInfo(null);
    try {
      await upsertPayoutDestination({
        provider: "rapyd",
        type: payoutMethodType,
        externalRecipientId: recipientId,
        ...(destinationLabel.trim()
          ? { label: destinationLabel.trim() }
          : {}),
        ...(destinationCountry.trim()
          ? { country: destinationCountry.trim().toUpperCase() }
          : {}),
        ...(destinationCurrency.trim()
          ? { currency: destinationCurrency.trim().toUpperCase() }
          : {}),
        ...(destinationLast4.trim()
          ? { last4: destinationLast4.trim().slice(-4) }
          : {}),
        isDefault: destinationIsDefault,
      });
      setDestinationInfo("Destination saved.");
      setDestinationRecipientId("");
      setDestinationLabel("");
      setDestinationLast4("");
    } catch (error) {
      setDestinationError(
        error instanceof Error ? error.message : "Failed to save destination.",
      );
    } finally {
      setDestinationSaveBusy(false);
    }
  };

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
      setWithdrawError(
        error instanceof Error ? error.message : "Failed to start withdrawal.",
      );
    } finally {
      setWithdrawBusy(false);
    }
  };

  const verifyDestinationForTesting = async (
    destinationId: Id<"payoutDestinations">,
  ) => {
    setDestinationVerifyBusyId(destinationId);
    setDestinationError(null);
    setDestinationInfo(null);
    try {
      await verifyPayoutDestinationForTesting({ destinationId });
      setDestinationInfo("Destination marked verified (sandbox test mode).");
    } catch (error) {
      setDestinationError(
        error instanceof Error ? error.message : "Failed to verify destination.",
      );
    } finally {
      setDestinationVerifyBusyId(null);
    }
  };

  return (
    <TabScreenScrollView
      routeKey="studio/profile"
      style={{ flex: 1, backgroundColor: palette.appBg }}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 28, gap: 16 }}
    >
      <View style={{ paddingHorizontal: BrandSpacing.lg, gap: 4 }}>
        <Pressable
          onPress={() => router.back()}
          style={{ alignSelf: "flex-start", paddingVertical: 4, paddingRight: 4 }}
        >
          <IconSymbol name="chevron.left" size={18} color={palette.textMuted} />
        </Pressable>
        <ThemedText type="heading">Payments & payouts</ThemedText>
        <ThemedText type="caption" style={{ color: palette.textMuted }}>
          Track amounts, payment processing, and payout delivery status.
        </ThemedText>
      </View>

      <View style={{ paddingHorizontal: BrandSpacing.sm }}>
        <KitList inset>
          <KitListItem
            title="Processed payments"
            accessory={<ThemedText style={{ color: palette.textMuted }}>{processedCount}</ThemedText>}
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
            <Pressable onPress={() => setSelectedPaymentId(null)}>
              <ThemedText type="caption" style={{ color: palette.textMuted }}>
                Clear
              </ThemedText>
            </Pressable>
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
                  selectedPaymentDetail.timeline.map((event) => (
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

      {role === "instructor" ? (
        <View style={{ gap: 8, paddingHorizontal: BrandSpacing.sm }}>
          <View style={{ paddingHorizontal: BrandSpacing.xs }}>
            <ThemedText type="title">Withdraw to bank</ThemedText>
            <ThemedText type="caption" style={{ color: palette.textMuted }}>
              Instructor payout amount stays equal to the lesson pay.
            </ThemedText>
          </View>
          <KitList inset>
            <KitListItem
              title="Available"
              accessory={
                <ThemedText style={{ color: palette.textMuted }}>
                  {formatAgorotCurrency(
                    payoutSummary?.availableAmountAgorot ?? 0,
                    locale,
                    payoutSummary?.currency ?? "ILS",
                  )}
                </ThemedText>
              }
            />
            <KitListItem
              title="In transit"
              accessory={
                <ThemedText style={{ color: palette.textMuted }}>
                  {formatAgorotCurrency(
                    payoutSummary?.pendingAmountAgorot ?? 0,
                    locale,
                    payoutSummary?.currency ?? "ILS",
                  )}
                </ThemedText>
              }
            />
            <KitListItem
              title="Paid"
              accessory={
                <ThemedText style={{ color: palette.textMuted }}>
                  {formatAgorotCurrency(
                    payoutSummary?.paidAmountAgorot ?? 0,
                    locale,
                    payoutSummary?.currency ?? "ILS",
                  )}
                </ThemedText>
              }
            />
            <KitListItem
              title="Destination"
              accessory={
                <ThemedText
                  style={{
                    color: payoutSummary?.hasVerifiedDestination
                      ? palette.textMuted
                      : palette.danger,
                  }}
                >
                  {payoutSummary?.hasVerifiedDestination
                    ? "Verified"
                    : "Not verified"}
                </ThemedText>
              }
            />
            <KitListItem
              title="Release mode"
              accessory={
                <ThemedText style={{ color: palette.textMuted }}>
                  {payoutSummary?.payoutReleaseMode === "automatic"
                    ? "Automatic"
                    : "Manual"}
                </ThemedText>
              }
            />
            <KitListItem>
              <View style={{ gap: 8 }}>
                {withdrawError ? (
                  <ThemedText type="caption" style={{ color: palette.danger }}>
                    {withdrawError}
                  </ThemedText>
                ) : null}
                {withdrawInfo ? (
                  <ThemedText type="caption" style={{ color: palette.textMuted }}>
                    {withdrawInfo}
                  </ThemedText>
                ) : null}
                {!isManualPayoutMode ? (
                  <ThemedText type="caption" style={{ color: palette.textMuted }}>
                    Payouts are currently automatic in this environment.
                  </ThemedText>
                ) : null}
                <KitButton
                  label={withdrawBusy ? "Starting withdrawal..." : "Withdraw to bank"}
                  onPress={() => {
                    void withdrawToBank();
                  }}
                  disabled={
                    withdrawBusy ||
                    !isManualPayoutMode ||
                    !payoutSummary?.hasVerifiedDestination ||
                    (payoutSummary?.availableAmountAgorot ?? 0) <= 0
                  }
                />
              </View>
            </KitListItem>
          </KitList>

          <View style={{ paddingHorizontal: BrandSpacing.xs }}>
            <ThemedText type="title">Add payout destination</ThemedText>
            <ThemedText type="caption" style={{ color: palette.textMuted }}>
              Use Rapyd beneficiary tokenization and save only the recipient reference ID.
            </ThemedText>
          </View>
          <KitList inset>
            <KitListItem title="Recipient reference">
              <View style={{ gap: 10, marginTop: 8 }}>
                <KitTextField
                  label="Recipient ID (from Rapyd)"
                  value={destinationRecipientId}
                  onChangeText={setDestinationRecipientId}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="ewallet_xxx or beneficiary_xxx"
                  helperText="Do not enter raw bank account data here."
                />
                <KitTextField
                  label="Payout method type"
                  value={destinationType}
                  onChangeText={setDestinationType}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="il_bank"
                />
                <KitTextField
                  label="Label (optional)"
                  value={destinationLabel}
                  onChangeText={setDestinationLabel}
                  autoCorrect={false}
                  placeholder="Main bank account"
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <KitTextField
                      label="Country"
                      value={destinationCountry}
                      onChangeText={setDestinationCountry}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      placeholder="IL"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <KitTextField
                      label="Currency"
                      value={destinationCurrency}
                      onChangeText={setDestinationCurrency}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      placeholder="ILS"
                    />
                  </View>
                </View>
                <KitTextField
                  label="Last 4 (optional)"
                  value={destinationLast4}
                  onChangeText={setDestinationLast4}
                  keyboardType="number-pad"
                  autoCorrect={false}
                  placeholder="1234"
                />
              </View>
            </KitListItem>
            <KitSwitchRow
              title="Set as default destination"
              value={destinationIsDefault}
              onValueChange={setDestinationIsDefault}
            />
            <KitListItem>
              <View style={{ gap: 8 }}>
                {destinationError ? (
                  <ThemedText type="caption" style={{ color: palette.danger }}>
                    {destinationError}
                  </ThemedText>
                ) : null}
                {destinationInfo ? (
                  <ThemedText type="caption" style={{ color: palette.textMuted }}>
                    {destinationInfo}
                  </ThemedText>
                ) : null}
                <KitButton
                  label={destinationSaveBusy ? "Saving..." : "Save destination"}
                  onPress={() => {
                    void saveDestination();
                  }}
                  disabled={destinationSaveBusy}
                />
              </View>
            </KitListItem>
          </KitList>

          <View style={{ paddingHorizontal: BrandSpacing.xs }}>
            <ThemedText type="title">Payout destinations</ThemedText>
            {payoutSummary?.sandboxSelfVerifyEnabled ? (
              <ThemedText type="caption" style={{ color: palette.textMuted }}>
                Sandbox testing: pending destinations can be verified from this screen.
              </ThemedText>
            ) : null}
          </View>
          <KitList inset>
            {(payoutDestinations ?? []).length === 0 ? (
              <KitListItem>
                <ThemedText style={{ color: palette.textMuted }}>
                  No payout destination configured yet.
                </ThemedText>
              </KitListItem>
            ) : (
              (payoutDestinations ?? []).map((destination) => (
                <KitListItem
                  key={destination._id}
                  title={destination.label || destination.type}
                  accessory={
                    <ThemedText style={{ color: palette.textMuted }}>
                      {destination.isDefault ? "Default" : destination.status}
                    </ThemedText>
                  }
                >
                  <ThemedText style={{ color: palette.textMuted }}>
                    {destination.country || "IL"} {destination.currency || "ILS"}{" "}
                    {destination.last4 ? `**** ${destination.last4}` : ""}
                  </ThemedText>
                  {payoutSummary?.sandboxSelfVerifyEnabled &&
                  destination.status !== "verified" ? (
                    <View style={{ marginTop: 8 }}>
                      <KitButton
                        label={
                          destinationVerifyBusyId === destination._id
                            ? "Verifying..."
                            : "Mark verified (sandbox)"
                        }
                        variant="secondary"
                        onPress={() => {
                          void verifyDestinationForTesting(destination._id);
                        }}
                        disabled={destinationVerifyBusyId === destination._id}
                      />
                    </View>
                  ) : null}
                </KitListItem>
              ))
            )}
          </KitList>
        </View>
      ) : null}
    </TabScreenScrollView>
  );
}
