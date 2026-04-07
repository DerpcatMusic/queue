import { useCallback, useMemo, memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
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

type PaymentActivityId = Id<"payments"> | Id<"paymentOrdersV2">;

type PaymentActivityItem = {
  payment: {
    _id: PaymentActivityId;
    jobId?: Id<"jobs">;
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
  onSelectPaymentId?: (paymentId: PaymentActivityId) => void;
};

const StatusDot = memo(function StatusDot({ color }: { color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 8, height: 8, borderRadius: BrandRadius.statusDot, backgroundColor: color }}
    />
  );
});

type PaymentActivityRowProps = {
  item: PaymentActivityItem;
  locale: string;
  viewerRole: "studio" | "instructor";
  statusColors: Record<StatusTone, string>;
  onSelectPaymentId?: (paymentId: PaymentActivityId) => void;
  isLast: boolean;
};

const PaymentActivityRow = memo(function PaymentActivityRow({
  item,
  locale,
  viewerRole,
  statusColors,
  onSelectPaymentId,
  isLast,
}: PaymentActivityRowProps) {
  const { t } = useTranslation();
  const { color: palette } = useTheme();

  const paymentStatus = getPaymentStatusLabel(item.payment.status);
  const payoutStatus = item.payout ? getPayoutStatusLabel(item.payout.status) : null;
  const sportLabel = item.job
    ? isSportType(item.job.sport)
      ? toSportLabel(item.job.sport)
      : item.job.sport
    : t("jobsTab.currentLessonTitle");

  const handlePress = useCallback(() => {
    onSelectPaymentId?.(item.payment._id);
  }, [onSelectPaymentId, item.payment._id]);

  return (
    <Pressable
      onPress={onSelectPaymentId ? handlePress : undefined}
      accessibilityRole={onSelectPaymentId ? "button" : undefined}
      accessibilityLabel={`${sportLabel}. ${paymentStatus}${payoutStatus ? `. ${payoutStatus}` : ""}.`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: BrandSpacing.md,
        paddingVertical: BrandSpacing.md,
        backgroundColor:
          pressed && onSelectPaymentId ? palette.surfaceAlt : palette.surface,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: palette.border,
      })}
    >
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: BrandSpacing.md }}>
        <StatusDot color={statusColors[getPaymentStatusTone(item.payment.status)]} />
        <View style={{ flex: 1 }}>
          <ThemedText numberOfLines={1} type="bodyStrong">
            {sportLabel}
          </ThemedText>
          <ThemedText numberOfLines={1} type="caption" style={{ color: palette.textMuted }}>
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
});

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

  const statusColors = useMemo<Record<StatusTone, string>>(() => ({
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    primary: palette.primary,
    muted: palette.textMuted,
  }), [palette.success, palette.warning, palette.danger, palette.primary, palette.textMuted]);

  return (
    <View style={{ gap: BrandSpacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: BrandSpacing.md }}>
        <View style={{ gap: BrandSpacing.stackTight }}>
          <ThemedText type="bodyStrong">{title}</ThemedText>
          {subtitle ? (
            <ThemedText type="caption" style={{ color: palette.textMuted }}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {items.length > 0 && (
          <ThemedText type="caption" style={{ color: palette.textMuted }}>
            {t("common.itemsCount", {
              count: items.length,
              defaultValue: `${items.length} ${items.length === 1 ? "item" : "items"}`,
            })}
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
          {items.map((item, index) => (
            <PaymentActivityRow
              key={item.payment._id}
              item={item}
              locale={locale}
              viewerRole={viewerRole}
              statusColors={statusColors}
              {...(onSelectPaymentId && { onSelectPaymentId })}
              isLast={index === items.length - 1}
            />
          ))}
        </View>
      )}
    </View>
  );
}
