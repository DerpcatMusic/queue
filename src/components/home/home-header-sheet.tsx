import { Pressable, Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { TopSheetSurface } from "@/components/layout/top-sheet-surface";
import { KitFloatingBadge } from "@/components/ui/kit";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type { BrandPalette } from "@/constants/brand";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { useAppInsets } from "@/hooks/use-app-insets";

const SHEET_EXPANDED_CONTENT_HEIGHT = 92;
const SHEET_CONTRACTED_CONTENT_HEIGHT = 82;
const SHEET_CONTENT_GAP = BrandSpacing.md;

export function getHomeHeaderExpandedHeight(safeTop: number) {
  return safeTop + SHEET_EXPANDED_CONTENT_HEIGHT;
}

export function getHomeHeaderScrollTopPadding(_safeTop: number) {
  // Now that TopSheetSurface uses marginTop: safeTop (natural flow),
  // padding should only account for content height + gap, not safeTop.
  return SHEET_EXPANDED_CONTENT_HEIGHT + SHEET_CONTENT_GAP;
}

// Scroll range over which the sheet transitions
const SCROLL_EXPAND_START = 0;
const SCROLL_EXPAND_END = 80;

type HomeHeaderSheetProps = {
  displayName: string;
  subtitle?: string;
  profileImageUrl?: string | null | undefined;
  scrollY: SharedValue<number>;
  palette: BrandPalette;
  isVerified?: boolean;
  onPressAvatar?: (() => void) | undefined;
};

export function HomeHeaderSheet({
  displayName,
  subtitle,
  profileImageUrl,
  scrollY,
  palette,
  isVerified = false,
  onPressAvatar,
}: HomeHeaderSheetProps) {
  const { safeTop } = useAppInsets();
  const expandedHeight = getHomeHeaderExpandedHeight(safeTop);
  const contractedHeight = safeTop + SHEET_CONTRACTED_CONTENT_HEIGHT;

  // 0 = expanded, 1 = contracted
  const animatedSheetStyle = useAnimatedStyle(() => {
    const contentHeight = interpolate(
      scrollY.value,
      [SCROLL_EXPAND_START, SCROLL_EXPAND_END],
      [expandedHeight, contractedHeight],
      Extrapolation.CLAMP,
    );
    return {
      height: contentHeight,
    };
  });

  // Name shrinking animation
  const identityWrapStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [SCROLL_EXPAND_START, SCROLL_EXPAND_END * 1.5],
      [1, 0.4],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateX: interpolate(
          scrollY.value,
          [SCROLL_EXPAND_START, SCROLL_EXPAND_END],
          [0, -6],
          Extrapolation.CLAMP,
        ),
      },
      {
        translateY: interpolate(
          scrollY.value,
          [SCROLL_EXPAND_START, SCROLL_EXPAND_END],
          [0, -4],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const nameStyle = useAnimatedStyle(() => {
    const fontSize = interpolate(
      scrollY.value,
      [SCROLL_EXPAND_START, SCROLL_EXPAND_END],
      [32, 26],
      Extrapolation.CLAMP,
    );
    const lineHeight = interpolate(
      scrollY.value,
      [SCROLL_EXPAND_START, SCROLL_EXPAND_END],
      [36, 30],
      Extrapolation.CLAMP,
    );
    return {
      fontSize,
      lineHeight,
    };
  });

  const subtitleStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        scrollY.value,
        [SCROLL_EXPAND_START, SCROLL_EXPAND_END * 0.7],
        [1, 0],
        Extrapolation.CLAMP,
      ),
      height: interpolate(
        scrollY.value,
        [SCROLL_EXPAND_START, SCROLL_EXPAND_END * 0.7],
        [18, 0],
        Extrapolation.CLAMP,
      ),
      marginTop: interpolate(
        scrollY.value,
        [SCROLL_EXPAND_START, SCROLL_EXPAND_END * 0.7],
        [2, 0],
        Extrapolation.CLAMP,
      ),
      overflow: "hidden" as const,
    };
  });

  const profileAvatarStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          scrollY.value,
          [SCROLL_EXPAND_START, SCROLL_EXPAND_END],
          [1.12, 0.68],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const bg = palette.primary as string;

  return (
    <TopSheetSurface
      pointerEvents="box-none"
      backgroundColor={bg}
      topInsetColor={bg}
      style={[
        {
          backgroundColor: bg,
          // NO absolute - uses marginTop from TopSheetSurface
          overflow: "hidden",
          zIndex: 10,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          borderCurve: "continuous",
        } as unknown as object,
        animatedSheetStyle,
      ]}
    >
      <View
        pointerEvents="box-none"
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: BrandSpacing.xl,
          paddingTop: safeTop + BrandSpacing.sm,
          paddingBottom: BrandSpacing.lg,
        }}
      >
        {/* Name Area (Dynamic Shrinking) */}
        <Animated.View style={[{ flex: 1, justifyContent: "center" }, identityWrapStyle]}>
          <Animated.Text
            numberOfLines={2}
            style={[
              {
                ...BrandType.display,
                color: palette.onPrimary as string,
                letterSpacing: -0.6,
                paddingTop: 2,
              },
              nameStyle,
            ]}
          >
            {displayName}
          </Animated.Text>

          {subtitle ? (
            <Animated.View style={subtitleStyle}>
              <Text
                style={{
                  ...BrandType.caption,
                  color: palette.onPrimary as string,
                  opacity: 0.72,
                }}
              >
                {subtitle}
              </Text>
            </Animated.View>
          ) : null}
        </Animated.View>

        <Pressable
          accessibilityRole={onPressAvatar ? "button" : undefined}
          accessibilityLabel={onPressAvatar ? "Open profile" : undefined}
          onPress={onPressAvatar}
          disabled={!onPressAvatar}
          style={{ borderRadius: 24 }}
        >
          <Animated.View style={[{ position: "relative" }, profileAvatarStyle]}>
            <ProfileAvatar
              imageUrl={profileImageUrl}
              fallbackName={displayName}
              palette={palette}
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
          </Animated.View>
        </Pressable>
      </View>
    </TopSheetSurface>
  );
}
