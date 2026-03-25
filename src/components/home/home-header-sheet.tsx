import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { KitFloatingBadge } from "@/components/ui/kit/kit-floating-badge";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";

const SHEET_EXPANDED_CONTENT_HEIGHT = 84;
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
};

export const HomeHeaderSheet = memo(function HomeHeaderSheet({
  displayName,
  subtitle,
  profileImageUrl,
  isVerified = false,
  onPressAvatar,
}: HomeHeaderSheetProps) {
  const { color: palette } = useTheme();
  const { t } = useTranslation();

  return (
    <View
      pointerEvents="box-none"
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: BrandSpacing.xl,
        paddingTop: 2,
        paddingBottom: BrandSpacing.md,
      }}
    >
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text
          numberOfLines={2}
          style={{
            fontFamily: "Lexend_600SemiBold",
            fontSize: 28,
            fontWeight: "600",
            lineHeight: 32,
            color: palette.onPrimary,
            letterSpacing: -0.3,
            paddingTop: 2,
          }}
        >
          {displayName}
        </Text>

        {subtitle ? (
          <Text
            style={{
              fontFamily: "Manrope_400Regular",
              fontSize: 16,
              fontWeight: "400",
              lineHeight: 22,
              color: palette.onPrimary,
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole={onPressAvatar ? "button" : undefined}
        accessibilityLabel={onPressAvatar ? t("home.actions.profileTitle") : undefined}
        onPress={onPressAvatar}
        disabled={!onPressAvatar}
        style={{ borderRadius: 24 }}
      >
        <View style={{ position: "relative" }}>
          <ProfileAvatar
            imageUrl={profileImageUrl}
            fallbackName={displayName}
            size={68}
            roundedSquare
          />
          <KitFloatingBadge
            visible={isVerified}
            size={22}
            motion="none"
            style={{ top: -12, left: 16 }}
          >
            <View style={{ transform: [{ rotate: "-18deg" }] }}>
              <Text
                style={{
                  fontSize: 18,
                  lineHeight: 18,
                }}
              >
                {"\u{1F451}"}
              </Text>
            </View>
          </KitFloatingBadge>
        </View>
      </Pressable>
    </View>
  );
});
