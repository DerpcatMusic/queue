import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import {
  InstructorJobCard,
  type InstructorMarketplaceJob,
} from "@/components/jobs/instructor/instructor-job-card";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { ThemedText } from "@/components/themed-text";
import { AppSymbol } from "@/components/ui/app-symbol";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { type BrandPalette, BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import {
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
  rows: InstructorArchiveRow[];
  palette: BrandPalette;
  locale: string;
  zoneLanguage: "en" | "he";
  now: number;
  onOpenStudio: (studioId: Id<"studioProfiles">, jobId: Id<"jobs">) => void;
};

function formatArchiveDate(locale: string, timestamp: number) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(timestamp);
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
  palette,
  tone,
}: {
  label: string;
  palette: BrandPalette;
  tone: "primary" | "success" | "gray" | "amber" | "muted";
}) {
  const tokens = getStatusTokens(tone, palette);

  return (
    <View
      style={{
        borderRadius: BrandRadius.pill,
        borderCurve: "continuous",
        backgroundColor: tokens.backgroundColor,
        paddingHorizontal: BrandSpacing.controlX,
        paddingVertical: BrandSpacing.xs,
      }}
    >
      <ThemedText type="caption" style={{ color: tokens.color }}>
        {label}
      </ThemedText>
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
  now,
}: {
  expanded: boolean;
  locale: string;
  onOpenStudio: (studioId: Id<"studioProfiles">, jobId: Id<"jobs">) => void;
  onToggle: () => void;
  palette: BrandPalette;
  row: InstructorArchiveRow;
  t: ReturnType<typeof useTranslation>["t"];
  zoneLanguage: "en" | "he";
  now: number;
}) {
  const sportLabel = useMemo(() => toSportLabel(row.sport as never), [row.sport]);
  const statusTone = getJobStatusToneWithReason(row.jobStatus, row.closureReason);
  const statusLabel = t(getJobStatusTranslationKey(row.jobStatus, row.closureReason));

  return (
    <View
      style={{
        borderRadius: BrandRadius.soft,
        borderCurve: "continuous",
        backgroundColor: palette.surface as string,
        overflow: "hidden",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${row.studioName} ${sportLabel}`}
        onPress={onToggle}
        style={({ pressed }) => ({
          backgroundColor: pressed ? (palette.surfaceAlt as string) : (palette.surface as string),
        })}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: BrandSpacing.md,
            paddingHorizontal: BrandSpacing.lg,
            paddingVertical: BrandSpacing.md,
          }}
        >
          <View
            style={{
              minWidth: BrandSpacing.iconContainer + BrandSpacing.controlX,
              gap: BrandSpacing.xs,
            }}
          >
            <ThemedText type="bodyStrong" style={{ color: palette.text as string }}>
              {formatArchiveDate(locale, row.startTime)}
            </ThemedText>
            <ThemedText type="caption" style={{ color: palette.textMuted as string }}>
              {t("jobsTab.instructorFeed.archiveAppliedOn", {
                date: formatArchiveDate(locale, row.appliedAt),
              })}
            </ThemedText>
          </View>
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
              {row.studioName}
            </ThemedText>
          </View>
          <ArchiveStatusChip label={statusLabel} palette={palette} tone={statusTone} />
          <IconSymbol
            name={expanded ? "chevron.down" : "chevron.right"}
            size={16}
            color={palette.textMuted as string}
          />
        </View>
      </Pressable>
      {expanded ? (
        <View
          style={{
            gap: BrandSpacing.sm,
            borderTopWidth: 1,
            borderTopColor: palette.border as string,
            backgroundColor: palette.surfaceElevated as string,
            padding: BrandSpacing.sm,
          }}
        >
          <InstructorJobCard
            job={row}
            locale={locale}
            zoneLanguage={zoneLanguage}
            palette={palette}
            now={now}
            onOpenStudio={onOpenStudio}
            t={t}
          />
        </View>
      ) : null}
    </View>
  );
}

export function InstructorJobsArchiveSheet({
  innerRef,
  onDismissed,
  rows,
  palette,
  locale,
  zoneLanguage,
  now,
  onOpenStudio,
}: InstructorJobsArchiveSheetProps) {
  const { t } = useTranslation();
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const [expandedApplicationId, setExpandedApplicationId] = useState<string | null>(null);
  const snapPoints = ["78%"];

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
      onClose={() => {
        setExpandedApplicationId(null);
        onDismissed();
      }}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: palette.borderStrong as string }}
      backgroundStyle={{ backgroundColor: palette.surfaceElevated as string }}
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
            backgroundColorOverride={String(palette.surfaceAlt)}
            icon={<AppSymbol name="xmark" size={18} tintColor={palette.textMuted as string} />}
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
              now={now}
            />
          ))
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
