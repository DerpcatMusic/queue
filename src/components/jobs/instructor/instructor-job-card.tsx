import { Image as ExpoImage } from "expo-image";
import type { TFunction } from "i18next";
import type React from "react";
import { memo } from "react";
import { I18nManager, Platform, Pressable, StyleSheet, View } from "react-native";
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from "react-native-svg";
import { FilterImage, type Filters } from "react-native-svg/filter-image";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import type { Id } from "@/convex/_generated/dataModel";
import { getInstructorJobPresentation } from "@/features/jobs/instructor-job-presentation";
import type { InstructorMarketplaceJob } from "@/features/jobs/instructor-marketplace-job";
import { useLayoutBreakpoint } from "@/hooks/use-layout-breakpoint";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth, FontFamily, FontSize, LetterSpacing, LineHeight } from "@/lib/design-system";
import { formatTime } from "@/lib/jobs-utils";
import { Box, Text } from "@/primitives";

// SVG feColorMatrix filter for true grayscale on native.
// First pass: desaturate to 0 (full grayscale).
// Second pass: boost contrast (1.15x) + lift blacks slightly (-0.07) for readability.
const STUDIO_IMAGE_NATIVE_FILTERS: Filters = [
  { name: "feColorMatrix", type: "saturate", values: 0 },
  {
    name: "feColorMatrix",
    type: "matrix",
    values: [1.15, 0, 0, 0, -0.07, 0, 1.15, 0, 0, -0.07, 0, 0, 1.15, 0, -0.07, 0, 0, 0, 1, 0],
  },
];

export type { InstructorMarketplaceJob } from "@/features/jobs/instructor-marketplace-job";

type InstructorJobCardProps = {
  job: InstructorMarketplaceJob;
  locale: string;
  zoneLanguage: "en" | "he";
  applyingJobId?: Id<"jobs"> | null;
  withdrawingApplicationId?: Id<"jobApplications"> | null;
  now: number;
  onApply?: (job: InstructorMarketplaceJob) => void;
  onWithdrawApplication?: (applicationId: Id<"jobApplications">) => void;
  onOpenStudio?: (studioId: Id<"studioProfiles">, jobId: Id<"jobs">) => void;
  t: TFunction;
  variant?: "default" | "studioDetail";
};

const StudioImageBackground = memo(function StudioImageBackground({
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
  // Grayscale: CSS filter on web; true SVG feColorMatrix desaturation on native
  const webFilterStyle = { filter: "grayscale(100%) contrast(112%) brightness(54%)" };

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
        Platform.select({
          // Web: CSS grayscale on ExpoImage
          web: (
            <View style={[StyleSheet.absoluteFillObject, webFilterStyle]}>
              <ExpoImage
                source={{ uri: imageUrl }}
                contentFit="cover"
                style={StyleSheet.absoluteFill}
              />
            </View>
          ),
          // Native: FilterImage with SVG feColorMatrix grayscale
          default: (
            <FilterImage
              source={{ uri: imageUrl }}
              filters={STUDIO_IMAGE_NATIVE_FILTERS}
              style={StyleSheet.absoluteFill}
            />
          ),
        })
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
      {/* Black gradient fade — transparent at top, fully opaque at bottom for text readability */}
      <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <Defs>
          <SvgLinearGradient id={fadeId} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <Stop offset="35%" stopColor="#000000" stopOpacity="0.10" />
            <Stop offset="60%" stopColor="#000000" stopOpacity="0.55" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${fadeId})`} />
      </Svg>
      {children}
    </View>
  );
});

export const InstructorJobCard = memo(function InstructorJobCard({
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
  const {
    boost,
    expiry,
    isExpired,
    zoneLabel,
    shortLocation,
    studioLabel,
    sportLabel,
    formattedPay,
    hasApplied,
    canWithdrawPendingApplication,
    canApplyFromCard,
    applyBlockedByVerification,
  } = getInstructorJobPresentation({
    job,
    locale,
    now,
    zoneLanguage,
  });
  const primaryTitle = variant === "studioDetail" ? sportLabel : studioLabel;
  const metaLine = variant === "studioDetail" ? studioLabel : shortLocation;
  const isPressable = Boolean(onOpenStudio);
  const imageFadeId = `job-card-fade-${String(job.jobId)}`;
  const isWithdrawing = Boolean(
    job.applicationId && withdrawingApplicationId === job.applicationId,
  );

  const canCancelApplication = canWithdrawPendingApplication && Boolean(onWithdrawApplication);
  const hasBoost = Boolean(boost.bonusAmount || boost.badgeKey);
  const accentColor = hasApplied
    ? theme.color.tertiary
    : hasBoost
      ? theme.color.secondary
      : theme.color.primary;
  const cardBorderColor = isExpired ? theme.color.surfaceMuted : accentColor;

  if (variant === "default") {
    const metaAccent = hasBoost ? theme.color.secondary : accentColor;
    const studioMeta = job.branchName ? `${job.studioName} · ${job.branchName}` : job.studioName;

    return (
      <Pressable
        accessibilityRole={isPressable ? "button" : undefined}
        accessibilityLabel={isPressable ? `${job.studioName} ${sportLabel}` : undefined}
        disabled={!isPressable}
        onPress={() => onOpenStudio?.(job.studioId, job.jobId)}
        style={({ pressed }) => ({
          position: "relative",
          transform: [{ scale: isPressable && pressed ? 0.992 : 1 }],
        })}
      >
        {/* Card — overflow hidden clips content to rounded corners */}
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
          <View
            style={{
              height: BorderWidth.strong,
              backgroundColor: isExpired ? theme.color.surfaceMuted : accentColor,
            }}
          />
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
                  {sportLabel}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: FontFamily.bodyMedium,
                    fontSize: FontSize.caption,
                    lineHeight: LineHeight.caption,
                    color: theme.color.text,
                    includeFontPadding: false,
                  }}
                >
                  {studioMeta}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: BrandSpacing.xs,
                  }}
                >
                  <IconSymbol name="location_on" size={13} color={accentColor} />
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
                    {zoneLabel}
                  </Text>
                </View>
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
                      color: metaAccent,
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
                      color: metaAccent,
                      textAlign: I18nManager.isRTL ? "left" : "right",
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
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: BrandSpacing.sm,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    gap: BrandSpacing.xs,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: BrandSpacing.xs,
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
                  {isPressable ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: BrandSpacing.xs,
                      }}
                    >
                      <Text
                        style={{
                          ...BrandType.labelStrong,
                          color: accentColor,
                          fontStyle: "italic",
                          transform: [{ skewX: "-8deg" }],
                        }}
                      >
                        {t("common.viewDetails")}
                      </Text>
                      <IconSymbol name="arrow.forward" size={14} color={accentColor} />
                    </View>
                  ) : null}
                </View>

                <View style={{ minWidth: 124, alignItems: "flex-end", flexShrink: 0 }}>
                  {canCancelApplication ? (
                    <ActionButton
                      label={
                        isWithdrawing
                          ? t("jobsTab.actions.cancelling")
                          : t("jobsTab.actions.cancel")
                      }
                      onPress={(event) => {
                        event?.stopPropagation();
                        if (job.applicationId) {
                          onWithdrawApplication?.(job.applicationId);
                        }
                      }}
                      tone="secondary"
                      loading={isWithdrawing}
                      fullWidth
                      colors={{
                        backgroundColor: theme.color.danger,
                        pressedBackgroundColor: theme.color.dangerSubtle,
                        disabledBackgroundColor: theme.color.danger,
                        labelColor: theme.color.onPrimary,
                        disabledLabelColor: theme.color.textMuted,
                        nativeTintColor: theme.color.onPrimary,
                      }}
                      labelStyle={{ fontWeight: "700" }}
                      native={false}
                    />
                  ) : canApplyFromCard && onApply ? (
                    <ActionButton
                      label={
                        isExpired
                          ? t("jobsTab.form.expiryExpired")
                          : applyBlockedByVerification
                            ? t("jobsTab.actions.verifyToApply")
                            : applyingJobId === job.jobId
                              ? t("jobsTab.actions.applying")
                              : t("jobsTab.actions.apply")
                      }
                      onPress={(event) => {
                        event?.stopPropagation();
                        onApply(job);
                      }}
                      loading={applyingJobId === job.jobId}
                      disabled={isExpired}
                      fullWidth
                      tone="secondary"
                      colors={{
                        backgroundColor: isExpired
                          ? theme.jobs.surfaceMuted
                          : applyBlockedByVerification
                            ? theme.jobs.surfaceRaised
                            : theme.color.tertiary,
                        pressedBackgroundColor: isExpired
                          ? theme.jobs.surfaceMuted
                          : applyBlockedByVerification
                            ? theme.jobs.surfaceMuted
                            : theme.color.tertiarySubtle,
                        disabledBackgroundColor: theme.jobs.surfaceMuted,
                        labelColor: isExpired
                          ? theme.color.textMuted
                          : applyBlockedByVerification
                            ? theme.color.text
                            : theme.color.onPrimary,
                        disabledLabelColor: theme.color.textMuted,
                        nativeTintColor: isExpired
                          ? theme.color.textMuted
                          : applyBlockedByVerification
                            ? theme.color.text
                            : theme.color.onPrimary,
                      }}
                      labelStyle={{ fontWeight: "800" }}
                      native={false}
                    />
                  ) : null}
                </View>
              </View>
            </View>
          </View>
          {/* Applied plaster — diagonal tape at bottom-left, inside the card */}
          {hasApplied ? (
            <View
              style={{
                position: "absolute",
                bottom: BrandSpacing.xs,
                left: BrandSpacing.xs,
                backgroundColor: theme.color.tertiary,
                paddingHorizontal: BrandSpacing.md,
                paddingVertical: BrandSpacing.xxs,
                transform: [{ rotate: "-12deg" }],
                zIndex: 10,
              }}
            >
              <Text
                style={{
                  ...BrandType.labelStrong,
                  fontSize: 8,
                  letterSpacing: 1,
                  color: theme.color.onPrimary,
                  textTransform: "uppercase",
                }}
              >
                {t("jobsTab.actions.applied")}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }

  // studioDetail variant — simplified for studio profile context
  return (
    <Pressable
      accessibilityRole={isPressable ? "button" : undefined}
      accessibilityLabel={isPressable ? `${job.studioName} ${sportLabel}` : undefined}
      disabled={!isPressable}
      onPress={() => onOpenStudio?.(job.studioId, job.jobId)}
      style={({ pressed }) => ({
        position: "relative",
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
                job.applicationStatus === "pending" ? theme.color.tertiary : theme.color.secondary,
            }}
          />
        )}

        <Box
          flexDirection="row"
          justifyContent="space-between"
          alignItems="flex-start"
          gap="lg"
          style={{
            paddingVertical: BrandSpacing.md,
            paddingHorizontal: BrandSpacing.lg,
            minHeight: isWideWeb ? 130 : 120,
          }}
        >
          {/* Left: Sport + Time */}
          <Box flex={1} gap="xs">
            {/* Sport — prominent but not overwhelming */}
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

            {/* Time range — compact inline */}
            <Box flexDirection="row" alignItems="center" gap="xxs">
              <IconSymbol name="clock.fill" size={14} color={theme.jobs.signal} />
              <Text
                style={{
                  fontFamily: FontFamily.bodyMedium,
                  fontSize: FontSize.caption,
                  fontWeight: "500",
                  color: theme.color.textMuted,
                  includeFontPadding: false,
                }}
                numberOfLines={1}
              >
                {formatTime(job.startTime, locale)} — {formatTime(job.endTime, locale)}
              </Text>
            </Box>

            {/* Location — subtle hint */}
            <Text
              numberOfLines={1}
              style={{
                ...BrandType.caption,
                color: theme.color.textMuted,
              }}
            >
              {metaLine}
            </Text>
          </Box>

          {/* Right: Pay + CTA stacked */}
          <Box alignItems="flex-end" gap="sm">
            {/* Pay — BOLD Lexend_800ExtraBold like home-header-sheet */}
            <Box flexDirection="row" alignItems="baseline" gap="xxs">
              <Text
                style={{
                  fontFamily: FontFamily.displayBold,
                  fontSize: FontSize.heroCompact,
                  lineHeight: LineHeight.heroCompact,
                  color: theme.jobs.signal,
                  includeFontPadding: false,
                  fontWeight: "800",
                }}
              >
                ₪{formattedPay}
              </Text>
            </Box>

            {/* CTA */}
            {canCancelApplication ? (
              <ActionButton
                label={
                  isWithdrawing ? t("jobsTab.actions.cancelling") : t("jobsTab.actions.cancel")
                }
                onPress={(event) => {
                  event?.stopPropagation();
                  if (job.applicationId) {
                    onWithdrawApplication?.(job.applicationId);
                  }
                }}
                tone="secondary"
                loading={isWithdrawing}
                colors={{
                  backgroundColor: theme.color.danger,
                  pressedBackgroundColor: theme.color.dangerSubtle,
                  disabledBackgroundColor: theme.color.danger,
                  labelColor: theme.color.onPrimary,
                  disabledLabelColor: theme.color.textMuted,
                  nativeTintColor: theme.color.onPrimary,
                }}
                labelStyle={{ fontWeight: "700" }}
                native={false}
              />
            ) : canApplyFromCard && onApply ? (
              <ActionButton
                label={
                  isExpired
                    ? t("jobsTab.form.expiryExpired")
                    : applyBlockedByVerification
                      ? t("jobsTab.actions.verifyToApply")
                      : applyingJobId === job.jobId
                        ? t("jobsTab.actions.applying")
                        : t("jobsTab.actions.apply")
                }
                onPress={(event) => {
                  event?.stopPropagation();
                  onApply(job);
                }}
                loading={applyingJobId === job.jobId}
                disabled={isExpired}
                tone={isExpired || applyBlockedByVerification ? "secondary" : "primary"}
                native={false}
              />
            ) : null}
          </Box>
        </Box>

        {/* Applied plaster — diagonal tape at bottom-left */}
        {hasApplied ? (
          <View
            style={{
              position: "absolute",
              bottom: BrandSpacing.xs,
              left: BrandSpacing.xs,
              backgroundColor: theme.color.danger,
              paddingHorizontal: BrandSpacing.md,
              paddingVertical: BrandSpacing.xxs,
              transform: [{ rotate: "-12deg" }],
              zIndex: 10,
            }}
          >
            <Text
              style={{
                ...BrandType.labelStrong,
                fontSize: 8,
                letterSpacing: 1,
                color: theme.color.onPrimary,
                textTransform: "uppercase",
              }}
            >
              {t("jobsTab.actions.applied")}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});
