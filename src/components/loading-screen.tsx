import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { AppSymbol } from "@/components/ui/app-symbol";
import { useBrand } from "@/hooks/use-brand";

type LoadingScreenProps = {
  variant?: "inline" | "launch";
  title?: string;
  label?: string;
  showBrandMark?: boolean;
};

export function LoadingScreen({
  variant = "inline",
  title,
  label,
  showBrandMark = true,
}: LoadingScreenProps) {
  const { t } = useTranslation();
  const palette = useBrand();
  const resolvedLabel = label ?? t("common.loading");
  const resolvedTitle = title ?? t("launch.title");

  // Gentle breathing pulse for the symbol
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1200, easing: Easing.out(Easing.exp) }),
        withTiming(1, { duration: 1200, easing: Easing.in(Easing.exp) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(pulse);
    };
  }, [pulse]);

  const symbolStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  if (variant === "launch") {
    return (
      <Animated.View
        entering={FadeIn.duration(400)}
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: palette.surfaceElevated as string }}
        accessibilityRole="progressbar"
        accessibilityLabel={resolvedLabel}
      >
        <Animated.View className="items-center gap-lg" style={symbolStyle}>
          {showBrandMark ? (
            <AppSymbol
              name={{ ios: "bolt.fill", android: "bolt", web: "bolt.fill" }}
              size={32}
              tintColor={palette.primary as string}
            />
          ) : null}
          <View className="items-center gap-1">
            {resolvedTitle ? (
              <ThemedText
                type="title"
                style={{ textAlign: "center", color: palette.text as string }}
                selectable
              >
                {resolvedTitle}
              </ThemedText>
            ) : null}
            <ThemedText
              type="caption"
              style={{ color: palette.textMuted as string, textAlign: "center" }}
              selectable
            >
              {resolvedLabel}
            </ThemedText>
          </View>
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(240)}
      className="flex-1 items-center justify-center gap-lg px-xl"
      style={{ backgroundColor: palette.appBg as string }}
      accessibilityRole="progressbar"
      accessibilityLabel={resolvedLabel}
    >
      <Animated.View className="items-center gap-3">
        {showBrandMark ? (
          <Animated.View style={symbolStyle}>
            <AppSymbol
              name={{ ios: "bolt.fill", android: "bolt", web: "bolt.fill" }}
              size={24}
              tintColor={palette.primary as string}
            />
          </Animated.View>
        ) : null}
        <ThemedText type="caption" style={{ color: palette.textMuted as string }} selectable>
          {resolvedLabel}
        </ThemedText>
      </Animated.View>
    </Animated.View>
  );
}
