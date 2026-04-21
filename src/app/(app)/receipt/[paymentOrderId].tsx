import { useQuery } from "convex/react";
import { Redirect, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { KitList, KitListItem } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth } from "@/lib/design-system";
import { formatDateTime } from "@/lib/jobs-utils";
import { formatAgorotCurrency, getPayoutStatusLabel } from "@/lib/payments-utils";
import { Box } from "@/primitives";

export default function ReceiptScreen() {
  const { paymentOrderId } = useLocalSearchParams<{ paymentOrderId: string }>();
  const { t, i18n } = useTranslation();
  const { color } = useTheme();
  const locale = i18n.resolvedLanguage ?? "en";

  const currentUser = useQuery(api.users.getCurrent.getCurrentUser);
  const detail = useQuery(
    api.payments.core.getMyPaymentOrderDetail,
    paymentOrderId ? { paymentOrderId: paymentOrderId as Id<"paymentOrders"> } : "skip",
  );

  if (currentUser === undefined || detail === undefined) {
    return <LoadingScreen label={t("profile.payments.loadingReceipt")} />;
  }
  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }
  if (!paymentOrderId || !detail) {
    return <Redirect href="/" />;
  }

  const isStudio = currentUser.role === "studio";
  const issuedAt = detail.receipt.issuedAt ?? detail.payment.createdAt;

  return (
    <Box
      style={{
        flex: 1,
        backgroundColor: color.appBg,
        paddingHorizontal: BrandSpacing.lg,
        paddingTop: BrandSpacing.xl,
        gap: BrandSpacing.lg,
      }}
    >
      <Box style={{ gap: BrandSpacing.xs }}>
        <ThemedText type="title">{t("profile.payments.receipt")}</ThemedText>
        <ThemedText type="caption" style={{ color: color.textMuted }}>
          {detail.job
            ? `${detail.job.sport} · ${formatDateTime(detail.job.startTime, locale)}`
            : ""}
        </ThemedText>
      </Box>

      <KitList inset>
        <KitListItem
          title={
            isStudio
              ? t("profile.payments.receiptStudioTotal")
              : t("profile.payments.receiptInstructorGross")
          }
          accessory={
            <ThemedText style={{ color: color.text }}>
              {formatAgorotCurrency(
                isStudio
                  ? detail.payment.studioChargeAmountAgorot
                  : detail.payment.instructorBaseAmountAgorot,
                locale,
                detail.payment.currency,
              )}
            </ThemedText>
          }
        />
        <KitListItem
          title={t("profile.payments.receiptPlatformFee")}
          accessory={
            <ThemedText style={{ color: color.textMuted }}>
              {formatAgorotCurrency(
                detail.payment.platformMarkupAmountAgorot,
                locale,
                detail.payment.currency,
              )}
            </ThemedText>
          }
        />
        <KitListItem
          title={t("profile.payments.receiptIssuedAt")}
          accessory={
            <ThemedText style={{ color: color.textMuted }}>
              {formatDateTime(issuedAt, locale)}
            </ThemedText>
          }
        />
        <KitListItem
          title={t("profile.payments.payoutStatus")}
          accessory={
            <ThemedText style={{ color: color.textMuted }}>
              {detail.payout
                ? getPayoutStatusLabel(detail.payout.status)
                : t("profile.payments.notCreated")}
            </ThemedText>
          }
        />
        {detail.receipt.receiptNumber ? (
          <KitListItem
            title={t("profile.payments.receiptNumber")}
            accessory={
              <ThemedText style={{ color: color.textMuted }}>
                {detail.receipt.receiptNumber}
              </ThemedText>
            }
          />
        ) : null}
      </KitList>

      <Box
        style={{
          borderRadius: BrandRadius.card,
          borderCurve: "continuous",
          borderWidth: BorderWidth.thin,
          borderColor: color.border,
          backgroundColor: color.surfaceElevated,
          padding: BrandSpacing.lg,
          gap: BrandSpacing.sm,
        }}
      >
        <ThemedText type="bodyStrong">
          {isStudio
            ? t("profile.payments.receiptStudioBody")
            : t("profile.payments.receiptInstructorBody")}
        </ThemedText>
        <ThemedText type="caption" style={{ color: color.textMuted }}>
          {t("profile.payments.receiptFeesBody")}
        </ThemedText>
      </Box>

      {detail.receipt.documentUrl ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void WebBrowser.openBrowserAsync(detail.receipt.documentUrl!);
          }}
          style={({ pressed }) => ({
            borderRadius: BrandRadius.button,
            borderCurve: "continuous",
            borderWidth: BorderWidth.thin,
            borderColor: color.borderStrong,
            backgroundColor: pressed ? color.surfaceMuted : color.surfaceElevated,
            paddingHorizontal: BrandSpacing.lg,
            paddingVertical: BrandSpacing.md,
          })}
        >
          <ThemedText type="bodyStrong">{t("profile.payments.openHostedReceipt")}</ThemedText>
        </Pressable>
      ) : null}
    </Box>
  );
}
