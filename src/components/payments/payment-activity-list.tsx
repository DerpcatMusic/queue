import { TouchableOpacity, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { type BrandPalette, BrandRadius, BrandSpacing } from "@/constants/brand";
import type { Id } from "@/convex/_generated/dataModel";
import { isSportType, toSportLabel } from "@/convex/constants";
import { formatDateTime } from "@/lib/jobs-utils";
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
          <ThemedText type="title" style={{ fontWeight: "600" }}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText type="caption" style={{ color: palette.textMuted }}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText type="bodyStrong" style={{ color: palette.text }}>
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
        <View style={{ paddingHorizontal: BrandSpacing.md, paddingBottom: 16 }}>
          {items.map((item, index) => {
            const paymentStatus = getPaymentStatusLabel(item.payment.status);
            const payoutStatus = item.payout ? getPayoutStatusLabel(item.payout.status) : null;
            const sportLabel = item.job
              ? isSportType(item.job.sport)
                ? toSportLabel(item.job.sport)
                : item.job.sport
              : "Lesson";
            const listItemPressProps = onSelectPaymentId
              ? { onPress: () => onSelectPaymentId(item.payment._id) }
              : {};

            return (
              <View
                key={item.payment._id}
                style={{
                  marginTop: index === 0 ? 0 : -12,
                  zIndex: items.length - index,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: -2 },
                  shadowOpacity: 0.03,
                  shadowRadius: 8,
                  elevation: index === 0 ? 1 : 2,
                }}
              >
                <TouchableOpacity
                  {...listItemPressProps}
                  style={{
                    backgroundColor: palette.surface,
                    padding: 16,
                    paddingBottom: 24, // extra padding at bottom because of overlap
                    borderRadius: 24,
                    borderCurve: "continuous",
                    borderWidth: 1,
                    borderColor: palette.border,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                  activeOpacity={0.9}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <ThemedText type="bodyStrong" style={{ fontSize: 18 }}>
                      {sportLabel}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: palette.textMuted }}>
                      {item.job
                        ? formatDateTime(item.job.startTime, locale)
                        : formatDateTime(item.payment.createdAt, locale)}
                    </ThemedText>
                    <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
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

                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <ThemedText
                      type="title"
                      selectable
                      style={{ fontVariant: ["tabular-nums"], fontSize: 22, fontWeight: "700" }}
                    >
                      {viewerRole === "studio"
                        ? formatAgorotCurrency(
                            item.payment.studioChargeAmountAgorot,
                            locale,
                            item.payment.currency,
                          )
                        : formatAgorotCurrency(
                            item.payment.instructorBaseAmountAgorot,
                            locale,
                            item.payment.currency,
                          )}
                    </ThemedText>
                    {viewerRole === "studio" ? (
                      <ThemedText type="caption" style={{ color: palette.textMuted }}>
                        {`Payout ${formatAgorotCurrency(
                          item.payment.instructorBaseAmountAgorot,
                          locale,
                          item.payment.currency,
                        )}`}
                      </ThemedText>
                    ) : null}
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
