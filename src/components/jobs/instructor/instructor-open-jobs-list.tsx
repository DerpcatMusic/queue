import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { ThemedText } from "@/components/themed-text";
import { KitSurface } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing, type BrandPalette } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { formatDateTime, getApplicationStatusTranslationKey } from "@/lib/jobs-utils";
import { View, Pressable } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import type { TFunction } from "i18next";
import { AppSymbol } from "@/components/ui/app-symbol";

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
  if (!status) return null;

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
        paddingHorizontal: 8,
        paddingVertical: 2,
        alignSelf: "flex-start",
      }}
    >
      <ThemedText type="micro" style={{ color: token.fg, fontWeight: "700", textTransform: "uppercase" }}>
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
    <View style={{ gap: BrandSpacing.sm, paddingHorizontal: BrandSpacing.lg }}>
      <View style={{ gap: BrandSpacing.md }}>
        {jobs.map((job, index) => (
          <Animated.View
            key={`animated-${job.jobId}`}
            entering={FadeInUp.delay(Math.min(index, 6) * 36).duration(260).springify()}
          >
            <View style={{ position: "relative" }}>
              <KitSurface
                tone="elevated"
                style={{
                  padding: BrandSpacing.lg,
                  gap: BrandSpacing.sm,
                  overflow: "hidden",
                }}
              >
                {/* Header Row: Sport & Badges */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText
                      style={{
                        fontSize: 28,
                        lineHeight: 32,
                        fontWeight: "900",
                        color: palette.text,
                        letterSpacing: -1,
                        textTransform: "uppercase",
                      }}
                    >
                      {toSportLabel(job.sport as never)}
                    </ThemedText>
                    <ThemedText
                      type="bodyStrong"
                      style={{ color: palette.primary, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 }}
                    >
                      {job.studioName}
                    </ThemedText>
                  </View>
                  <JobStatusBadge status={job.applicationStatus} palette={palette} t={t} />
                </View>

                {/* Details Row: Time, Zone, Note */}
                <View style={{ gap: 6, marginVertical: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <AppSymbol name="calendar.circle.fill" size={16} tintColor={palette.textMuted} />
                    <ThemedText type="caption" style={{ color: palette.textMuted, fontWeight: "600" }}>
                      {formatDateTime(job.startTime, locale)}
                    </ThemedText>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <AppSymbol name="mappin.circle.fill" size={16} tintColor={palette.textMuted} />
                    <ThemedText type="caption" style={{ color: palette.textMuted, fontWeight: "600" }}>
                      {getZoneLabel(job.zone, zoneLanguage)}
                    </ThemedText>
                  </View>
                  {job.note ? (
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 2 }}>
                      <AppSymbol name="quote.bubble.fill" size={16} tintColor={palette.textMuted} />
                      <ThemedText type="caption" style={{ color: palette.textMuted, flex: 1 }} numberOfLines={2}>
                        {job.note}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>

                {/* Footer Row: Price (Left) & Apply (Right) via margin-left: auto flex trick */}
                <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.border }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
                    <ThemedText
                      style={{
                        fontSize: 32,
                        fontWeight: "900",
                        color: palette.text,
                        fontVariant: ["tabular-nums"],
                        letterSpacing: -1.5,
                      }}
                    >
                      {t("jobsTab.card.pay", { value: job.pay })}
                    </ThemedText>
                  </View>
                  
                  {/* Pushes button to right */}
                  <Pressable
                    style={[
                      {
                        marginLeft: "auto",
                        minHeight: 44,
                        minWidth: 100,
                        borderRadius: BrandRadius.card,
                        borderCurve: "continuous",
                        paddingHorizontal: BrandSpacing.lg,
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 6,
                      },
                      {
                        backgroundColor: job.applicationStatus ? palette.surfaceAlt : palette.primary,
                        borderColor: job.applicationStatus ? palette.border : palette.primary,
                        borderWidth: 1,
                      },
                    ]}
                    disabled={Boolean(job.applicationStatus) || applyingJobId === job.jobId}
                    onPress={() => onApply(job.jobId)}
                  >
                    <ThemedText
                      type="defaultSemiBold"
                      style={{ 
                        color: job.applicationStatus ? palette.textMuted : palette.onPrimary,
                        fontWeight: "800",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                      }}
                    >
                      {applyingJobId === job.jobId ? t("jobsTab.actions.applying") : t("jobsTab.actions.apply")}
                    </ThemedText>
                    {!job.applicationStatus && <AppSymbol name="arrow.right" size={16} tintColor={palette.onPrimary} />}
                  </Pressable>
                </View>
              </KitSurface>
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

