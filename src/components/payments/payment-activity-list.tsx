import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import type { Id } from "@/convex/_generated/dataModel";
import { isSportType, toSportLabel } from "@/convex/constants";
import { useTheme } from "@/hooks/use-theme";
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
  title: string;
  subtitle?: string;
  emptyLabel: string;
  onSelectPaymentId?: (paymentId: Id<"payments">) => void;
};

function StatusDot({ color }: { color: string }) {
  return <View className="size-2 rounded-full" style={{ backgroundColor: color }} />;
}

export function PaymentActivityList({
  viewerRole,
  items,
  locale,
  title,
  subtitle,
  emptyLabel,
  onSelectPaymentId,
}: PaymentActivityListProps) {
  const { t } = useTranslation();
  const { color: palette } = useTheme();

  const statusColors: Record<StatusTone, string> = {
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    primary: palette.primary,
    muted: palette.textMuted,
  };
  return (
    <View className="gap-sm">
      <View className="flex-row items-center justify-between px-md">
        <View className="gap-stack-tight">
          <ThemedText type="bodyStrong">{title}</ThemedText>
          {subtitle ? (
            <ThemedText type="caption" className="text-muted">
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {items.length > 0 && (
          <ThemedText type="caption" className="text-muted">
            {items.length} {items.length === 1 ? "item" : "items"}
          </ThemedText>
        )}
      </View>

      {items.length === 0 ? (
        <View className="px-md">
          <ThemedText type="caption" className="text-muted">
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
                className="flex-row items-center justify-between px-md py-md"
                style={({ pressed }) => ({
                  backgroundColor:
                    pressed && onSelectPaymentId ? palette.surfaceAlt : palette.surface,
                  borderBottomWidth: index < items.length - 1 ? 1 : 0,
                  borderBottomColor: palette.border,
                })}
              >
                <View className="flex-1 flex-row items-center gap-md">
                  <StatusDot color={statusColors[getPaymentStatusTone(item.payment.status)]} />
                  <View style={{ flex: 1 }}>
                    <ThemedText type="bodyStrong">{sportLabel}</ThemedText>
                    <ThemedText type="caption" className="text-muted">
                      {item.job
                        ? formatDateTime(item.job.startTime, locale)
                        : formatDateTime(item.payment.createdAt, locale)}
                      {payoutStatus ? ` · ${payoutStatus}` : ""}
                    </ThemedText>
                  </View>
                </View>

                <View className="items-end">
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
                  <ThemedText type="caption" className="text-muted">
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
