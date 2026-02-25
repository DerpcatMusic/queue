import type { Id } from "@/convex/_generated/dataModel";
import { isSportType, toSportLabel } from "@/convex/constants";
import { ThemedText } from "@/components/themed-text";
import { KitList, KitListItem } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing, type BrandPalette } from "@/constants/brand";
import {
  formatAgorotCurrency,
  getPaymentStatusLabel,
  getPaymentStatusTone,
  getPayoutStatusLabel,
  getPayoutStatusTone,
  type PaymentStatus,
  type PayoutStatus,
  type StatusTone,
} from "@/lib/payments-utils";
import { formatDateTime } from "@/lib/jobs-utils";
import { View } from "react-native";

type PaymentActivityItem = {
  payment: {
    _id: Id<"payments">;
    status: PaymentStatus;
    currency: string;
    studioChargeAmountAgorot: number;
    instructorBaseAmountAgorot: number;
    platformMarkupAmountAgorot: number;
    createdAt: number;
  };
  payout: {
    status: PayoutStatus;
    settledAt?: number;
  } | null;
  job: {
    _id: Id<"jobs">;
    sport: string;
    startTime: number;
    status: "open" | "filled" | "cancelled" | "completed";
  } | null;
};

type PaymentActivityListProps = {
  viewerRole: "studio" | "instructor";
  items: PaymentActivityItem[];
  locale: string;
  palette: BrandPalette;
  title: string;
  subtitle?: string;
  emptyLabel: string;
  onSelectPaymentId?: (paymentId: Id<"payments">) => void;
};

function toneToken(tone: StatusTone, palette: BrandPalette) {
  switch (tone) {
    case "success":
      return {
        fg: palette.success as import("react-native").ColorValue,
        bg: palette.successSubtle,
        border: palette.success as import("react-native").ColorValue,
      };
    case "warning":
      return {
        fg: palette.warning as import("react-native").ColorValue,
        bg: palette.warningSubtle,
        border: palette.warning as import("react-native").ColorValue,
      };
    case "danger":
      return {
        fg: palette.danger,
        bg: palette.dangerSubtle,
        border: palette.danger,
      };
    case "primary":
      return {
        fg: palette.primary,
        bg: palette.primarySubtle,
        border: palette.primary,
      };
    default:
      return {
        fg: palette.textMuted,
        bg: palette.surfaceAlt,
        border: palette.borderStrong,
      };
  }
}

function StatusBadge({
  label,
  tone,
  palette,
}: {
  label: string;
  tone: StatusTone;
  palette: BrandPalette;
}) {
  const token = toneToken(tone, palette);
  return (
    <View
      style={{
        borderWidth: 1,
        borderRadius: BrandRadius.pill,
        borderCurve: "continuous",
        borderColor: token.border,
        backgroundColor: token.bg,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <ThemedText type="micro" style={{ color: token.fg }}>
        {label}
      </ThemedText>
    </View>
  );
}

export function PaymentActivityList({
  viewerRole,
  items,
  locale,
  palette,
  title,
  subtitle,
  emptyLabel,
  onSelectPaymentId,
}: PaymentActivityListProps) {
  return (
    <View style={{ gap: BrandSpacing.sm, paddingHorizontal: BrandSpacing.sm }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: BrandSpacing.xs,
        }}
      >
        <View style={{ gap: 2 }}>
          <ThemedText type="title">{title}</ThemedText>
          {subtitle ? (
            <ThemedText type="caption" style={{ color: palette.textMuted }}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText type="bodyStrong" style={{ color: palette.textMuted }}>
          {items.length}
        </ThemedText>
      </View>

      {items.length === 0 ? (
        <View style={{ paddingHorizontal: BrandSpacing.md }}>
          <ThemedText type="caption" style={{ color: palette.textMuted }}>
            {emptyLabel}
          </ThemedText>
        </View>
      ) : (
        <KitList inset>
          {items.map((item) => {
            const paymentStatus = getPaymentStatusLabel(item.payment.status);
            const payoutStatus = item.payout
              ? getPayoutStatusLabel(item.payout.status)
              : null;
            const sportLabel = item.job
              ? isSportType(item.job.sport)
                ? toSportLabel(item.job.sport)
                : item.job.sport
              : "Lesson";
            const listItemPressProps = onSelectPaymentId
              ? { onPress: () => onSelectPaymentId(item.payment._id) }
              : {};

            return (
              <KitListItem
                key={item.payment._id}
                {...listItemPressProps}
              >
                <View style={{ gap: 6 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <ThemedText type="defaultSemiBold">{sportLabel}</ThemedText>
                      <ThemedText style={{ color: palette.textMuted }}>
                        {item.job
                          ? formatDateTime(item.job.startTime, locale)
                          : formatDateTime(item.payment.createdAt, locale)}
                      </ThemedText>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <StatusBadge
                        label={paymentStatus}
                        tone={getPaymentStatusTone(item.payment.status)}
                        palette={palette}
                      />
                      {payoutStatus ? (
                        <StatusBadge
                          label={payoutStatus}
                          tone={getPayoutStatusTone(item.payout!.status)}
                          palette={palette}
                        />
                      ) : null}
                    </View>
                  </View>

                  <View style={{ gap: 2 }}>
                    <ThemedText selectable style={{ fontVariant: ["tabular-nums"] }}>
                      {viewerRole === "studio"
                        ? `Charged ${formatAgorotCurrency(
                            item.payment.studioChargeAmountAgorot,
                            locale,
                            item.payment.currency,
                          )}`
                        : `You receive ${formatAgorotCurrency(
                            item.payment.instructorBaseAmountAgorot,
                            locale,
                            item.payment.currency,
                          )}`}
                    </ThemedText>
                    {viewerRole === "studio" ? (
                      <ThemedText
                        type="caption"
                        selectable
                        style={{ color: palette.textMuted, fontVariant: ["tabular-nums"] }}
                      >
                        {`Instructor payout ${formatAgorotCurrency(
                          item.payment.instructorBaseAmountAgorot,
                          locale,
                          item.payment.currency,
                        )} | Markup ${formatAgorotCurrency(
                          item.payment.platformMarkupAmountAgorot,
                          locale,
                          item.payment.currency,
                        )}`}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
              </KitListItem>
            );
          })}
        </KitList>
      )}
    </View>
  );
}
