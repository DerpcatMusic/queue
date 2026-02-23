import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { ThemedText } from "@/components/themed-text";
import { KitList, KitListItem } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing, type BrandPalette } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { formatDateTime, getApplicationStatusTranslationKey } from "@/lib/jobs-utils";
import { View, Pressable } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import type { TFunction } from "i18next";

type OpenJob = {
  jobId: Id<"jobs">;
  sport: string;
  studioName: string;
  applicationStatus?: "pending" | "accepted" | "rejected" | "withdrawn";
  startTime: number;
  zone: string;
  note?: string | null;
  pay: number;
};

type InstructorOpenJobsListProps = {
  jobs: OpenJob[];
  locale: string;
  zoneLanguage: "en" | "he";
  palette: BrandPalette;
  applyingJobId: Id<"jobs"> | null;
  onApply: (jobId: Id<"jobs">) => void;
  t: TFunction;
};

function JobStatusBadge({
  status,
  palette,
  t,
}: {
  status: OpenJob["applicationStatus"];
  palette: BrandPalette;
  t: TFunction;
}) {
  if (!status) {
    return (
      <View
        style={{
          borderWidth: 1,
          borderRadius: BrandRadius.pill,
          borderCurve: "continuous",
          borderColor: palette.primary,
          backgroundColor: palette.primarySubtle,
          paddingHorizontal: 9,
          paddingVertical: 4,
        }}
      >
        <ThemedText type="micro" style={{ color: palette.primary }}>
          {t("jobsTab.status.job.open")}
        </ThemedText>
      </View>
    );
  }

  const token =
    status === "accepted"
      ? { fg: palette.success as import("react-native").ColorValue, bg: palette.successSubtle, border: palette.success as import("react-native").ColorValue }
      : status === "rejected"
        ? { fg: palette.danger, bg: palette.dangerSubtle, border: palette.danger }
        : status === "pending"
          ? { fg: palette.primary, bg: palette.primarySubtle, border: palette.primary }
          : { fg: palette.textMuted, bg: palette.surfaceAlt, border: palette.borderStrong };

  return (
    <View
      style={{
        borderWidth: 1,
        borderRadius: BrandRadius.pill,
        borderCurve: "continuous",
        borderColor: token.border,
        backgroundColor: token.bg,
        paddingHorizontal: 9,
        paddingVertical: 4,
      }}
    >
      <ThemedText type="micro" style={{ color: token.fg }}>
        {t(getApplicationStatusTranslationKey(status))}
      </ThemedText>
    </View>
  );
}

export function InstructorOpenJobsList({
  jobs,
  locale,
  zoneLanguage,
  palette,
  applyingJobId,
  onApply,
  t,
}: InstructorOpenJobsListProps) {
  if (jobs.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: BrandSpacing.sm, paddingHorizontal: BrandSpacing.sm }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: BrandSpacing.xs,
        }}
      >
        <ThemedText type="title">{t("jobsTab.status.job.open")}</ThemedText>
        <ThemedText type="bodyStrong" style={{ color: palette.textMuted }}>
          {jobs.length}
        </ThemedText>
      </View>
      <KitList inset>
        {jobs.map((job, index) => (
          <KitListItem key={job.jobId}>
            <Animated.View
              entering={FadeInUp.delay(Math.min(index, 6) * 36).duration(260).springify()}
              style={{ gap: 8 }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText type="subtitle">{toSportLabel(job.sport as never)}</ThemedText>
                  <ThemedText style={{ color: palette.textMuted }}>{job.studioName}</ThemedText>
                </View>
                <JobStatusBadge status={job.applicationStatus} palette={palette} t={t} />
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <View
                  style={{
                    borderWidth: 1,
                    borderRadius: BrandRadius.pill,
                    borderCurve: "continuous",
                    borderColor: palette.border,
                    backgroundColor: palette.surfaceAlt,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <ThemedText type="micro" style={{ color: palette.textMuted }}>
                    {getZoneLabel(job.zone, zoneLanguage)}
                  </ThemedText>
                </View>
                <View
                  style={{
                    borderWidth: 1,
                    borderRadius: BrandRadius.pill,
                    borderCurve: "continuous",
                    borderColor: palette.border,
                    backgroundColor: palette.surfaceAlt,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <ThemedText type="micro" style={{ color: palette.textMuted }}>
                    {formatDateTime(job.startTime, locale)}
                  </ThemedText>
                </View>
              </View>

              {job.note ? (
                <ThemedText type="caption" style={{ color: palette.textMuted }} numberOfLines={2}>
                  {job.note}
                </ThemedText>
              ) : null}

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <ThemedText
                  type="bodyStrong"
                  selectable
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {t("jobsTab.card.pay", { value: job.pay })}
                </ThemedText>
                <Pressable
                  style={[
                    {
                      minHeight: 36,
                      borderWidth: 1,
                      borderRadius: 999,
                      borderCurve: "continuous",
                      paddingHorizontal: 14,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                    {
                      borderColor: job.applicationStatus ? palette.borderStrong : palette.primary,
                      backgroundColor: job.applicationStatus ? palette.surface : palette.primarySubtle,
                    },
                  ]}
                  disabled={Boolean(job.applicationStatus) || applyingJobId === job.jobId}
                  onPress={() => onApply(job.jobId)}
                >
                  <ThemedText
                    type="defaultSemiBold"
                    style={{ color: job.applicationStatus ? palette.textMuted : palette.primary }}
                  >
                    {applyingJobId === job.jobId ? t("jobsTab.actions.applying") : t("jobsTab.actions.apply")}
                  </ThemedText>
                </Pressable>
              </View>
            </Animated.View>
          </KitListItem>
        ))}
      </KitList>
    </View>
  );
}

