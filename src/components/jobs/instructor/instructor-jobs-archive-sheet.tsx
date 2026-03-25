import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import type { InstructorMarketplaceJob } from "@/components/jobs/instructor/instructor-job-card";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { ThemedText } from "@/components/themed-text";
import { AppSymbol } from "@/components/ui/app-symbol";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getSurfaceElevationStyle } from "@/components/ui/surface-elevation";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useTheme } from "@/hooks/use-theme";
import {
  formatDateWithWeekday,
  formatTime,
  getApplicationStatusTranslationKey,
  getJobStatusToneWithReason,
  getJobStatusTranslationKey,
  type JobClosureReason,
} from "@/lib/jobs-utils";

// Real color values for native/BottomSheet (CSS vars don't resolve in RN native views)
const COLORS = {
  primary: "#CCFF00",
  primarySubtle: "#CCFF001A",
  onPrimary: "#000000",
  success: "#22C55E",
  successSubtle: "#22C55E1A",
  warning: "#F59E0B",
  warningSubtle: "#F59E0B1A",
  surface: "#FFFFFF",
  surfaceAlt: "#F5F5F5",
  surfaceElevated: "#FFFFFF",
  appBg: "#FAFAFA",
  text: "#000000",
  textMuted: "#737373",
  borderStrong: "#D4D4D4",
} as const;

export type InstructorArchiveRow = InstructorMarketplaceJob & {
  applicationId: Id<"jobApplications">;
  appliedAt: number;
  jobStatus: "open" | "filled" | "cancelled" | "completed";
  closureReason?: JobClosureReason;
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
  tone: "primary" | "success" | "gray" | "amber" | "muted";
  icon: "checkmark.circle.fill" | "xmark.circle.fill" | "clock.fill";
  label: string;
} {
  if (row.applicationStatus === "rejected") {
    return {
      tone: "gray",
      icon: "xmark.circle.fill",
      label: t(getApplicationStatusTranslationKey(row.applicationStatus)),
    };
  }

  if (row.applicationStatus === "withdrawn") {
    return {
      tone: "muted",
      icon: "xmark.circle.fill",
      label: t(getApplicationStatusTranslationKey(row.applicationStatus)),
    };
  }

  const tone = getJobStatusToneWithReason(row.jobStatus, row.closureReason);
  return {
    tone,
    icon:
      tone === "success"
        ? "checkmark.circle.fill"
        : tone === "primary"
          ? "clock.fill"
          : "xmark.circle.fill",
    label: t(getJobStatusTranslationKey(row.jobStatus, row.closureReason)),
  };
}

function getStatusTokens(tone: "primary" | "success" | "gray" | "amber" | "muted") {
  if (tone === "success") {
    return {
      backgroundColor: COLORS.successSubtle,
      color: COLORS.success,
    };
  }
  if (tone === "amber") {
    return {
      backgroundColor: COLORS.warningSubtle,
      color: COLORS.warning,
    };
  }
  if (tone === "gray" || tone === "muted") {
    return {
      backgroundColor: COLORS.surfaceAlt,
      color: COLORS.textMuted,
    };
  }
  return {
    backgroundColor: COLORS.primarySubtle,
    color: COLORS.primary,
  };
}

function ArchiveStatusChip({
  label,
  icon,
  tone,
}: {
  label: string;
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  tone: "primary" | "success" | "gray" | "amber" | "muted";
}) {
  const tokens = getStatusTokens(tone);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: BrandSpacing.xs,
        borderRadius: BrandRadius.pill,
        borderCurve: "continuous",
        backgroundColor: tokens.backgroundColor,
        paddingHorizontal: BrandSpacing.control,
        paddingVertical: BrandSpacing.xs,
      }}
    >
      <IconSymbol name={icon} size={12} color={tokens.color} />
      <ThemedText type="caption" style={{ color: tokens.color }}>
        {label}
      </ThemedText>
    </View>
  );
}

function ArchiveDetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  label: string;
  value: string;
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
          backgroundColor: COLORS.surfaceAlt,
        }}
      >
        <IconSymbol name={icon} size={16} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1, gap: BrandSpacing.xxs }}>
        <ThemedText type="caption" className="text-muted">
          {label}
        </ThemedText>
        <ThemedText type="bodyMedium" className="text-brand">
          {value}
        </ThemedText>
      </View>
    </View>
  );
}

function ArchiveCompactRow({
  expanded,
  locale,
  onToggle,
  row,
  t,
  zoneLanguage,
}: {
  expanded: boolean;
  locale: string;
  onToggle: () => void;
  row: InstructorArchiveRow;
  t: ReturnType<typeof useTranslation>["t"];
  zoneLanguage: "en" | "he";
}) {
  const sportLabel = useMemo(() => toSportLabel(row.sport as never), [row.sport]);
  const archiveOutcome = useMemo(() => buildArchiveOutcome(row, t), [row, t]);
  const zoneLabel = getZoneLabel(row.zone, zoneLanguage);
  const scheduleLabel = `${formatArchiveDate(locale, row.startTime)} · ${formatTime(
    row.startTime,
    locale,
  )}–${formatTime(row.endTime, locale)}`;
  const payLabel = formatArchivePay(locale, row.pay);
  const appliedLabel = formatArchiveDate(locale, row.appliedAt);

  return (
    <View
      style={{
        borderRadius: BrandRadius.card,
        borderCurve: "continuous",
        backgroundColor: COLORS.surfaceAlt,
        overflow: "hidden",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${row.studioName} ${sportLabel}`}
        onPress={onToggle}
        style={({ pressed }) => ({
          backgroundColor: pressed ? COLORS.surfaceElevated : COLORS.surfaceAlt,
        })}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: BrandSpacing.md,
            paddingHorizontal: BrandSpacing.lg,
            paddingVertical: BrandSpacing.md,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: BrandSpacing.xs }}>
            <ThemedText numberOfLines={1} type="bodyStrong" className="text-brand">
              {sportLabel}
            </ThemedText>
            <ThemedText
              numberOfLines={1}
              className="text-muted"
              style={{
                fontFamily: "Manrope_400Regular",
                fontSize: 14,
                fontWeight: "400",
                lineHeight: 19,
              }}
            >
              {`${row.studioName} · ${scheduleLabel}`}
            </ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
              <ArchiveStatusChip
                label={archiveOutcome.label}
                tone={archiveOutcome.tone}
                icon={archiveOutcome.icon}
              />
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: BrandSpacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.xs }}>
              <IconSymbol name="banknote" size={14} color={COLORS.success} />
              <ThemedText type="bodyStrong" className="text-success">
                {payLabel}
              </ThemedText>
            </View>
            <IconSymbol
              name={expanded ? "chevron.down" : "chevron.right"}
              size={16}
              color={COLORS.textMuted}
            />
          </View>
        </View>
      </Pressable>
      {expanded ? (
        <View
          style={{
            gap: BrandSpacing.sm,
            backgroundColor: COLORS.surface,
            paddingHorizontal: BrandSpacing.lg,
            paddingBottom: BrandSpacing.lg,
            paddingTop: BrandSpacing.sm,
          }}
        >
          <View
            style={{
              gap: BrandSpacing.md,
              borderRadius: BrandRadius.card,
              borderCurve: "continuous",
              backgroundColor: COLORS.surfaceElevated,
              padding: BrandSpacing.md,
            }}
          >
            <ArchiveDetailRow
              icon={archiveOutcome.icon}
              label={archiveOutcome.label}
              value={
                row.applicationStatus === "rejected" || row.applicationStatus === "withdrawn"
                  ? t("jobsTab.instructorFeed.archiveAppliedOn", { date: appliedLabel })
                  : formatDateWithWeekday(row.startTime, locale)
              }
            />
            <ArchiveDetailRow
              icon="clock.fill"
              label={t("jobsTab.form.schedule")}
              value={`${formatTime(row.startTime, locale)}–${formatTime(row.endTime, locale)}`}
            />
            <ArchiveDetailRow icon="mappin.and.ellipse" label={t("tabs.map")} value={zoneLabel} />
            <ArchiveDetailRow
              icon="banknote"
              label={t("jobsTab.checkout.payment")}
              value={payLabel}
            />
          </View>
        </View>
      ) : null}
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
        ...getSurfaceElevationStyle("sheet", theme.color.shadow),
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
            <ThemedText type="caption" className="text-muted">
              {t("jobsTab.instructorFeed.archiveSubtitle")}
            </ThemedText>
          </View>
          <IconButton
            accessibilityLabel={t("common.close")}
            onPress={() => innerRef.current?.close()}
            size={BrandSpacing.control}
            tone="secondary"
            backgroundColorOverride={COLORS.primarySubtle}
            icon={<AppSymbol name="xmark" size={18} tintColor={COLORS.primary} />}
          />
        </View>

        {rows.length === 0 ? (
          <View
            style={{
              minHeight: BrandSpacing.xxl * 5,
              alignItems: "center",
              justifyContent: "center",
              gap: BrandSpacing.sm,
            }}
          >
            <ThemedText type="bodyMedium" className="text-muted">
              {t("jobsTab.instructorFeed.archiveEmpty")}
            </ThemedText>
          </View>
        ) : (
          rows.map((row) => (
            <ArchiveCompactRow
              key={String(row.applicationId)}
              expanded={expandedApplicationId === String(row.applicationId)}
              locale={locale}
              onToggle={() => toggleExpanded(String(row.applicationId))}
              row={row}
              t={t}
              zoneLanguage={zoneLanguage}
            />
          ))
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
