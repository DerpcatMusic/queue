import type { TFunction } from "i18next";
import { Image, Pressable, Text, View } from "react-native";
import { DotStatusPill } from "@/components/home/home-shared";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSurface } from "@/components/ui/kit";
import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import {
  type BoostPreset,
  formatTime,
  getApplicationStatusTranslationKey,
  getBoostPresentation,
  getExpiryPresentation,
  type JobClosureReason,
} from "@/lib/jobs-utils";

// Image panel takes 44% on mobile, responsive adjustment handled via layout breakpoint.
const IMAGE_PANEL_WIDTH_PERCENT = "44%";

export type InstructorMarketplaceJob = {
  jobId: Id<"jobs">;
  studioId: Id<"studioProfiles">;
  sport: string;
  studioName: string;
  studioImageUrl?: string | null;
  studioAddress?: string;
  applicationStatus?: "pending" | "accepted" | "rejected" | "withdrawn";
  applicationDeadline?: number;
  startTime: number;
  endTime: number;
  zone: string;
  pay: number;
  closureReason?: JobClosureReason;
  boostPreset?: BoostPreset;
  boostBonusAmount?: number;
  boostActive?: boolean;
};

type InstructorJobCardProps = {
  job: InstructorMarketplaceJob;
  locale: string;
  zoneLanguage: "en" | "he";
  palette: BrandPalette;
  applyingJobId?: Id<"jobs"> | null;
  now: number;
  onApply?: (jobId: Id<"jobs">) => void;
  onOpenStudio?: (studioId: Id<"studioProfiles">, jobId: Id<"jobs">) => void;
  t: TFunction;
  variant?: "default" | "studioDetail";
};

const STATUS_DOT: Record<
  NonNullable<InstructorMarketplaceJob["applicationStatus"]>,
  { color: keyof BrandPalette; background: keyof BrandPalette }
> = {
  pending: { color: "warning", background: "warningSubtle" },
  accepted: { color: "success", background: "successSubtle" },
  rejected: { color: "danger", background: "dangerSubtle" },
  withdrawn: { color: "textMuted", background: "surface" },
};

function StudioImagePanel({
  imageUrl,
  fallbackLabel,
  palette,
}: {
  imageUrl?: string | null | undefined;
  fallbackLabel: string;
  palette: BrandPalette;
}) {
  return (
    <View
      className="overflow-hidden"
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: IMAGE_PANEL_WIDTH_PERCENT,
        borderCurve: "continuous",
        backgroundColor: palette.surfaceElevated as string,
        borderTopLeftRadius: BrandRadius.soft,
        borderBottomLeftRadius: BrandRadius.soft,
      }}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          resizeMode="cover"
          style={{
            width: "100%",
            height: "100%",
          }}
        />
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              ...BrandType.title,
              color: palette.text as string,
            }}
          >
            {fallbackLabel.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );
}

function JobExpiryPill({
  label,
  isExpired,
  palette,
}: {
  label: string;
  isExpired: boolean;
  palette: BrandPalette;
}) {
  const backgroundColor = isExpired
    ? (palette.dangerSubtle as string)
    : (palette.warningSubtle as string);
  const color = isExpired ? (palette.danger as string) : (palette.warning as string);

  return (
    <View
      className="flex-row items-center gap-stack-tight rounded-pill px-sm py-xs"
      style={{ backgroundColor }}
    >
      <IconSymbol name="clock.fill" size={12} color={color} />
      <Text
        numberOfLines={1}
        style={{
          ...BrandType.caption,
          color,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function InstructorJobCard({
  job,
  locale,
  zoneLanguage,
  palette,
  applyingJobId = null,
  now,
  onApply,
  onOpenStudio,
  t,
  variant = "default",
}: InstructorJobCardProps) {
  const { isDesktopWeb: isWideWeb } = useLayoutBreakpoint();
  const showStudioImage = variant === "default";
  const tone = job.applicationStatus ? STATUS_DOT[job.applicationStatus] : null;
  const dotColor = tone ? (palette[tone.color] as string) : undefined;
  const pillBackground = tone ? (palette[tone.background] as string) : undefined;
  const boost = getBoostPresentation(
    job.pay,
    job.boostPreset,
    job.boostBonusAmount,
    job.boostActive,
  );
  const expiry = getExpiryPresentation(job.applicationDeadline, locale, now);
  const isExpired = expiry?.isExpired ?? false;
  const street = job.studioAddress?.split(",")[0]?.trim();
  const zoneLabel = getZoneLabel(job.zone, zoneLanguage);
  const shortLocation = street ? `${street} · ${zoneLabel}` : zoneLabel;
  const primaryTitle =
    variant === "studioDetail" ? toSportLabel(job.sport as never) : job.studioName;
  const secondaryTitle =
    variant === "studioDetail" ? shortLocation : toSportLabel(job.sport as never);
  const metaLine = variant === "studioDetail" ? job.studioName : shortLocation;
  const contentWidth = showStudioImage ? (isWideWeb ? "52%" : "53%") : "100%";
  const isPressable = Boolean(onOpenStudio);

  return (
    <Pressable
      accessibilityRole={isPressable ? "button" : undefined}
      accessibilityLabel={
        isPressable ? `${job.studioName} ${toSportLabel(job.sport as never)}` : undefined
      }
      disabled={!isPressable}
      onPress={() => onOpenStudio?.(job.studioId, job.jobId)}
      style={({ pressed }) => ({
        opacity: isPressable && pressed ? 0.97 : 1,
      })}
    >
      <KitSurface
        tone="base"
        padding={0}
        gap={0}
        style={{
          borderRadius: BrandRadius.soft,
          borderCurve: "continuous",
          backgroundColor: palette.surface as string,
          overflow: "hidden",
        }}
      >
        <View
          className="justify-between"
          style={{
            minHeight: variant === "studioDetail" ? (isWideWeb ? 174 : 164) : isWideWeb ? 190 : 172,
            position: "relative",
            paddingLeft: BrandSpacing.lg,
            paddingRight: showStudioImage ? 0 : isWideWeb ? 20 : 16,
            paddingVertical: BrandSpacing.lg,
          }}
        >
          {showStudioImage ? (
            <StudioImagePanel
              imageUrl={job.studioImageUrl}
              fallbackLabel={job.studioName}
              palette={palette}
            />
          ) : null}

          <View className="gap-stack-tight" style={{ width: contentWidth }}>
            <Text
              numberOfLines={1}
              style={{
                ...BrandType.title,
                fontSize: isWideWeb ? 22 : 20,
                lineHeight: isWideWeb ? 24 : 22,
                color: palette.text as string,
              }}
            >
              {primaryTitle}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                ...BrandType.bodyMedium,
                color: palette.primary as string,
              }}
            >
              {secondaryTitle}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                ...BrandType.caption,
                color: palette.textMuted as string,
              }}
            >
              {metaLine}
            </Text>
            <View className="flex-row items-center gap-stack-tight">
              <IconSymbol name="clock.fill" size={14} color={palette.textMuted as string} />
              <Text style={{ ...BrandType.bodyStrong, color: palette.text as string }}>
                {formatTime(job.startTime, locale)}
              </Text>
              <IconSymbol name="arrow.right" size={14} color={palette.textMuted as string} />
              <Text style={{ ...BrandType.bodyStrong, color: palette.text as string }}>
                {formatTime(job.endTime, locale)}
              </Text>
            </View>
            <View className="flex-row flex-wrap items-center gap-sm">
              {expiry ? (
                <JobExpiryPill
                  label={t(expiry.key, expiry.interpolation)}
                  isExpired={expiry.isExpired}
                  palette={palette}
                />
              ) : null}
              {boost.badgeKey ? (
                <DotStatusPill
                  backgroundColor={palette.primarySubtle as string}
                  color={palette.primary as string}
                  label={t(boost.badgeKey, boost.badgeInterpolation)}
                />
              ) : null}
              <Text
                style={{
                  ...BrandType.bodyStrong,
                  color: palette.success as string,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {boost.totalPay}
              </Text>
            </View>
          </View>

          <View className="pt-sm" style={{ width: contentWidth }}>
            {job.applicationStatus ? (
              <DotStatusPill
                backgroundColor={pillBackground ?? (palette.surface as string)}
                color={dotColor ?? (palette.textMuted as string)}
                label={t(getApplicationStatusTranslationKey(job.applicationStatus))}
              />
            ) : onApply ? (
              <ActionButton
                label={
                  isExpired
                    ? t("jobsTab.form.expiryExpired")
                    : applyingJobId === job.jobId
                      ? t("jobsTab.actions.applying")
                      : t("jobsTab.actions.apply")
                }
                onPress={() => onApply(job.jobId)}
                palette={palette}
                loading={applyingJobId === job.jobId}
                disabled={isExpired}
              />
            ) : null}
          </View>
        </View>
      </KitSurface>
    </Pressable>
  );
}
