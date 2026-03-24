import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import type { InstructorMarketplaceJob } from "@/components/jobs/instructor/instructor-job-card";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { AppSymbol } from "@/components/ui/app-symbol";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getSurfaceElevationStyle } from "@/components/ui/surface-elevation";
import { type BrandPalette, BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import {
  formatDateWithWeekday,
  formatTime,
  getApplicationStatusTranslationKey,
  getJobStatusToneWithReason,
  getJobStatusTranslationKey,
  type JobClosureReason,
} from "@/lib/jobs-utils";

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
  palette: BrandPalette;
  locale: string;
  zoneLanguage: "en" | "he";
  onOpenStudio: (studioId: Id<"studioProfiles">, jobId: Id<"jobs">) => void;
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

function getStatusTokens(
  tone: "primary" | "success" | "gray" | "amber" | "muted",
  palette: BrandPalette,
) {
  if (tone === "success") {
    return {
      backgroundColor: palette.successSubtle as string,
      color: palette.success as string,
    };
  }
  if (tone === "amber") {
    return {
      backgroundColor: palette.warningSubtle as string,
      color: palette.warning as string,
    };
  }
  if (tone === "gray" || tone === "muted") {
    return {
      backgroundColor: palette.surfaceAlt as string,
      color: palette.textMuted as string,
    };
  }
  return {
    backgroundColor: palette.primarySubtle as string,
    color: palette.primary as string,
  };
}

function ArchiveStatusChip({
  label,
  icon,
  palette,
  tone,
}: {
  label: string;
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  palette: BrandPalette;
  tone: "primary" | "success" | "gray" | "amber" | "muted";
}) {
  const tokens = getStatusTokens(tone, palette);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: BrandSpacing.xs,
        borderRadius: BrandRadius.pill,
        borderCurve: "continuous",
        backgroundColor: tokens.backgroundColor,
        paddingHorizontal: BrandSpacing.controlX,
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
  palette,
}: {
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  label: string;
  value: string;
  palette: BrandPalette;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: BrandSpacing.md }}>
      <View
        style={{
          width: BrandSpacing.controlSm,
          height: BrandSpacing.controlSm,
          borderRadius: BrandRadius.medium,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: palette.surfaceAlt as string,
        }}
      >
        <IconSymbol name={icon} size={16} color={palette.primary as string} />
      </View>
      <View style={{ flex: 1, gap: BrandSpacing.xxs }}>
        <ThemedText type="caption" style={{ color: palette.textMuted as string }}>
          {label}
        </ThemedText>
        <ThemedText type="bodyMedium" style={{ color: palette.text as string }}>
          {value}
        </ThemedText>
      </View>
    </View>
  );
}

function ArchiveCompactRow({
  expanded,
  locale,
  onOpenStudio,
  onToggle,
  palette,
  row,
  t,
  zoneLanguage,
}: {
  expanded: boolean;
  locale: string;
  onOpenStudio: (studioId: Id<"studioProfiles">, jobId: Id<"jobs">) => void;
  onToggle: () => void;
  palette: BrandPalette;
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
        borderRadius: BrandRadius.soft,
        borderCurve: "continuous",
        backgroundColor: palette.surfaceAlt as string,
        overflow: "hidden",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${row.studioName} ${sportLabel}`}
        onPress={onToggle}
        style={({ pressed }) => ({
          backgroundColor: pressed
            ? (palette.surfaceElevated as string)
            : (palette.surfaceAlt as string),
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
            <ThemedText
              numberOfLines={1}
              type="bodyStrong"
              style={{ color: palette.text as string }}
            >
              {sportLabel}
            </ThemedText>
            <ThemedText
              numberOfLines={1}
              style={{
                ...BrandType.caption,
                color: palette.textMuted as string,
              }}
            >
              {`${row.studioName} · ${scheduleLabel}`}
            </ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
              <ArchiveStatusChip
                label={archiveOutcome.label}
                palette={palette}
                tone={archiveOutcome.tone}
                icon={archiveOutcome.icon}
              />
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: BrandSpacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.xs }}>
              <IconSymbol name="banknote" size={14} color={palette.success as string} />
              <ThemedText type="bodyStrong" style={{ color: palette.success as string }}>
                {payLabel}
              </ThemedText>
            </View>
            <IconSymbol
              name={expanded ? "chevron.down" : "chevron.right"}
              size={16}
              color={palette.textMuted as string}
            />
          </View>
        </View>
      </Pressable>
      {expanded ? (
        <View
          style={{
            gap: BrandSpacing.sm,
            backgroundColor: palette.surface as string,
            paddingHorizontal: BrandSpacing.lg,
            paddingBottom: BrandSpacing.lg,
            paddingTop: BrandSpacing.sm,
          }}
        >
          <View
            style={{
              gap: BrandSpacing.md,
              borderRadius: BrandRadius.medium,
              borderCurve: "continuous",
              backgroundColor: palette.surfaceElevated as string,
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
              palette={palette}
            />
            <ArchiveDetailRow
              icon="clock.fill"
              label={t("jobsTab.form.schedule")}
              value={`${formatTime(row.startTime, locale)}–${formatTime(row.endTime, locale)}`}
              palette={palette}
            />
            <ArchiveDetailRow
              icon="mappin.and.ellipse"
              label={t("tabs.map")}
              value={zoneLabel}
              palette={palette}
            />
            <ArchiveDetailRow
              icon="banknote"
              label={t("jobsTab.checkout.payment")}
              value={payLabel}
              palette={palette}
            />
            <ActionButton
              label={row.studioName}
              onPress={() => onOpenStudio(row.studioId, row.jobId)}
              palette={palette}
              tone="secondary"
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
  palette,
  locale,
  zoneLanguage,
  onOpenStudio,
}: InstructorJobsArchiveSheetProps) {
  const { t } = useTranslation();
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const [expandedApplicationId, setExpandedApplicationId] = useState<string | null>(null);
  const snapPoints = ["88%"];

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsAt={-1}
        appearsAt={0}
        style={[props.style, { backgroundColor: palette.appBg as string }]}
      />
    ),
    [palette.appBg],
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
      handleIndicatorStyle={{ backgroundColor: palette.borderStrong as string }}
      backgroundStyle={{
        backgroundColor: palette.surfaceElevated as string,
        ...getSurfaceElevationStyle(palette, "sheet"),
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
            <ThemedText type="caption" style={{ color: palette.textMuted as string }}>
              {t("jobsTab.instructorFeed.archiveSubtitle")}
            </ThemedText>
          </View>
          <IconButton
            accessibilityLabel={t("common.close")}
            onPress={() => innerRef.current?.close()}
            size={BrandSpacing.controlSm}
            tone="secondary"
            backgroundColorOverride={String(palette.primarySubtle)}
            icon={<AppSymbol name="xmark" size={18} tintColor={palette.primary as string} />}
          />
        </View>

        {rows.length === 0 ? (
          <View
            style={{
              minHeight: BrandSpacing.iconContainer * 5,
              alignItems: "center",
              justifyContent: "center",
              gap: BrandSpacing.sm,
            }}
          >
            <ThemedText type="bodyMedium" style={{ color: palette.textMuted as string }}>
              {t("jobsTab.instructorFeed.archiveEmpty")}
            </ThemedText>
          </View>
        ) : (
          rows.map((row) => (
            <ArchiveCompactRow
              key={String(row.applicationId)}
              expanded={expandedApplicationId === String(row.applicationId)}
              locale={locale}
              onOpenStudio={onOpenStudio}
              onToggle={() => toggleExpanded(String(row.applicationId))}
              palette={palette}
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
