import type { TFunction } from "i18next";
import { Platform, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { KitButton, KitSurface } from "@/components/ui/kit";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { type BrandPalette, BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import {
  formatDateWithWeekday,
  formatTime,
  getApplicationStatusTranslationKey,
} from "@/lib/jobs-utils";

type OpenJob = {
  jobId: Id<"jobs">;
  sport: string;
  studioName: string;
  studioImageUrl?: string | null;
  applicationStatus?: "pending" | "accepted" | "rejected" | "withdrawn";
  startTime: number;
  endTime: number;
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

const WIDE_WEB_BREAKPOINT = 1180;

const STATUS_DOT: Record<
  NonNullable<OpenJob["applicationStatus"]>,
  { color: keyof BrandPalette; background: keyof BrandPalette }
> = {
  pending: { color: "warning", background: "warningSubtle" },
  accepted: { color: "success", background: "successSubtle" },
  rejected: { color: "danger", background: "dangerSubtle" },
  withdrawn: { color: "textMuted", background: "surface" },
};

function StatusPill({
  backgroundColor,
  color,
  label,
}: {
  backgroundColor: string;
  color: string;
  label: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        backgroundColor,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 3.5,
          backgroundColor: color,
        }}
      />
      <Text
        style={{
          ...BrandType.micro,
          fontSize: 11,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function MetricCell({
  align = "flex-start",
  label,
  value,
  valueColor,
}: {
  align?: "flex-start" | "flex-end";
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <View style={{ gap: 3, alignItems: align }}>
      <Text
        style={{
          ...BrandType.micro,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          color: valueColor,
          opacity: 0.7,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          ...BrandType.bodyStrong,
          fontSize: 15,
          lineHeight: 18,
          color: valueColor,
          textAlign: align === "flex-end" ? "right" : "left",
          fontVariant: ["tabular-nums"],
        }}
        numberOfLines={2}
      >
        {value}
      </Text>
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
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === "web" && width >= WIDE_WEB_BREAKPOINT;

  if (jobs.length === 0) return null;

  return (
    <View
      style={{
        gap: isWideWeb ? 10 : BrandSpacing.md,
        paddingHorizontal: BrandSpacing.lg,
      }}
    >
      {jobs.map((job, index) => {
        const tone = job.applicationStatus ? STATUS_DOT[job.applicationStatus] : null;
        const dotColor = tone ? (palette[tone.color] as string) : undefined;
        const pillBackground = tone ? (palette[tone.background] as string) : undefined;
        const shiftWindow = `${formatDateWithWeekday(job.startTime, locale)} · ${formatTime(
          job.startTime,
          locale,
        )}-${formatTime(job.endTime, locale)}`;

        return (
          <Animated.View
            key={`animated-${job.jobId}`}
            entering={FadeInUp.delay(Math.min(index, 6) * 36)
              .duration(280)
              .springify()
              .damping(18)}
          >
            <KitSurface
              tone="base"
              padding={BrandSpacing.lg}
              gap={0}
              style={{
                borderRadius: isWideWeb ? 28 : BrandRadius.card,
                borderCurve: "continuous",
                backgroundColor: tone
                  ? ((palette.surface as string) ?? "#fff")
                  : (palette.surfaceAlt as string),
                paddingHorizontal: isWideWeb ? 18 : BrandSpacing.lg,
                paddingVertical: isWideWeb ? 18 : 16,
              }}
            >
              <View
                style={{
                  flexDirection: isWideWeb ? "row" : "column",
                  alignItems: isWideWeb ? "center" : "stretch",
                  gap: isWideWeb ? 16 : 12,
                }}
              >
                <View
                  style={{
                    flex: isWideWeb ? 1.7 : undefined,
                    minWidth: 0,
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <ProfileAvatar
                    imageUrl={job.studioImageUrl}
                    fallbackName={job.studioName}
                    palette={palette}
                    size={isWideWeb ? 46 : 44}
                    roundedSquare
                  />

                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <Text
                        style={{
                          ...BrandType.heading,
                          fontSize: isWideWeb ? 24 : 22,
                          lineHeight: isWideWeb ? 26 : 25,
                          color: palette.text as string,
                        }}
                        numberOfLines={1}
                      >
                        {toSportLabel(job.sport as never)}
                      </Text>
                      {dotColor && pillBackground ? (
                        <StatusPill
                          backgroundColor={pillBackground}
                          color={dotColor}
                          label={t(getApplicationStatusTranslationKey(job.applicationStatus!))}
                        />
                      ) : null}
                    </View>

                    <Text
                      style={{
                        ...BrandType.bodyStrong,
                        fontSize: 14,
                        lineHeight: 17,
                        color: palette.primary as string,
                      }}
                      numberOfLines={1}
                    >
                      {job.studioName}
                    </Text>

                    {job.note ? (
                      <Text
                        style={{ ...BrandType.caption, color: palette.textMuted as string }}
                        numberOfLines={isWideWeb ? 1 : 2}
                      >
                        {job.note}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={{ width: isWideWeb ? 220 : undefined }}>
                  <MetricCell
                    label="Shift"
                    value={shiftWindow}
                    valueColor={palette.text as string}
                  />
                </View>

                <View style={{ width: isWideWeb ? 150 : undefined }}>
                  <MetricCell
                    label="Zone"
                    value={getZoneLabel(job.zone, zoneLanguage)}
                    valueColor={palette.text as string}
                  />
                </View>

                <View style={{ width: isWideWeb ? 135 : undefined }}>
                  <MetricCell
                    align={isWideWeb ? "flex-end" : "flex-start"}
                    label="Pay"
                    value={t("jobsTab.card.pay", { value: job.pay })}
                    valueColor={palette.text as string}
                  />
                </View>

                <View
                  style={{
                    width: isWideWeb ? 154 : undefined,
                    marginLeft: isWideWeb ? "auto" : undefined,
                    alignItems: isWideWeb ? "flex-end" : "flex-start",
                  }}
                >
                  {job.applicationStatus ? (
                    <StatusPill
                      backgroundColor={pillBackground ?? (palette.surface as string)}
                      color={dotColor ?? (palette.textMuted as string)}
                      label={t(getApplicationStatusTranslationKey(job.applicationStatus))}
                    />
                  ) : (
                    <KitButton
                      label={
                        applyingJobId === job.jobId
                          ? t("jobsTab.actions.applying")
                          : t("jobsTab.actions.apply")
                      }
                      onPress={() => onApply(job.jobId)}
                      variant="primary"
                      size="sm"
                      fullWidth={false}
                      loading={applyingJobId === job.jobId}
                      icon="arrow.right"
                    />
                  )}
                </View>
              </View>
            </KitSurface>
          </Animated.View>
        );
      })}
    </View>
  );
}
