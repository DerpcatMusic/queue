import { Image as ExpoImage } from "expo-image";
import type { TFunction } from "i18next";
import type React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from "react-native-svg";
import { DotStatusPill } from "@/components/home/home-shared";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth, FontFamily, FontSize, LetterSpacing, LineHeight } from "@/lib/design-system";
import {
  type BoostPreset,
  formatTime,
  getApplicationStatusTranslationKey,
  getBoostPresentation,
  getExpiryPresentation,
  type JobClosureReason,
} from "@/lib/jobs-utils";

function formatJobPay(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(amount);
}

export type InstructorMarketplaceJob = {
  jobId: Id<"jobs">;
  applicationId?: Id<"jobApplications">;
  studioId: Id<"studioProfiles">;
  branchId: Id<"studioBranches">;
  sport: string;
  studioName: string;
  branchName: string;
  branchAddress?: string;
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
  applyingJobId?: Id<"jobs"> | null;
  withdrawingApplicationId?: Id<"jobApplications"> | null;
  now: number;
  onApply?: (jobId: Id<"jobs">) => void;
  onWithdrawApplication?: (applicationId: Id<"jobApplications">) => void;
  onOpenStudio?: (studioId: Id<"studioProfiles">, jobId: Id<"jobs">) => void;
  t: TFunction;
  variant?: "default" | "studioDetail";
};

function StudioImageBackground({
  imageUrl,
  fallbackLabel,
  theme,
  fadeId,
  children,
}: {
  imageUrl?: string | null | undefined;
  fallbackLabel: string;
  theme: ReturnType<typeof useTheme>;
  fadeId: string;
  children?: React.ReactNode;
}) {
  // Grayscale: CSS filter on web; SVG grayscale overlay on native for modern look
  const imageFilterStyle = Platform.select({
    web: { filter: "grayscale(100%) contrast(112%) brightness(54%)" },
    default: undefined,
  }) as object;

  // On native: semi-transparent dark overlay to simulate grayscale + enhance readability
  const nativeGrayscaleOverlay = Platform.select({
    web: null,
    default: (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.18)" }]}
      />
    ),
  });

  return (
    <View
      pointerEvents="none"
      className="overflow-hidden"
      style={{
        ...StyleSheet.absoluteFillObject,
        borderCurve: "continuous",
        backgroundColor: theme.jobs.surfaceRaised,
        borderRadius: BrandRadius.card,
      }}
    >
      {imageUrl ? (
        <ExpoImage
          source={{ uri: imageUrl }}
          contentFit="cover"
          style={[
            StyleSheet.absoluteFillObject,
            { width: "100%", height: "100%" },
            imageFilterStyle,
          ]}
        />
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.jobs.surfaceMuted,
          }}
        >
          <Text
            style={{
              ...BrandType.heading,
              color: theme.jobs.signal,
              letterSpacing: BrandType.heading.letterSpacing,
            }}
          >
            {fallbackLabel.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
      {/* Black gradient mask for readability */}
      <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <Defs>
          <SvgLinearGradient id={fadeId} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <Stop offset="44%" stopColor="#000000" stopOpacity="0.12" />
            <Stop offset="74%" stopColor="#000000" stopOpacity="0.52" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0.88" />
          </SvgLinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${fadeId})`} />
      </Svg>
      {/* Native grayscale simulation */}
      {nativeGrayscaleOverlay}
      {children}
    </View>
  );
}

function JobExpiryPill({
  label,
  isExpired,
  theme,
}: {
  label: string;
  isExpired: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  const backgroundColor = isExpired ? theme.color.dangerSubtle : theme.jobs.accentHeatSubtle;
  const color = isExpired ? theme.color.danger : theme.jobs.accentHeat;

  return (
    <View
      className="flex-row items-center rounded-pill"
      style={{
        backgroundColor,
        paddingHorizontal: BrandSpacing.sm,
        paddingVertical: BrandSpacing.xs,
        gap: BrandSpacing.xxs,
      }}
    >
      <IconSymbol name="clock.fill" size={12} color={color} />
      <Text
        numberOfLines={1}
        style={{
          ...BrandType.caption,
          color,
          fontWeight: "400",
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
  applyingJobId = null,
  withdrawingApplicationId = null,
  now,
  onApply,
  onWithdrawApplication,
  onOpenStudio,
  t,
  variant = "default",
}: InstructorJobCardProps) {
  const theme = useTheme();
  const { isDesktopWeb: isWideWeb } = useLayoutBreakpoint();
  const showStudioImage = variant === "default";
  const tone =
    job.applicationStatus === "pending"
      ? { color: theme.color.primary, background: theme.color.primarySubtle }
      : job.applicationStatus === "accepted"
        ? { color: theme.color.success, background: theme.color.successSubtle }
        : job.applicationStatus === "rejected"
          ? { color: theme.color.danger, background: theme.color.dangerSubtle }
          : job.applicationStatus === "withdrawn"
            ? { color: theme.color.textMuted, background: theme.color.surfaceAlt }
            : null;
  const dotColor = tone ? tone.color : undefined;
  const pillBackground = tone ? tone.background : undefined;
  const boost = getBoostPresentation(
    job.pay,
    job.boostPreset,
    job.boostBonusAmount,
    job.boostActive,
  );
  const expiry = getExpiryPresentation(job.applicationDeadline, locale, now);
  const isExpired = expiry?.isExpired ?? false;
  const street = job.studioAddress?.split(",")[0]?.trim();
  const branchStreet = job.branchAddress?.split(",")[0]?.trim();
  const zoneLabel = getZoneLabel(job.zone, zoneLanguage);
  const locationStreet = branchStreet ?? street;
  const shortLocation = locationStreet ? `${locationStreet} · ${zoneLabel}` : zoneLabel;
  const studioLabel = `${job.studioName} · ${job.branchName}`;
  const primaryTitle = variant === "studioDetail" ? toSportLabel(job.sport as never) : studioLabel;
  const secondaryTitle =
    variant === "studioDetail" ? shortLocation : toSportLabel(job.sport as never);
  const metaLine = variant === "studioDetail" ? studioLabel : shortLocation;
  const contentWidth = showStudioImage ? (isWideWeb ? "52%" : "53%") : "100%";
  const isPressable = Boolean(onOpenStudio);
  const canWithdrawPendingApplication =
    job.applicationStatus === "pending" &&
    Boolean(job.applicationId) &&
    Boolean(onWithdrawApplication);
  const canApplyFromCard =
    !job.applicationStatus ||
    job.applicationStatus === "withdrawn" ||
    job.applicationStatus === "rejected";
  const isWithdrawing = Boolean(
    job.applicationId && withdrawingApplicationId === job.applicationId,
  );
  const pendingCancelLabel = `${t(getApplicationStatusTranslationKey("pending"))} · ${t("jobsTab.actions.cancel")}`;
  const formattedPay = formatJobPay(boost.totalPay, locale);
  const payAccent = boost.bonusAmount ? theme.color.secondary : theme.color.primary;
  const imageFadeId = `job-card-fade-${String(job.jobId)}`;

  const cardBorderColor = payAccent;

  if (variant === "default") {
    const metaAccent = boost.bonusAmount ? theme.color.secondary : theme.color.primaryPressed;
    const studioMeta = job.branchName ? `${job.studioName} · ${job.branchName}` : job.studioName;
    const combinedMeta = `${studioMeta} | ${zoneLabel}`;

    return (
      <Pressable
        accessibilityRole={isPressable ? "button" : undefined}
        accessibilityLabel={
          isPressable ? `${job.studioName} ${toSportLabel(job.sport as never)}` : undefined
        }
        disabled={!isPressable}
        onPress={() => onOpenStudio?.(job.studioId, job.jobId)}
        style={({ pressed }) => ({
          transform: [{ scale: isPressable && pressed ? 0.992 : 1 }],
        })}
      >
        <View
          style={{
            borderRadius: BrandRadius.lg,
            borderCurve: "continuous",
            backgroundColor: theme.jobs.surface,
            borderWidth: BorderWidth.thin,
            borderColor: cardBorderColor,
            overflow: "hidden",
          }}
        >
          <StudioImageBackground
            imageUrl={job.studioImageUrl}
            fallbackLabel={job.studioName}
            theme={theme}
            fadeId={imageFadeId}
          />

          <View
            style={{
              minHeight: isWideWeb ? 220 : 204,
              position: "relative",
              paddingHorizontal: BrandSpacing.lg,
              paddingVertical: BrandSpacing.md,
              justifyContent: "space-between",
              gap: BrandSpacing.md,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: BrandSpacing.md }}>
              <View style={{ flex: 1, minWidth: 0, gap: BrandSpacing.xxs }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: "Lexend_800ExtraBold",
                    fontSize: 30,
                    lineHeight: 34,
                    letterSpacing: LetterSpacing.heroCompact,
                    color: theme.color.text,
                    includeFontPadding: false,
                    fontStyle: "italic",
                    fontWeight: "900",
                    textShadowColor: theme.color.overlay,
                    textShadowOffset: { width: 0, height: 3 },
                    textShadowRadius: 14,
                    transform: [{ skewX: "-8deg" }],
                  }}
                >
                  {toSportLabel(job.sport as never)}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: FontFamily.bodyMedium,
                    fontSize: FontSize.caption,
                    lineHeight: LineHeight.caption,
                    color: theme.color.textMuted,
                    includeFontPadding: false,
                  }}
                >
                  {combinedMeta}
                </Text>
                {expiry ? (
                  <Text
                    style={{
                      paddingTop: BrandSpacing.xs,
                      fontFamily: FontFamily.bodyMedium,
                      fontSize: FontSize.micro,
                      lineHeight: LineHeight.micro,
                      color: expiry.isExpired ? theme.color.danger : metaAccent,
                      includeFontPadding: false,
                    }}
                  >
                    {expiry.isExpired ? t("jobsTab.form.expiryExpired") : expiry.relativeText}
                  </Text>
                ) : null}
              </View>

              <View style={{ alignItems: "flex-end", gap: BrandSpacing.xs, maxWidth: "42%" }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    justifyContent: "flex-end",
                    gap: 2,
                  }}
                >
                  <Text
                    style={{
                      color: payAccent,
                      fontSize: FontSize.body,
                      fontWeight: "900",
                      fontFamily: FontFamily.displayBlack,
                      includeFontPadding: false,
                    }}
                  >
                    ₪
                  </Text>
                  <Text
                    style={{
                      fontFamily: FontFamily.displayBlack,
                      fontSize: FontSize.heroSmall,
                      lineHeight: LineHeight.heroSmall,
                      letterSpacing: LetterSpacing.heroSmall,
                      color: payAccent,
                      textAlign: "right",
                      fontWeight: "900",
                      includeFontPadding: false,
                    }}
                  >
                    {formattedPay}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ gap: BrandSpacing.sm }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: BrandSpacing.sm,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: BrandSpacing.xs,
                    flex: 1,
                  }}
                >
                  <IconSymbol name="clock.fill" size={14} color={metaAccent} />
                  <Text
                    style={{
                      fontFamily: FontFamily.bodyStrong,
                      fontSize: FontSize.body,
                      lineHeight: LineHeight.body,
                      color: theme.color.textMuted,
                      includeFontPadding: false,
                    }}
                    numberOfLines={1}
                  >
                    {formatTime(job.startTime, locale)} — {formatTime(job.endTime, locale)}
                  </Text>
                </View>

                <View style={{ minWidth: 124, alignItems: "flex-end", flexShrink: 0 }}>
                  {canWithdrawPendingApplication ? (
                    <ActionButton
                      label={isWithdrawing ? t("jobsTab.actions.cancelling") : pendingCancelLabel}
                      onPress={(event) => {
                        event?.stopPropagation();
                        if (job.applicationId) {
                          onWithdrawApplication?.(job.applicationId);
                        }
                      }}
                      tone="secondary"
                      loading={isWithdrawing}
                      fullWidth
                      native={false}
                    />
                  ) : canApplyFromCard && onApply ? (
                    <ActionButton
                      label={
                        isExpired
                          ? t("jobsTab.form.expiryExpired")
                          : applyingJobId === job.jobId
                            ? t("jobsTab.actions.applying")
                            : t("jobsTab.actions.apply")
                      }
                      onPress={(event) => {
                        event?.stopPropagation();
                        onApply(job.jobId);
                      }}
                      loading={applyingJobId === job.jobId}
                      disabled={isExpired}
                      fullWidth
                      tone="secondary"
                      colors={{
                        backgroundColor: isExpired ? theme.jobs.surfaceMuted : theme.color.tertiary,
                        pressedBackgroundColor: isExpired
                          ? theme.jobs.surfaceMuted
                          : theme.color.tertiarySubtle,
                        disabledBackgroundColor: theme.jobs.surfaceMuted,
                        labelColor: isExpired ? theme.color.textMuted : theme.color.onPrimary,
                        disabledLabelColor: theme.color.textMuted,
                        nativeTintColor: isExpired ? theme.color.textMuted : theme.color.onPrimary,
                      }}
                      labelStyle={{ fontWeight: "800" }}
                      native={false}
                    />
                  ) : job.applicationStatus ? (
                    <DotStatusPill
                      backgroundColor={pillBackground ?? theme.jobs.surfaceMuted}
                      color={dotColor ?? theme.color.textMuted}
                      label={t(getApplicationStatusTranslationKey(job.applicationStatus))}
                    />
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole={isPressable ? "button" : undefined}
      accessibilityLabel={
        isPressable ? `${job.studioName} ${toSportLabel(job.sport as never)}` : undefined
      }
      disabled={!isPressable}
      onPress={() => onOpenStudio?.(job.studioId, job.jobId)}
      style={({ pressed }) => ({
        transform: [{ scale: isPressable && pressed ? 0.992 : 1 }],
      })}
    >
      <View
        style={{
          borderRadius: BrandRadius.card,
          borderCurve: "continuous",
          backgroundColor: theme.jobs.surface,
          borderWidth: BorderWidth.thin,
          borderColor: cardBorderColor,
          overflow: "hidden",
        }}
      >
        {/* Glow accent line at top — only for pending/boosted */}
        {(job.applicationStatus === "pending" || boost.badgeKey) && (
          <View
            style={{
              height: BorderWidth.strong,
              backgroundColor:
                job.applicationStatus === "pending" ? theme.jobs.signal : theme.color.primary,
            }}
          />
        )}

        <View
          className="justify-between"
          style={{
            minHeight: variant === "studioDetail" ? (isWideWeb ? 174 : 164) : isWideWeb ? 190 : 172,
            position: "relative",
            paddingLeft: BrandSpacing.lg,
            paddingRight: showStudioImage ? 0 : isWideWeb ? BrandSpacing.lg : BrandSpacing.md,
            paddingVertical: BrandSpacing.lg,
          }}
        >
          {showStudioImage ? (
            <StudioImageBackground
              imageUrl={job.studioImageUrl}
              fallbackLabel={job.studioName}
              theme={theme}
              fadeId={imageFadeId}
            />
          ) : null}

          <View style={{ gap: BrandSpacing.stackTight, width: contentWidth }}>
            {/* Studio name — Lexend editorial headline */}
            <Text
              numberOfLines={1}
              style={{
                ...BrandType.title,
                color: theme.color.text,
                letterSpacing: -0.24,
              }}
            >
              {primaryTitle}
            </Text>

            {/* Sport label — secondary */}
            <Text
              numberOfLines={1}
              style={{
                ...BrandType.bodyMedium,
                color: theme.jobs.signal,
              }}
            >
              {secondaryTitle}
            </Text>

            {/* Location meta */}
            <Text
              numberOfLines={1}
              style={{
                ...BrandType.caption,
                color: theme.color.textMuted,
              }}
            >
              {metaLine}
            </Text>

            {/* Time range */}
            <View className="flex-row items-center" style={{ gap: BrandSpacing.xs }}>
              <IconSymbol name="clock.fill" size={14} color={theme.jobs.idle} />
              <Text
                style={{
                  ...BrandType.bodyStrong,
                  color: theme.color.text,
                }}
              >
                {formatTime(job.startTime, locale)}
              </Text>
              <IconSymbol name="arrow.right" size={14} color={theme.jobs.idle} />
              <Text
                style={{
                  ...BrandType.bodyStrong,
                  color: theme.color.text,
                }}
              >
                {formatTime(job.endTime, locale)}
              </Text>
            </View>

            {/* Tags row: expiry, boost, pay */}
            <View className="flex-row flex-wrap items-center" style={{ gap: BrandSpacing.sm }}>
              {expiry ? (
                <JobExpiryPill
                  label={t(expiry.key, expiry.interpolation)}
                  isExpired={expiry.isExpired}
                  theme={theme}
                />
              ) : null}
              {boost.badgeKey ? (
                <DotStatusPill
                  backgroundColor={theme.color.primarySubtle}
                  color={theme.color.primary}
                  label={t(boost.badgeKey, boost.badgeInterpolation)}
                />
              ) : null}
              {/* Pay — chartreuse signal accent */}
              <Text
                style={{
                  ...BrandType.bodyStrong,
                  color: theme.jobs.signal,
                }}
              >
                {boost.totalPay}
              </Text>
            </View>
          </View>

          {/* CTA — bottom action row */}
          <View className="pt-sm" style={{ width: contentWidth }}>
            {canWithdrawPendingApplication ? (
              <ActionButton
                label={isWithdrawing ? t("jobsTab.actions.cancelling") : pendingCancelLabel}
                onPress={(event) => {
                  event?.stopPropagation();
                  if (job.applicationId) {
                    onWithdrawApplication?.(job.applicationId);
                  }
                }}
                tone="secondary"
                loading={isWithdrawing}
                native={false}
              />
            ) : canApplyFromCard && onApply ? (
              <ActionButton
                label={
                  isExpired
                    ? t("jobsTab.form.expiryExpired")
                    : applyingJobId === job.jobId
                      ? t("jobsTab.actions.applying")
                      : t("jobsTab.actions.apply")
                }
                onPress={(event) => {
                  event?.stopPropagation();
                  onApply(job.jobId);
                }}
                loading={applyingJobId === job.jobId}
                disabled={isExpired}
                tone={isExpired ? "secondary" : "primary"}
                native={false}
              />
            ) : job.applicationStatus ? (
              <DotStatusPill
                backgroundColor={pillBackground ?? theme.jobs.surfaceMuted}
                color={dotColor ?? theme.color.textMuted}
                label={t(getApplicationStatusTranslationKey(job.applicationStatus))}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}
