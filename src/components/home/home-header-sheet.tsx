import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { KitFloatingBadge } from "@/components/ui/kit/kit-floating-badge";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type { BrandPalette } from "@/constants/brand";
import { BrandSpacing, BrandType } from "@/constants/brand";

const SHEET_EXPANDED_CONTENT_HEIGHT = BrandSpacing.avatarLg + BrandSpacing.lg;
const SHEET_CONTENT_GAP = BrandSpacing.sm;
const AVATAR_SIZE = BrandSpacing.avatarLg;
const BADGE_SIZE = BrandSpacing.lg;

export function getHomeHeaderExpandedHeight(safeTop: number) {
  return safeTop + SHEET_EXPANDED_CONTENT_HEIGHT;
}

export function getHomeHeaderScrollTopPadding(_safeTop: number) {
  // GlobalTopSheet owns the safe top inset now, so page content only needs
  // header content height plus a small gap, not the system inset again.
  return SHEET_EXPANDED_CONTENT_HEIGHT + SHEET_CONTENT_GAP + BrandSpacing.insetRoomy;
}

type HomeHeaderSheetProps = {
  displayName: string;
  subtitle?: string;
  profileImageUrl?: string | null | undefined;
  palette: BrandPalette;
  isVerified?: boolean;
  onPressAvatar?: (() => void) | undefined;
};

export const HomeHeaderSheet = memo(function HomeHeaderSheet({
  displayName,
  subtitle,
  profileImageUrl,
  palette,
  isVerified = false,
  onPressAvatar,
}: HomeHeaderSheetProps) {
  const { t } = useTranslation();

  return (
    <View
      pointerEvents="box-none"
      className="flex-1 flex-row items-center justify-between px-inset-roomy"
      style={{
        paddingTop: BrandSpacing.xs,
        paddingBottom: BrandSpacing.md,
      }}
    >
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text
          numberOfLines={2}
          style={{
            ...BrandType.heading,
            fontSize: 28,
            lineHeight: 32,
            color: palette.onPrimary as string,
            letterSpacing: -0.3,
            paddingTop: 2,
          }}
        >
          {displayName}
        </Text>

        {subtitle ? (
          <Text
            style={{
              ...BrandType.body,
              color: palette.onPrimary as string,
              opacity: 0.7,
              marginTop: BrandSpacing.xs,
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
        className="rounded-soft"
      >
        <View style={{ position: "relative" }}>
          <ProfileAvatar
            imageUrl={profileImageUrl}
            fallbackName={displayName}
            palette={palette}
            size={AVATAR_SIZE}
            roundedSquare
          />
          <KitFloatingBadge
            visible={isVerified}
            size={BADGE_SIZE}
            motion="none"
            style={{ top: -BrandSpacing.md, left: BrandSpacing.lg }}
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
