import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { getMainTabSheetBackgroundColor } from "@/components/layout/top-sheet-registry";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandRadius, BrandSpacing, BrandType, FontFamily } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Box, Text } from "@/primitives";
type HomeHeaderSheetProps = {
  displayName: string;
  profileImageUrl?: string | null | undefined;
  onPressAvatar?: (() => void) | undefined;
  subtitle?: string;
  isVerified?: boolean;
  thisMonthEarningsLabel?: string;
  thisMonthEarningsAgorot?: number;
  totalEarningsAgorot?: number;
  paidOutAmountAgorot?: number;
  outstandingAmountAgorot?: number;
  pendingApplications?: number;
  openJobs?: number;
  missionsCount?: number;
  role?: "instructor" | "studio";
  /** When true the sheet body background is transparent so a parent gradient shows through. */
  transparent?: boolean;
};

export const HomeHeaderSheet = memo(function HomeHeaderSheet({
  displayName,
  profileImageUrl,
  onPressAvatar,
  thisMonthEarningsLabel,
  totalEarningsAgorot,
  paidOutAmountAgorot,
  outstandingAmountAgorot,
  pendingApplications,
  openJobs,
  missionsCount = 0,
  role = "instructor",
  transparent = false,
}: HomeHeaderSheetProps) {
  const theme = useTheme();
  const { color: palette } = theme;
  const mainTabSheetBackgroundColor = getMainTabSheetBackgroundColor(theme);
  const { t, i18n } = useTranslation();

  const compactCurrencySpacing = (value: string) =>
    value
      .replace(/[\u00A0\u202F\s]*₪[\u00A0\u202F\s]*/g, "₪")
      .replace(/[\u200E\u200F]/g, "")
      .trim();

  const isInstructor = role === "instructor";
  const monthlyValue = compactCurrencySpacing(thisMonthEarningsLabel ?? "0");
  const jobsValue = String(openJobs ?? 0);
  const headlineValue = isInstructor ? monthlyValue : jobsValue;
  const headlineMinor = isInstructor ? undefined : t("home.actions.jobsTitle");

  // Multi-color progress bar logic
  const totalAmount = Math.max(0, Number(totalEarningsAgorot ?? 0));
  const paidAmount = Math.max(0, Number(paidOutAmountAgorot ?? 0));
  const processingAmount = Math.max(0, Number(outstandingAmountAgorot ?? 0));
  const scaleTotal = Math.max(totalAmount, 1);

  const paidPercent = Math.max(0, Math.min(100, (paidAmount / scaleTotal) * 100));
  const processingPercent = Math.max(0, Math.min(100, (processingAmount / scaleTotal) * 100));

  const progressPercent = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        ((openJobs ?? 0) / Math.max((openJobs ?? 0) + (pendingApplications ?? 0), 1)) * 100,
      ),
    ),
  );

  const today = new Date();
  const monthLabel = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "en", {
    month: "short",
    day: "numeric",
  }).format(today);

  return (
    <Box
      pointerEvents="box-none"
      style={{
        paddingHorizontal: BrandSpacing.xl,
        paddingTop: BrandSpacing.lg,
        paddingBottom: BrandSpacing.xl,
        gap: BrandSpacing.md,
        backgroundColor: transparent ? "transparent" : mainTabSheetBackgroundColor,
      }}
    >
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap="md">
        <Box flex={1} gap="xxs">
          <Text
            style={{
              ...BrandType.microItalic,
              color: palette.textMuted,
            }}
          >
            {isInstructor ? t("home.instructor.thisMonthLabel") : "QUEUE PERFORMANCE"}
          </Text>
          <Box flexDirection="row" alignItems="baseline" gap="xs">
            <Text
              numberOfLines={1}
              style={{
                ...BrandType.displayItalic,
                color: palette.primary,
                transform: [{ skewX: "-6deg" }],
              }}
            >
              {headlineValue}
            </Text>
            {isInstructor ? (
              <Text
                style={{
                  ...BrandType.title,
                  fontFamily: FontFamily.display,
                  color: palette.textMuted,
                  transform: [{ skewX: "-6deg" }],
                }}
              >
                {`${missionsCount} ${t("home.instructor.missions")}`}
              </Text>
            ) : headlineMinor ? (
              <Text
                style={{
                  ...BrandType.title,
                  fontFamily: FontFamily.display,
                  color: palette.primary,
                  transform: [{ skewX: "-6deg" }],
                }}
              >
                {` ${headlineMinor}`}
              </Text>
            ) : null}
          </Box>
        </Box>

        <Pressable
          accessibilityRole={onPressAvatar ? "button" : undefined}
          accessibilityLabel={onPressAvatar ? t("home.actions.profileTitle") : undefined}
          onPress={onPressAvatar}
          disabled={!onPressAvatar}
          style={{
            borderRadius: BrandRadius.pill,
            borderWidth: 2,
            borderColor: palette.primary,
            padding: 2,
          }}
        >
          <ProfileAvatar
            imageUrl={profileImageUrl}
            fallbackName={displayName}
            size={48}
            roundedSquare
          />
        </Pressable>
      </Box>

      {isInstructor ? (
        <Box gap="xs">
          <Box flexDirection="row" justifyContent="space-between" alignItems="center">
            <Text
              style={{
                ...BrandType.microItalic,
                color: palette.textMuted,
              }}
            >
              {monthLabel.toUpperCase()}
            </Text>
            <Text
              style={{
                ...BrandType.microItalic,
                color: palette.primary,
              }}
            >
              {t("home.instructor.status")}
            </Text>
          </Box>
          <Box
            style={{
              height: 10,
              width: "100%",
              borderRadius: BrandRadius.pill,
              backgroundColor: palette.surfaceMuted,
              overflow: "hidden",
            }}
          >
            {/* Paid Amount */}
            <Box
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${paidPercent}%`,
                backgroundColor: palette.primary,
                borderRadius: BrandRadius.pill,
              }}
            />
            {/* Processing Amount */}
            <Box
              style={{
                position: "absolute",
                left: `${paidPercent}%`,
                top: 0,
                bottom: 0,
                width: `${processingPercent}%`,
                backgroundColor: palette.secondary,
                borderRadius: BrandRadius.pill,
              }}
            />
          </Box>
        </Box>
      ) : (
        <Box gap="xs">
          <Box flexDirection="row" alignItems="center" justifyContent="space-between">
            <Text
              style={{
                ...BrandType.microItalic,
                color: palette.textMuted,
              }}
            >
              PENDING REVIEW
            </Text>
            <Text
              style={{
                ...BrandType.microItalic,
                color: palette.primary,
              }}
            >
              {t("home.studio.waitingCount", { count: pendingApplications ?? 0 })}
            </Text>
          </Box>
          <Box
            style={{
              height: 10,
              width: "100%",
              backgroundColor: palette.surfaceMuted,
              borderRadius: BrandRadius.pill,
              overflow: "hidden",
            }}
          >
            <Box
              style={{
                height: "100%",
                width: `${progressPercent}%`,
                backgroundColor: palette.primary,
                borderRadius: BrandRadius.pill,
              }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
});
