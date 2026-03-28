import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import type { InstructorMarketplaceJob } from "@/components/jobs/instructor/instructor-job-card";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { ThemedText } from "@/components/themed-text";
import { AppSymbol } from "@/components/ui/app-symbol";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
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
}: {
  label: string;
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  tone: "success" | "amber" | "muted";
}) {
  const theme = useTheme();
  const backgroundColor =
    tone === "success"
      ? theme.archive.paidSubtle
      : tone === "amber"
        ? theme.archive.pendingSubtle
        : theme.color.surfaceAlt;
  const color =
    tone === "success"
      ? theme.archive.paid
      : tone === "amber"
        ? theme.archive.pending
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
}: {
  row: InstructorArchiveRow;
  expanded: boolean;
  onToggle: () => void;
  locale: string;
  zoneLanguage: "en" | "he";
  t: ReturnType<typeof useTranslation>["t"];
  index: number;
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

  // Detail section background uses archive surface
  const detailBg = theme.archive.surfaceElevated;

  // Left accent color based on outcome
  const accentColor =
    archiveOutcome.tone === "success"
      ? theme.archive.paid
      : archiveOutcome.tone === "amber"
        ? theme.archive.pending
        : theme.color.textMuted;

  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(index, 5) * 34)
        .duration(240)
        .springify()
        .damping(18)}
    >
      <View
        style={{
          borderRadius: BrandRadius.lg,
          borderCurve: "continuous",
          backgroundColor: theme.archive.surface,
          overflow: "hidden",
        }}
      >
        {/* Left accent stripe — color based on outcome */}
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: accentColor,
            borderRadius: BrandRadius.pill,
          }}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${row.studioName} ${sportLabel}`}
          accessibilityState={{ expanded }}
          onPress={onToggle}
          style={({ pressed }) => ({
            backgroundColor: pressed ? theme.color.surfaceAlt : theme.archive.surface,
          })}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: BrandSpacing.md,
              paddingHorizontal: BrandSpacing.lg,
              paddingVertical: BrandSpacing.md,
              paddingLeft: BrandSpacing.lg + 3, // account for accent stripe
            }}
          >
            {/* Left: sport + meta */}
            <View style={{ flex: 1, minWidth: 0, gap: BrandSpacing.xs }}>
              {/* Sport — prominent with archive accent color */}
              <ThemedText type="title" style={{ color: theme.archive.accent }} numberOfLines={1}>
                {sportLabel}
              </ThemedText>

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
                />
              </View>
            </View>

            {/* Right: pay + chevron */}
            <View style={{ alignItems: "flex-end", gap: BrandSpacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.xxs }}>
                <IconSymbol name="banknote" size={14} color={theme.archive.pay} />
                <ThemedText type="bodyStrong" style={{ color: theme.archive.pay }}>
                  {payLabel}
                </ThemedText>
              </View>
              <IconSymbol
                name={expanded ? "chevron.down" : "chevron.right"}
                size={16}
                color={theme.color.textMuted}
              />
            </View>
          </View>
        </Pressable>

        {/* Expanded details */}
        {expanded ? (
          <View
            style={{
              gap: BrandSpacing.sm,
              backgroundColor: detailBg,
              paddingHorizontal: BrandSpacing.lg,
              paddingLeft: BrandSpacing.lg + 3,
              paddingBottom: BrandSpacing.lg,
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
              valueColor={isPaid ? theme.archive.paid : theme.archive.pending}
              theme={theme}
            />

            {/* Bonus earned */}
            <DetailRow
              icon="sparkles"
              label={t("jobsTab.archive.bonusEarned")}
              value={hasBonus ? `+₪${boost.bonusAmount}` : t("jobsTab.archive.noBonus")}
              valueColor={hasBonus ? theme.archive.accent : theme.color.textMuted}
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
            <View
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
                  backgroundColor: theme.color.surfaceAlt,
                }}
              >
                <IconSymbol name="doc.text" size={16} color={theme.color.textMuted} />
              </View>
              <View style={{ flex: 1, gap: BrandSpacing.xxs }}>
                <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
                  {t("jobsTab.archive.receipt")}
                </ThemedText>
                <ThemedText type="bodyMedium" style={{ color: theme.color.textMuted }}>
                  {t("jobsTab.archive.receiptComingSoon")}
                </ThemedText>
              </View>
            </View>
          </View>
        ) : null}
      </View>
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
          backgroundColor: theme.color.surfaceAlt,
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
  const { t } = useTranslation();
  const theme = useTheme();
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const [expandedApplicationId, setExpandedApplicationId] = useState<string | null>(null);
  const snapPoints = ["88%"];

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsAt={-1}
        appearsAt={0}
        style={[props.style, { backgroundColor: theme.color.appBg }]}
      />
    ),
    [theme.color.appBg],
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
        backgroundColor: theme.color.surfaceElevated,
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
      {/* Warm amber accent strip */}
      <View
        style={{
          width: 48,
          height: 3,
          borderRadius: BrandRadius.pill,
          backgroundColor: theme.archive.accent,
          marginBottom: BrandSpacing.sm,
        }}
      />
      <IconSymbol name="archivebox" size={48} color={theme.archive.accent} />
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
