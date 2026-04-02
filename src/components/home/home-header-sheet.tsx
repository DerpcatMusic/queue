import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitFloatingBadge } from "@/components/ui/kit/kit-floating-badge";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Box } from "@/primitives";

type HomeHeaderSheetProps = {
  displayName: string;
  subtitle?: string;
  profileImageUrl?: string | null | undefined;
  isVerified?: boolean;
  onPressAvatar?: (() => void) | undefined;
  // Performance metrics
  lessonsCompleted?: number;
  totalEarningsLabel?: string;
  paidOutLabel?: string;
  outstandingLabel?: string;
  totalEarningsAgorot?: number;
  paidOutAmountAgorot?: number;
  pendingApplications?: number;
  openJobs?: number;
  currency?: string;
  role?: "instructor" | "studio";
};

export const HomeHeaderSheet = memo(function HomeHeaderSheet({
  displayName,
  subtitle,
  profileImageUrl,
  isVerified = false,
  onPressAvatar,
  lessonsCompleted,
  totalEarningsLabel,
  paidOutLabel,
  outstandingLabel,
  totalEarningsAgorot,
  paidOutAmountAgorot,
  pendingApplications,
  openJobs,
  role = "instructor",
}: HomeHeaderSheetProps) {
  const { color: palette } = useTheme();
  const { t } = useTranslation();

  const isInstructor = role === "instructor";
  const earningsValue = totalEarningsLabel ?? "0";
  const paidOutValue = paidOutLabel ?? earningsValue;
  const outstandingValue = outstandingLabel ?? "0";
  const lessonsValue = String(lessonsCompleted ?? 0);
  const pendingValue = String(pendingApplications ?? 0);
  const jobsValue = String(openJobs ?? 0);
  const headlineValue = isInstructor ? paidOutValue : jobsValue;
  const headlineMinor = isInstructor ? t("profile.payments.paidOut") : t("home.actions.jobsTitle");
  const progressCurrent = isInstructor ? Number(paidOutAmountAgorot ?? 0) : Number(openJobs ?? 0);
  const progressTarget = isInstructor
    ? Math.max(Number(totalEarningsAgorot ?? 0), 1)
    : Math.max(progressCurrent + Number(pendingApplications ?? 0), 1);
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round((progressCurrent / progressTarget) * 100)),
  );

  return (
    <Box
      pointerEvents="box-none"
      style={{
        paddingHorizontal: BrandSpacing.xl,
        paddingTop: BrandSpacing.md,
        paddingBottom: BrandSpacing.xl,
        gap: BrandSpacing.lg,
      }}
    >
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap="md">
        <Box flex={1} gap="xxs">
          <Text
            style={{
              ...BrandType.micro,
              color: palette.textMicro,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            {isInstructor ? t("home.instructor.earningsOverview") : "Queue Performance"}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: "Lexend_800ExtraBold",
              fontSize: 46,
              color: palette.text,
              letterSpacing: -1.1,
              includeFontPadding: false,
            }}
          >
            {headlineValue}
            {headlineMinor ? (
              <Text
                style={{
                  fontFamily: "Manrope_600SemiBold",
                  fontSize: 14,
                  color: palette.textMicro,
                }}
              >
                {` ${headlineMinor}`}
              </Text>
            ) : null}
          </Text>
          {subtitle ? (
            <Text
              style={{
                fontFamily: "Manrope_400Regular",
                fontSize: 12,
                fontWeight: "400",
                lineHeight: 16,
                color: palette.textMuted,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </Box>

        <Pressable
          accessibilityRole={onPressAvatar ? "button" : undefined}
          accessibilityLabel={onPressAvatar ? t("home.actions.profileTitle") : undefined}
          onPress={onPressAvatar}
          disabled={!onPressAvatar}
          style={{ borderRadius: 22 }}
        >
          <View style={{ position: "relative" }}>
            <ProfileAvatar
              imageUrl={profileImageUrl}
              fallbackName={displayName}
              size={52}
              roundedSquare
            />
            <KitFloatingBadge
              visible={isVerified}
              size={18}
              motion="none"
              style={{ top: -8, left: 12 }}
            >
              <View style={{ transform: [{ rotate: "-18deg" }] }}>
                <Text style={{ fontSize: 14, lineHeight: 14 }}>{"\u{1F451}"}</Text>
              </View>
            </KitFloatingBadge>
          </View>
        </Pressable>
      </Box>

      <Box flexDirection="row" justifyContent="space-between" gap="xl">
        <Box flex={1} gap="xxs">
          <Text
            style={{
              ...BrandType.micro,
              color: palette.textMicro,
              textTransform: "uppercase",
              letterSpacing: 1.8,
            }}
          >
            {isInstructor ? t("home.shared.totalEarnings") : "Pending Review"}
          </Text>
          <Box flexDirection="row" alignItems="flex-end" gap="xs">
            <Text
              style={{
                fontFamily: "Lexend_800ExtraBold",
                fontSize: 34,
                lineHeight: 34,
                color: palette.primary,
                letterSpacing: -0.8,
                includeFontPadding: false,
              }}
            >
              {isInstructor ? earningsValue : pendingValue}
            </Text>
            {!isInstructor ? (
              <Text
                style={{ ...BrandType.caption, color: palette.textMicro }}
              >{`/ ${progressTarget}`}</Text>
            ) : null}
          </Box>
        </Box>
        <Box flex={1} gap="xxs">
          <Text
            style={{
              ...BrandType.micro,
              color: palette.textMicro,
              textTransform: "uppercase",
              letterSpacing: 1.8,
            }}
          >
            {isInstructor ? t("home.instructor.stillOwed") : "Filled"}
          </Text>
          <Box flexDirection="row" alignItems="flex-end" gap="xs">
            <Text
              style={{
                fontFamily: "Lexend_800ExtraBold",
                fontSize: 34,
                lineHeight: 34,
                color: palette.secondary,
                letterSpacing: -0.8,
                includeFontPadding: false,
              }}
            >
              {isInstructor ? outstandingValue : lessonsValue}
            </Text>
            {!isInstructor ? (
              <IconSymbol name="flame.fill" size={18} color={palette.secondary} />
            ) : null}
          </Box>
        </Box>
      </Box>

      <Box gap="xs">
        <Box flexDirection="row" alignItems="center" justifyContent="space-between">
          <Text
            style={{
              ...BrandType.micro,
              color: palette.textMicro,
              textTransform: "uppercase",
              letterSpacing: 1.8,
            }}
          >
            {isInstructor ? t("home.instructor.payoutProgress") : "Goal Velocity"}
          </Text>
          <Text
            style={{
              ...BrandType.micro,
              color: palette.primary,
              textTransform: "uppercase",
              letterSpacing: 1.8,
            }}
          >
            {isInstructor
              ? t("home.instructor.paidPercent", { percent: progressPercent })
              : `${progressPercent}% Reached`}
          </Text>
        </Box>
        <View
          style={{
            height: 12,
            width: "100%",
            backgroundColor: palette.surfaceAlt,
            borderRadius: BrandRadius.pill,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              backgroundColor: palette.primary,
              borderRadius: BrandRadius.pill,
            }}
          />
        </View>
      </Box>
    </Box>
  );
});
