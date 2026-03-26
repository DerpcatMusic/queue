import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitFloatingBadge } from "@/components/ui/kit/kit-floating-badge";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Box } from "@/primitives";

const SHEET_EXPANDED_CONTENT_HEIGHT = 196;
const SHEET_CONTENT_GAP = BrandSpacing.sm;

export function getHomeHeaderExpandedHeight(safeTop: number) {
  return safeTop + SHEET_EXPANDED_CONTENT_HEIGHT;
}

export function getHomeHeaderScrollTopPadding(_safeTop: number) {
  // GlobalTopSheet owns the safe top inset now, so page content only needs
  // header content height plus a small gap, not the system inset again.
  return SHEET_EXPANDED_CONTENT_HEIGHT + SHEET_CONTENT_GAP + BrandSpacing.xl;
}

type HomeHeaderSheetProps = {
  displayName: string;
  subtitle?: string;
  profileImageUrl?: string | null | undefined;
  isVerified?: boolean;
  onPressAvatar?: (() => void) | undefined;
  // Performance metrics
  lessonsCompleted?: number;
  totalEarningsLabel?: string;
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
  pendingApplications,
  openJobs,
  role = "instructor",
}: HomeHeaderSheetProps) {
  const { color: palette } = useTheme();
  const { t } = useTranslation();

  const earningsValue = totalEarningsLabel ?? "0";
  const lessonsValue = String(lessonsCompleted ?? 0);
  const pendingValue = String(pendingApplications ?? 0);
  const jobsValue = String(openJobs ?? 0);
  const headlineValue = role === "instructor" ? earningsValue : jobsValue;
  const headlineMinor = role === "instructor" ? undefined : t("home.actions.jobsTitle");
  const progressCurrent =
    role === "instructor" ? Number(lessonsCompleted ?? 0) : Number(openJobs ?? 0);
  const progressTarget = Math.max(progressCurrent + Number(pendingApplications ?? 0), 1);
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round((progressCurrent / progressTarget) * 100)),
  );

  return (
    <Box
      pointerEvents="box-none"
      style={{
        minHeight: SHEET_EXPANDED_CONTENT_HEIGHT,
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
            {role === "instructor" ? "Weekly Performance" : "Queue Performance"}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: "Lexend_900Black",
              fontSize: 46,
              fontStyle: "italic",
              fontWeight: "900",
              lineHeight: 46,
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
            {role === "instructor" ? "Completed Missions" : "Pending Review"}
          </Text>
          <Box flexDirection="row" alignItems="flex-end" gap="xs">
            <Text
              style={{
                fontFamily: "Lexend_800ExtraBold",
                fontSize: 34,
                fontStyle: "italic",
                lineHeight: 34,
                color: palette.primary,
                letterSpacing: -0.8,
                includeFontPadding: false,
              }}
            >
              {role === "instructor" ? lessonsValue : pendingValue}
            </Text>
            <Text
              style={{ ...BrandType.caption, color: palette.textMicro }}
            >{`/ ${progressTarget}`}</Text>
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
            {role === "instructor" ? "Open Matches" : "Filled"}
          </Text>
          <Box flexDirection="row" alignItems="flex-end" gap="xs">
            <Text
              style={{
                fontFamily: "Lexend_800ExtraBold",
                fontSize: 34,
                fontStyle: "italic",
                lineHeight: 34,
                color: palette.secondary,
                letterSpacing: -0.8,
                includeFontPadding: false,
              }}
            >
              {role === "instructor" ? jobsValue : lessonsValue}
            </Text>
            <IconSymbol name="flame.fill" size={18} color={palette.secondary} />
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
            Goal Velocity
          </Text>
          <Text
            style={{
              ...BrandType.micro,
              color: palette.primary,
              textTransform: "uppercase",
              letterSpacing: 1.8,
            }}
          >
            {`${progressPercent}% Reached`}
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
