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
  /** Test account badge (bypasses KYC, enables full testing) */
  isTestAccount?: boolean | undefined;
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
  missionsCount = 0,
  role = "instructor",
  isTestAccount,
  transparent = false,
}: HomeHeaderSheetProps) {
  const theme = useTheme();
  const { color: palette } = theme;
  const mainTabSheetBackgroundColor = getMainTabSheetBackgroundColor(theme);
  const { t, i18n } = useTranslation();

  const isInstructor = role === "instructor";
  const showTestBadge = Boolean(isTestAccount && isInstructor);

  const compactCurrencySpacing = (value: string) =>
    value
      .replace(/[\u00A0\u202F\s]*₪[\u00A0\u202F\s]*/g, "₪")
      .replace(/[\u200E\u200F]/g, "")
      .trim();

  const monthlyValue = compactCurrencySpacing(thisMonthEarningsLabel ?? "0");
  const headlineValue = isInstructor ? monthlyValue : displayName;

  const totalAmount = Math.max(0, Number(totalEarningsAgorot ?? 0));
  const paidAmount = Math.max(0, Number(paidOutAmountAgorot ?? 0));
  const processingAmount = Math.max(0, Number(outstandingAmountAgorot ?? 0));
  const scaleTotal = Math.max(totalAmount, 1);

  const paidPercent = Math.max(0, Math.min(100, (paidAmount / scaleTotal) * 100));
  const processingPercent = Math.max(0, Math.min(100, (processingAmount / scaleTotal) * 100));

  const today = new Date();
  const monthLabel = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "en", {
    month: "short",
    day: "numeric",
  }).format(today);

  return (
    <Box
      pointerEvents="box-none"
      style={{
        paddingHorizontal: role === "studio" ? BrandSpacing.lg : BrandSpacing.xl,
        paddingTop: role === "studio" ? BrandSpacing.xs : BrandSpacing.lg,
        paddingBottom: role === "studio" ? BrandSpacing.sm : BrandSpacing.xl,
        gap: role === "studio" ? BrandSpacing.xs : BrandSpacing.md,
        backgroundColor: transparent
          ? "transparent"
          : role === "studio"
            ? palette.primarySubtle
            : mainTabSheetBackgroundColor,
      }}
    >
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap="md">
        <Box flex={1} gap="xxs">
          {isInstructor ? (
            <Text
              style={{
                ...BrandType.micro,
                color: palette.textMuted,
              }}
            >
              {t("home.instructor.thisMonthLabel")}
            </Text>
          ) : null}

          {isInstructor ? (
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
            </Box>
          ) : (
            <Text
              numberOfLines={1}
              style={{
                ...BrandType.titleLarge,
                fontFamily: FontFamily.displayBold,
                color: palette.text,
              }}
            >
              {displayName}
            </Text>
          )}
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
            size={role === "studio" ? 56 : 48}
            roundedSquare
          />
        </Pressable>
      </Box>

      {showTestBadge ? (
        <Box
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: BrandSpacing.xxs,
          }}
        >
          <Box
            style={{
              backgroundColor: palette.secondary,
              paddingHorizontal: BrandSpacing.xs,
              paddingVertical: BrandSpacing.xxs,
              borderRadius: BrandRadius.sm,
              borderWidth: 1,
              borderColor: palette.secondarySubtle,
            }}
          >
            <Text
              style={{
                ...BrandType.micro,
                fontSize: 9,
                color: palette.onSecondary,
                textTransform: "uppercase",
                fontWeight: "700",
              }}
            >
              {t("home.internal.testBadge")}
            </Text>
          </Box>
        </Box>
      ) : null}

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
      ) : null}
    </Box>
  );
});
