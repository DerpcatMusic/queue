import { useEffect } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { KitFloatingBadge } from "@/components/ui/kit";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type { BrandPalette } from "@/constants/brand";
import { BrandSpacing } from "@/constants/brand";
import { useSystemUi } from "@/contexts/system-ui-context";
import { toSportLabel } from "@/convex/constants";
import { useAppInsets } from "@/hooks/use-app-insets";

const SHEET_EXPANDED_CONTENT_HEIGHT = 168;
const SHEET_CONTRACTED_CONTENT_HEIGHT = 88;
const SHEET_CONTENT_GAP = BrandSpacing.md;

export function getHomeHeaderExpandedHeight(safeTop: number) {
  return safeTop + SHEET_EXPANDED_CONTENT_HEIGHT;
}

export function getHomeHeaderScrollTopPadding(safeTop: number) {
  const automaticTopInset = Platform.OS === "ios" ? safeTop : 0;
  return getHomeHeaderExpandedHeight(safeTop) - automaticTopInset + SHEET_CONTENT_GAP;
}

// Scroll range over which the sheet transitions
const SCROLL_EXPAND_START = 0;
const SCROLL_EXPAND_END = 100;

type HomeHeaderSheetProps = {
  displayName: string;
  profileImageUrl?: string | null | undefined;
  scrollY: SharedValue<number>;
  palette: BrandPalette;
  statsLabel?: string;
  statsValue?: string;
  extraStatsLabel?: string;
  extraStatsValue?: string;
  isVerified?: boolean;
  sports?: string[] | undefined;
  onPressAvatar?: (() => void) | undefined;
};

export function HomeHeaderSheet({
  displayName,
  profileImageUrl,
  scrollY,
  palette,
  statsLabel,
  statsValue,
  extraStatsLabel,
  extraStatsValue,
  isVerified = false,
  sports,
  onPressAvatar,
}: HomeHeaderSheetProps) {
  const { setTopInsetBackgroundColor } = useSystemUi();
  const { safeTop } = useAppInsets();
  const expandedHeight = getHomeHeaderExpandedHeight(safeTop);
  const contractedHeight = safeTop + SHEET_CONTRACTED_CONTENT_HEIGHT;

  useEffect(() => {
    setTopInsetBackgroundColor(palette.surfaceAlt);
    return () => {
      setTopInsetBackgroundColor(null);
    };
  }, [palette.surfaceAlt, setTopInsetBackgroundColor]);

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
      [SCROLL_EXPAND_START, SCROLL_EXPAND_END * 0.72, SCROLL_EXPAND_END],
      [1, 0.3, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateX: interpolate(
          scrollY.value,
          [SCROLL_EXPAND_START, SCROLL_EXPAND_END],
          [0, -10],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const nameStyle = useAnimatedStyle(() => {
    const fontSize = interpolate(
      scrollY.value,
      [SCROLL_EXPAND_START, SCROLL_EXPAND_END],
      [42, 30],
      Extrapolation.CLAMP,
    );
    const lineHeight = interpolate(
      scrollY.value,
      [SCROLL_EXPAND_START, SCROLL_EXPAND_END],
      [52, 36],
      Extrapolation.CLAMP,
    );
    return {
      fontSize,
      lineHeight,
    };
  });

  const expandedSubtitleStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        scrollY.value,
        [SCROLL_EXPAND_START, SCROLL_EXPAND_END * 0.8],
        [1, 0],
        Extrapolation.CLAMP,
      ),
      maxHeight: interpolate(
        scrollY.value,
        [SCROLL_EXPAND_START, SCROLL_EXPAND_END * 0.8],
        [24, 0],
        Extrapolation.CLAMP,
      ),
      marginTop: interpolate(
        scrollY.value,
        [SCROLL_EXPAND_START, SCROLL_EXPAND_END * 0.8],
        [2, 0],
        Extrapolation.CLAMP,
      ),
      overflow: "hidden" as const,
    };
  });

  const expandedSportsStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        scrollY.value,
        [SCROLL_EXPAND_START, SCROLL_EXPAND_END * 0.75],
        [1, 0],
        Extrapolation.CLAMP,
      ),
      maxHeight: interpolate(
        scrollY.value,
        [SCROLL_EXPAND_START, SCROLL_EXPAND_END * 0.75],
        [44, 0],
        Extrapolation.CLAMP,
      ),
      marginTop: interpolate(
        scrollY.value,
        [SCROLL_EXPAND_START, SCROLL_EXPAND_END * 0.75],
        [12, 0],
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

  const bg = palette.surfaceAlt as string;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          backgroundColor: bg,
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.08)",
          borderCurve: "continuous",
          overflow: "hidden",
          zIndex: 10,
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
            numberOfLines={1}
            style={[
              {
                fontFamily: "Sekuya-Regular",
                color: palette.text as string,
                letterSpacing: -0.5,
                paddingTop: 2,
              },
              nameStyle,
            ]}
          >
            {displayName}
          </Animated.Text>

          {/* Expanded Stats Subtitle */}
          {(statsLabel && statsValue) || (extraStatsLabel && extraStatsValue) ? (
            <Animated.View
              style={[
                { flexDirection: "row", gap: 6, alignItems: "baseline" },
                expandedSubtitleStyle,
              ]}
            >
              {statsLabel && statsValue ? (
                <>
                  <Text
                    style={{
                      fontFamily: "Rubik_700Bold",
                      fontSize: 13,
                      color: palette.primary as string,
                    }}
                  >
                    {statsValue}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Rubik_600SemiBold",
                      fontSize: 13,
                      color: palette.text as string,
                      opacity: 0.8,
                    }}
                  >
                    {statsLabel}
                  </Text>
                </>
              ) : null}
              {extraStatsLabel && extraStatsValue ? (
                <>
                  <Text
                    style={{
                      fontFamily: "Rubik_600SemiBold",
                      fontSize: 12,
                      color: palette.textMuted as string,
                    }}
                  >
                    {"*"}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Rubik_700Bold",
                      fontSize: 13,
                      color: palette.text as string,
                    }}
                  >
                    {extraStatsValue}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Rubik_600SemiBold",
                      fontSize: 12,
                      color: palette.textMuted as string,
                    }}
                  >
                    {extraStatsLabel}
                  </Text>
                </>
              ) : null}
            </Animated.View>
          ) : null}

          {/* Sports List (Expanded State Only) */}
          {sports && sports.length > 0 && (
            <Animated.View style={expandedSportsStyle}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {sports.map((sport) => (
                  <View
                    key={sport}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.06)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Rubik_500Medium",
                        fontSize: 11,
                        color: palette.textMuted as string,
                      }}
                    >
                      {toSportLabel(sport as never)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </Animated.View>
          )}
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
    </Animated.View>
  );
}
