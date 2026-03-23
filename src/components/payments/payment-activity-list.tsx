import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { type BrandPalette, BrandSpacing } from "@/constants/brand";
import type { Id } from "@/convex/_generated/dataModel";
import { isSportType, toSportLabel } from "@/convex/constants";
import { formatDateTime } from "@/lib/jobs-utils";
import {
  formatAgorotCurrency,
  getPaymentStatusLabel,
  getPaymentStatusTone,
  getPayoutStatusLabel,
  type PaymentStatus,
  type PayoutStatus,
  type StatusTone,
} from "@/lib/payments-utils";

const STATUS_DOT_SIZE = 8;
const STATUS_DOT_RADIUS = 4;

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

function StatusDot({ tone, palette }: { tone: StatusTone; palette: BrandPalette }) {
  const colors: Record<StatusTone, string> = {
    success: palette.success as string,
    warning: palette.warning as string,
    danger: palette.danger as string,
    primary: palette.primary as string,
    muted: palette.textMuted as string,
  };
  return (
    <View
      style={{
        width: STATUS_DOT_SIZE,
        height: STATUS_DOT_SIZE,
        borderRadius: STATUS_DOT_RADIUS,
        backgroundColor: colors[tone] ?? colors.muted,
      }}
    />
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
  const { t } = useTranslation();
  return (
    <View style={{ gap: BrandSpacing.sm }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: BrandSpacing.md,
        }}
      >
        <View style={{ gap: 2 }}>
          <ThemedText type="bodyStrong">{title}</ThemedText>
          {subtitle ? (
            <ThemedText type="caption" style={{ color: palette.textMuted }}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {items.length > 0 && (
          <ThemedText type="caption" style={{ color: palette.textMuted }}>
            {items.length} {items.length === 1 ? "item" : "items"}
          </ThemedText>
        )}
      </View>

      {items.length === 0 ? (
        <View style={{ paddingHorizontal: BrandSpacing.md }}>
          <ThemedText type="caption" style={{ color: palette.textMuted }}>
            {emptyLabel}
          </ThemedText>
        </View>
      ) : (
        <View>
          {items.map((item, index) => {
            const paymentStatus = getPaymentStatusLabel(item.payment.status);
            const payoutStatus = item.payout ? getPayoutStatusLabel(item.payout.status) : null;
            const sportLabel = item.job
              ? isSportType(item.job.sport)
                ? toSportLabel(item.job.sport)
                : item.job.sport
              : t("jobsTab.currentLessonTitle");
            const listItemPressProps = onSelectPaymentId
              ? { onPress: () => onSelectPaymentId(item.payment._id) }
              : {};

            return (
              <Pressable
                key={item.payment._id}
                {...listItemPressProps}
                accessibilityRole={onSelectPaymentId ? "button" : undefined}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: BrandSpacing.md,
                  paddingHorizontal: BrandSpacing.md,
                  backgroundColor: pressed && onSelectPaymentId ? palette.surfaceAlt : "transparent",
                  borderBottomWidth: index < items.length - 1 ? 1 : 0,
                  borderBottomColor: palette.border,
                })}
              >
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: BrandSpacing.md }}>
                  <StatusDot
                    tone={getPaymentStatusTone(item.payment.status)}
                    palette={palette}
                  />
                  <View style={{ flex: 1 }}>
                    <ThemedText type="bodyStrong">{sportLabel}</ThemedText>
                    <ThemedText type="caption" style={{ color: palette.textMuted }}>
                      {item.job
                        ? formatDateTime(item.job.startTime, locale)
                        : formatDateTime(item.payment.createdAt, locale)}
                      {payoutStatus ? ` · ${payoutStatus}` : ""}
                    </ThemedText>
                  </View>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <ThemedText
                    type="bodyStrong"
                    selectable
                    style={{
                      fontVariant: ["tabular-nums"],
                      fontWeight: "600",
                    }}
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
                  <ThemedText type="caption" style={{ color: palette.textMuted }}>
                    {paymentStatus}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
