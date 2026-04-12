import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { ThemedText } from "@/components/themed-text";
import { AppSymbol } from "@/components/ui/app-symbol";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { api } from "@/convex/_generated/api";
import { getZoneLabel } from "@/constants/zones";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import type { InstructorMarketplaceJob } from "@/features/jobs/instructor-marketplace-job";
import { useTheme } from "@/hooks/use-theme";
import {
  formatDateWithWeekday,
  formatTime,
  getApplicationStatusTranslationKey,
  getBoostPresentation,
  getJobStatusToneWithReason,
  getJobStatusTranslationKey,
  type JobClosureReason,
} from "@/lib/jobs-utils";
import { Motion, Spring } from "@/theme/theme";

const EXPAND_ANIMATION_DURATION = 220;

export type InstructorArchiveRow = InstructorMarketplaceJob & {
  applicationId: Id<"jobApplications">;
  appliedAt: number;
  jobStatus: "open" | "filled" | "cancelled" | "completed";
  closureReason?: JobClosureReason;
  // Payment fields — ground work for receipt support
  paidAt?: number;
  paymentStatus?: "pending" | "paid" | "failed";
};

type InstructorJobsArchiveSheetProps = {
  innerRef: React.RefObject<BottomSheet | null>;
  onDismissed: () => void;
  onOpenStateChange?: (open: boolean) => void;
  rows: InstructorArchiveRow[];
  locale: string;
  zoneLanguage: "en" | "he";
};

function formatArchiveDate(locale: string, timestamp: number) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(timestamp);
}

function formatArchivePay(locale: string, amount: number) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildArchiveOutcome(
  row: InstructorArchiveRow,
  t: ReturnType<typeof useTranslation>["t"],
): {
  tone: "success" | "amber" | "muted";
  icon: "checkmark.circle.fill" | "clock.fill" | "xmark.circle.fill";
  label: string;
} {
  // Rejected by studio
  if (row.applicationStatus === "rejected") {
    return {
      tone: "muted",
      icon: "xmark.circle.fill",
      label: t(getApplicationStatusTranslationKey(row.applicationStatus)),
    };
  }

  // Withdrawn by instructor
  if (row.applicationStatus === "withdrawn") {
    return {
      tone: "muted",
      icon: "xmark.circle.fill",
      label: t(getApplicationStatusTranslationKey(row.applicationStatus)),
    };
  }

  // Job-level status determines outcome
  const tone = getJobStatusToneWithReason(row.jobStatus, row.closureReason);
  return {
    tone: tone === "success" ? "success" : tone === "amber" ? "amber" : "muted",
    icon:
      tone === "success"
        ? "checkmark.circle.fill"
        : tone === "amber"
          ? "clock.fill"
          : "xmark.circle.fill",
    label: t(getJobStatusTranslationKey(row.jobStatus, row.closureReason)),
  };
}

function ArchiveStatusChip({
  label,
  icon,
  tone,
  theme,
}: {
  label: string;
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  tone: "success" | "amber" | "muted";
  theme: ReturnType<typeof useTheme>;
}) {
  const backgroundColor =
    tone === "success"
      ? theme.color.successSubtle
      : tone === "amber"
        ? theme.color.warningSubtle
        : theme.color.surfaceMuted;
  const color =
    tone === "success"
      ? theme.color.success
      : tone === "amber"
        ? theme.color.warning
        : theme.color.textMuted;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: BrandSpacing.xxs,
        borderRadius: BrandRadius.pill,
        borderCurve: "continuous",
        backgroundColor,
        paddingHorizontal: BrandSpacing.control,
        paddingVertical: BrandSpacing.xxs,
      }}
    >
      <IconSymbol name={icon} size={11} color={color} />
      <ThemedText type="micro" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

function ArchiveRow({
  row,
  expanded,
  onToggle,
  locale,
  zoneLanguage,
  t,
  index,
  onOpenReceipt,
}: {
  row: InstructorArchiveRow;
  expanded: boolean;
  onToggle: () => void;
  locale: string;
  zoneLanguage: "en" | "he";
  t: ReturnType<typeof useTranslation>["t"];
  index: number;
  onOpenReceipt?: () => void;
}) {
  const theme = useTheme();
  const archiveOutcome = useMemo(() => buildArchiveOutcome(row, t), [row, t]);
  const sportLabel = useMemo(() => toSportLabel(row.sport as never), [row.sport]);
  const zoneLabel = getZoneLabel(row.zone, zoneLanguage);
  const scheduleLabel = `${formatArchiveDate(locale, row.startTime)} · ${formatTime(
    row.startTime,
    locale,
  )}–${formatTime(row.endTime, locale)}`;
  const payLabel = formatArchivePay(locale, row.pay);
  const appliedLabel = formatArchiveDate(locale, row.appliedAt);
  const boost = getBoostPresentation(
    row.pay,
    row.boostPreset,
    row.boostBonusAmount,
    row.boostActive,
  );
  const hasBonus = Boolean(boost.bonusAmount && boost.bonusAmount > 0);

  // Payment display
  const isPaid = row.paymentStatus === "paid" || row.jobStatus === "completed";
  const paymentLabel = isPaid
    ? t("jobsTab.checkout.paymentStatus.captured")
    : t("jobsTab.checkout.paymentStatus.pending");

  // Status tone
  const statusColor =
    archiveOutcome.tone === "success"
      ? theme.color.success
      : archiveOutcome.tone === "amber"
        ? theme.color.warning
        : theme.color.textMuted;

  // Animated expand
  const expandProgress = useSharedValue(expanded ? 1 : 0);
  const contentStyle = useAnimatedStyle(() => ({
    height: withTiming(expandProgress.value * 100, {
      duration: EXPAND_ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
    }),
    opacity: withTiming(expandProgress.value, {
      duration: EXPAND_ANIMATION_DURATION * 0.7,
      easing: Easing.out(Easing.cubic),
    }),
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${withTiming(expandProgress.value * 180, { duration: EXPAND_ANIMATION_DURATION })}deg`,
      },
    ],
  }));

  // Update animation when expanded changes
  useEffect(() => {
    expandProgress.value = expanded ? 1 : 0;
  }, [expanded, expandProgress]);

  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(index, 8) * Motion.staggerBase)
        .springify()
        .damping(Spring.standard.damping)}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${row.studioName} ${sportLabel}`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => ({
          borderRadius: BrandRadius.medium,
          borderCurve: "continuous",
          backgroundColor: pressed ? theme.color.surfaceElevated : theme.color.surfaceMuted,
          overflow: "hidden",
        })}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: BrandSpacing.md,
            paddingHorizontal: BrandSpacing.md,
            paddingVertical: BrandSpacing.md,
          }}
        >
          {/* Left: sport + meta */}
          <View style={{ flex: 1, minWidth: 0, gap: BrandSpacing.xs }}>
            {/* Sport + status dot */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.xs }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: statusColor,
                }}
              />
              <ThemedText type="title" numberOfLines={1}>
                {sportLabel}
              </ThemedText>
            </View>

            {/* Studio · schedule */}
            <ThemedText type="caption" style={{ color: theme.color.textMuted }} numberOfLines={1}>
              {row.studioName} · {scheduleLabel}
            </ThemedText>

            {/* Status chip */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: BrandSpacing.sm,
                paddingTop: BrandSpacing.xxs,
              }}
            >
              <ArchiveStatusChip
                label={archiveOutcome.label}
                tone={archiveOutcome.tone}
                icon={archiveOutcome.icon}
                theme={theme}
              />
            </View>
          </View>

          {/* Right: pay + chevron */}
          <View style={{ alignItems: "flex-end", gap: BrandSpacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.xxs }}>
              <IconSymbol name="banknote" size={14} color={theme.color.textMuted} />
              <ThemedText type="bodyStrong">{payLabel}</ThemedText>
            </View>
            <Animated.View style={chevronStyle}>
              <IconSymbol name="chevron.down" size={16} color={theme.color.textMuted} />
            </Animated.View>
          </View>
        </View>

        {/* Expanded details — animated with translateY */}
        <Animated.View style={[{ overflow: "hidden" }, contentStyle]}>
          <View
            style={{
              gap: BrandSpacing.sm,
              backgroundColor: theme.color.surfaceMuted,
              paddingHorizontal: BrandSpacing.md,
              paddingBottom: BrandSpacing.md,
              paddingTop: BrandSpacing.sm,
              borderTopWidth: 1,
              borderTopColor: theme.color.border,
            }}
          >
            {/* Payment status */}
            <DetailRow
              icon={isPaid ? "checkmark.circle.fill" : "clock.fill"}
              label={t("jobsTab.checkout.payment")}
              value={paymentLabel}
              valueColor={isPaid ? theme.color.success : theme.color.warning}
              theme={theme}
            />

            {/* Bonus earned */}
            <DetailRow
              icon="sparkles"
              label={t("jobsTab.archive.bonusEarned")}
              value={hasBonus ? `+₪${boost.bonusAmount}` : t("jobsTab.archive.noBonus")}
              valueColor={hasBonus ? theme.color.primary : theme.color.textMuted}
              theme={theme}
            />

            {/* Schedule */}
            <DetailRow
              icon="calendar"
              label={t("jobsTab.form.schedule")}
              value={`${formatDateWithWeekday(row.startTime, locale)} · ${formatTime(
                row.startTime,
                locale,
              )}–${formatTime(row.endTime, locale)}`}
              valueColor={theme.color.text}
              theme={theme}
            />

            {/* Zone */}
            <DetailRow
              icon="mappin.and.ellipse"
              label={t("tabs.map")}
              value={zoneLabel}
              valueColor={theme.color.text}
              theme={theme}
            />

            {/* Applied date */}
            <DetailRow
              icon="envelope"
              label={t("jobsTab.instructorFeed.archiveAppliedOn", "Applied")}
              value={appliedLabel}
              valueColor={theme.color.text}
              theme={theme}
            />

            {/* Receipt — placeholder chip */}
            <Pressable
              accessibilityRole={onOpenReceipt ? "button" : undefined}
              disabled={!onOpenReceipt}
              onPress={onOpenReceipt}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: BrandSpacing.md,
                paddingTop: BrandSpacing.sm,
              }}
            >
              <View
                style={{
                  width: BrandSpacing.control,
                  height: BrandSpacing.control,
                  borderRadius: BrandRadius.card,
                  borderCurve: "continuous",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.color.surfaceElevated,
                }}
              >
                <IconSymbol name="doc.text" size={16} color={theme.color.textMuted} />
              </View>
              <View style={{ flex: 1, gap: BrandSpacing.xxs }}>
                <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
                  {t("jobsTab.archive.receipt")}
                </ThemedText>
                <ThemedText
                  type="bodyMedium"
                  style={{ color: onOpenReceipt ? theme.color.primary : theme.color.textMuted }}
                >
                  {onOpenReceipt
                    ? t("profile.payments.openReceipt")
                    : t("jobsTab.archive.receiptComingSoon")}
                </ThemedText>
              </View>
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  valueColor,
  theme,
}: {
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  label: string;
  value: string;
  valueColor: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: BrandSpacing.md }}>
      <View
        style={{
          width: BrandSpacing.control,
          height: BrandSpacing.control,
          borderRadius: BrandRadius.card,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.color.surfaceMuted,
        }}
      >
        <IconSymbol name={icon} size={16} color={theme.archive.accent} />
      </View>
      <View style={{ flex: 1, gap: BrandSpacing.xxs }}>
        <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
          {label}
        </ThemedText>
        <ThemedText type="bodyMedium" style={{ color: valueColor }}>
          {value}
        </ThemedText>
      </View>
    </View>
  );
}

export function InstructorJobsArchiveSheet({
  innerRef,
  onDismissed,
  onOpenStateChange,
  rows,
  locale,
  zoneLanguage,
}: InstructorJobsArchiveSheetProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const payments = useQuery(api.paymentsV2.listMyPaymentsV2, { limit: 200 });
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const [expandedApplicationId, setExpandedApplicationId] = useState<string | null>(null);
  const snapPoints = ["88%"];
  const paymentIdByJobId = useMemo(() => {
    const map = new Map<string, Id<"paymentOrdersV2">>();
    for (const row of payments ?? []) {
      map.set(String(row.payment.jobId), row.payment._id as Id<"paymentOrdersV2">);
    }
    return map;
  }, [payments]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsAt={-1}
        appearsAt={0}
        style={[props.style, { backgroundColor: theme.color.overlay }]}
      />
    ),
    [theme.color.overlay],
  );

  const toggleExpanded = useCallback((applicationId: string) => {
    setExpandedApplicationId((current) => (current === applicationId ? null : applicationId));
  }, []);

  return (
    <BottomSheet
      ref={innerRef}
      index={-1}
      snapPoints={snapPoints}
      topInset={collapsedSheetHeight}
      enablePanDownToClose
      onChange={(index) => {
        onOpenStateChange?.(index >= 0);
      }}
      onClose={() => {
        onOpenStateChange?.(false);
        setExpandedApplicationId(null);
        onDismissed();
      }}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: theme.color.borderStrong }}
      backgroundStyle={{
        backgroundColor: theme.color.surface,
      }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.lg,
          paddingTop: BrandSpacing.lg,
          paddingBottom: BrandSpacing.xxl,
          gap: BrandSpacing.md,
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: BrandSpacing.md,
          }}
        >
          <View style={{ flex: 1, gap: BrandSpacing.xs }}>
            <ThemedText type="heading">{t("jobsTab.archiveTitle")}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
              {t("jobsTab.instructorFeed.archiveSubtitle")}
            </ThemedText>
          </View>
          <IconButton
            accessibilityLabel={t("common.close")}
            onPress={() => innerRef.current?.close()}
            size={BrandSpacing.control}
            tone="secondary"
            backgroundColorOverride={theme.color.primarySubtle}
            icon={<AppSymbol name="xmark" size={18} tintColor={theme.color.primary} />}
          />
        </View>

        {/* Rows */}
        {rows.length === 0 ? (
          <EmptyArchiveState t={t} theme={theme} />
        ) : (
          rows.map((row, index) => (
            <ArchiveRow
              key={String(row.applicationId)}
              row={row}
              expanded={expandedApplicationId === String(row.applicationId)}
              locale={locale}
              onToggle={() => toggleExpanded(String(row.applicationId))}
              t={t}
              zoneLanguage={zoneLanguage}
              index={index}
              {...(paymentIdByJobId.get(String(row.jobId))
                ? {
                    onOpenReceipt: () => {
                      router.push(`/receipt/${paymentIdByJobId.get(String(row.jobId))!}`);
                    },
                  }
                : {})}
            />
          ))
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

function EmptyArchiveState({
  t,
  theme,
}: {
  t: ReturnType<typeof useTranslation>["t"];
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={{
        minHeight: BrandSpacing.xxl * 5,
        alignItems: "center",
        justifyContent: "center",
        gap: BrandSpacing.md,
        paddingHorizontal: BrandSpacing.xl,
      }}
    >
      <IconSymbol name="archivebox" size={48} color={theme.color.textMuted} />
      <ThemedText type="bodyMedium" style={{ color: theme.color.textMuted, textAlign: "center" }}>
        {t("jobsTab.instructorFeed.archiveEmpty")}
      </ThemedText>
      <ThemedText
        type="caption"
        style={{ color: theme.color.textMuted, textAlign: "center", opacity: 0.7 }}
      >
        {t("jobsTab.archive.emptyHint")}
      </ThemedText>
    </View>
  );
}
