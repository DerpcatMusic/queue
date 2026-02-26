import { toSportLabel } from "@/convex/constants";
import { BrandSpacing } from "@/constants/brand";
import { AppSymbol } from "@/components/ui/app-symbol";
import type { BrandPalette } from "@/constants/brand";
import { useSystemUi } from "@/contexts/system-ui-context";
import { useEffect } from "react";
import { Text, View, ScrollView } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  SharedValue,
  Extrapolation,
} from "react-native-reanimated";

const SHEET_EXPANDED_HEIGHT = 168; // Increased from 136
const SHEET_CONTRACTED_HEIGHT = 68;

// Scroll range over which the sheet transitions
const SCROLL_EXPAND_START = 0;
const SCROLL_EXPAND_END = 100;

type HomeHeaderSheetProps = {
  displayName: string;
  scrollY: SharedValue<number>;
  palette: BrandPalette;
  statsLabel?: string;
  statsValue?: string;
  extraStatsLabel?: string;
  extraStatsValue: string;
  sports?: string[] | undefined;
};

export function HomeHeaderSheet({
  displayName,
  scrollY,
  palette,
  statsLabel,
  statsValue,
  extraStatsLabel,
  extraStatsValue,
  sports,
}: HomeHeaderSheetProps) {
  const { setTopInsetBackgroundColor } = useSystemUi();

  useEffect(() => {
    setTopInsetBackgroundColor(palette.surface);
    return () => {
      setTopInsetBackgroundColor(null);
    };
  }, [palette.surface, setTopInsetBackgroundColor]);

  // 0 = expanded, 1 = contracted
  const animatedSheetStyle = useAnimatedStyle(() => {
    const contentHeight = interpolate(
      scrollY.value,
      [SCROLL_EXPAND_START, SCROLL_EXPAND_END],
      [SHEET_EXPANDED_HEIGHT, SHEET_CONTRACTED_HEIGHT],
      Extrapolation.CLAMP,
    );
    return {
      height: contentHeight,
    };
  });

  // Name shrinking animation
  const nameStyle = useAnimatedStyle(() => {
    const fontSize = interpolate(
      scrollY.value,
      [SCROLL_EXPAND_START, SCROLL_EXPAND_END],
      [42, 18],
      Extrapolation.CLAMP,
    );
    const lineHeight = interpolate(
      scrollY.value,
      [SCROLL_EXPAND_START, SCROLL_EXPAND_END],
      [52, 26],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [SCROLL_EXPAND_START, SCROLL_EXPAND_END],
      [0, 0],
      Extrapolation.CLAMP,
    );
    return {
      fontSize,
      lineHeight,
      transform: [{ translateY }],
    };
  });

  const statsPillStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [SCROLL_EXPAND_START, SCROLL_EXPAND_END * 0.8],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      scrollY.value,
      [SCROLL_EXPAND_START, SCROLL_EXPAND_END],
      [1, 0.8],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ scale }] };
  });

  const contractedPillStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [SCROLL_EXPAND_END * 0.4, SCROLL_EXPAND_END],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const translateX = interpolate(
      scrollY.value,
      [SCROLL_EXPAND_END * 0.4, SCROLL_EXPAND_END],
      [20, 0],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ translateX }] };
  });

  const bg = palette.surface as string;

  return (
    <Animated.View
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
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
        } as unknown as object,
        animatedSheetStyle,
      ]}
    >

      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: BrandSpacing.xl,
          paddingTop: BrandSpacing.lg,
          paddingBottom: BrandSpacing.lg,
        }}
      >
        {/* Name Area (Dynamic Shrinking) */}
        <View style={{ flex: 1, justifyContent: "center" }}>
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
          {statsLabel && statsValue && (
            <Animated.View style={[{ flexDirection: "row", gap: 6, marginTop: 2 }, statsPillStyle]}>
              <Text style={{ fontFamily: "Rubik_700Bold", fontSize: 13, color: palette.primary as string }}>
                {statsValue}
              </Text>
              <Text style={{ fontFamily: "Rubik_600SemiBold", fontSize: 13, color: palette.text as string, opacity: 0.8 }}>
                {statsLabel}
              </Text>
            </Animated.View>
          )}

          {/* Sports List (Expanded State Only) */}
          {sports && sports.length > 0 && (
            <Animated.View style={[{ marginTop: 12 }, statsPillStyle]}>
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
                    <Text style={{ fontFamily: "Rubik_500Medium", fontSize: 11, color: palette.textMuted as string }}>
                      {toSportLabel(sport as never)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </Animated.View>
          )}
        </View>

        {/* Contracted Premium Pill */}
        {extraStatsValue && (
          <Animated.View
            style={[
              {
                backgroundColor: palette.surfaceAlt as string,
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 8,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.05)",
              },
              contractedPillStyle,
            ]}
          >
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: palette.primary as string, alignItems: "center", justifyContent: "center" }}>
              <AppSymbol name="creditcard.fill" size={14} tintColor="#FFFFFF" />
            </View>
            <View>
              <Text style={{ fontFamily: "Rubik_700Bold", fontSize: 15, color: palette.text as string }}>
                {extraStatsValue}
              </Text>
              {extraStatsLabel && (
                <Text style={{ fontFamily: "Rubik_600SemiBold", fontSize: 9, color: palette.text as string, opacity: 0.5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {extraStatsLabel}
                </Text>
              )}
            </View>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}
