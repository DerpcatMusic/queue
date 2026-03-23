import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import type React from "react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { DotStatusPill } from "@/components/home/home-shared";
import {
  InstructorJobCard,
  type InstructorMarketplaceJob,
} from "@/components/jobs/instructor/instructor-job-card";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { ThemedText } from "@/components/themed-text";
import { AppSymbol } from "@/components/ui/app-symbol";
import { IconButton } from "@/components/ui/icon-button";
import type { BrandPalette } from "@/constants/brand";
import { BrandSpacing } from "@/constants/brand";
import type { Id } from "@/convex/_generated/dataModel";
import {
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

function getStatusColors(
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
  const snapPoints = ["82%"];

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsAt={-1}
        appearsAt={0}
        style={[props.style, { backgroundColor: palette.surface as string }]}
      />
    ),
    [palette.surface],
  );

  return (
    <BottomSheet
      ref={innerRef}
      index={-1}
      snapPoints={snapPoints}
      topInset={collapsedSheetHeight}
      enablePanDownToClose
      onClose={onDismissed}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: palette.borderStrong as string }}
      backgroundStyle={{ backgroundColor: palette.appBg as string }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.lg,
          paddingTop: BrandSpacing.lg,
          paddingBottom: BrandSpacing.xxl,
          gap: BrandSpacing.lg,
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
          rows.map((row) => {
            const jobStatusTone = getJobStatusToneWithReason(row.jobStatus, row.closureReason);
            const jobStatusColors = getStatusColors(jobStatusTone, palette);

            return (
              <View key={String(row.applicationId)} style={{ gap: BrandSpacing.sm }}>
                <InstructorJobCard
                  job={row}
                  locale={locale}
                  zoneLanguage={zoneLanguage}
                  palette={palette}
                  now={now}
                  onOpenStudio={onOpenStudio}
                  t={t}
                />
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: BrandSpacing.sm,
                    paddingHorizontal: BrandSpacing.sm,
                  }}
                >
                  <DotStatusPill
                    backgroundColor={jobStatusColors.backgroundColor}
                    color={jobStatusColors.color}
                    label={t(getJobStatusTranslationKey(row.jobStatus, row.closureReason))}
                  />
                  <DotStatusPill
                    backgroundColor={palette.surfaceAlt as string}
                    color={palette.text as string}
                    label={t(
                      getApplicationStatusTranslationKey(row.applicationStatus ?? "pending"),
                    )}
                  />
                  <ThemedText type="caption" style={{ color: palette.textMuted as string }}>
                    {t("jobsTab.instructorFeed.archiveAppliedOn", {
                      date: formatArchiveDate(locale, row.appliedAt),
                    })}
                  </ThemedText>
                </View>
              </View>
            );
          })
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
