import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { AppSymbol } from "@/components/ui/app-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";

// Loading screen uses a large centered launch icon with concentric rings
const LAUNCH_ICON_SIZE = BrandSpacing.haloSize; // 180px - matches brand halo size for visual impact
const LAUNCH_ICON_RADIUS = LAUNCH_ICON_SIZE / 2; // 90px
const LAUNCH_INNER_SIZE = BrandSpacing.iconContainerLarge + BrandSpacing.xl; // 78 + 24 = 102px
const LAUNCH_INNER_RADIUS = BrandRadius.soft; // 24px - matches card radius
const LAUNCH_SYMBOL_WRAPPER_SIZE = BrandSpacing.iconContainerLarge; // 78px
const LAUNCH_SYMBOL_WRAPPER_RADIUS = BrandRadius.medium; // 18px

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

  if (variant === "launch") {
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        style={{
          flex: 1,
          backgroundColor: palette.primary as string,
        }}
        accessibilityRole="progressbar"
        accessibilityLabel={resolvedLabel}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: BrandSpacing.xl,
            paddingVertical: BrandSpacing.section,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center justify-center gap-section">
            <Animated.View
              entering={FadeInUp.duration(420)}
              style={{
                width: LAUNCH_ICON_SIZE,
                height: LAUNCH_ICON_SIZE,
                borderRadius: LAUNCH_ICON_RADIUS,
                backgroundColor: palette.onPrimary as string,
                opacity: 0.1,
                position: "absolute",
              }}
            />
            <Animated.View
              entering={FadeInDown.duration(380)}
              style={{
                width: LAUNCH_INNER_SIZE,
                height: LAUNCH_INNER_SIZE,
                borderRadius: LAUNCH_INNER_RADIUS,
                borderCurve: "continuous",
                backgroundColor: palette.surfaceAlt as string,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {showBrandMark ? (
                <View
                  style={{
                    width: LAUNCH_SYMBOL_WRAPPER_SIZE,
                    height: LAUNCH_SYMBOL_WRAPPER_SIZE,
                    borderRadius: LAUNCH_SYMBOL_WRAPPER_RADIUS,
                    borderCurve: "continuous",
                    backgroundColor: palette.surface as string,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AppSymbol
                    name={{ ios: "bolt.fill", android: "bolt", web: "bolt.fill" }}
                    size={32}
                    tintColor={palette.primary as string}
                  />
                </View>
              ) : null}
            </Animated.View>
            <Animated.View
              entering={FadeInUp.delay(60).duration(420)}
              className="items-center gap-stack-tight"
            >
              <ThemedText
                type="title"
                style={{ textAlign: "center", color: palette.onPrimary as string }}
                selectable
              >
                {resolvedTitle}
              </ThemedText>
              <ThemedText
                type="caption"
                style={{
                  color: palette.onPrimary as string,
                  opacity: 0.78,
                  textAlign: "center",
                }}
                selectable
              >
                {resolvedLabel}
              </ThemedText>
            </Animated.View>
            <Animated.View entering={FadeInUp.delay(120).duration(420)}>
              <ActivityIndicator size="large" color={palette.onPrimary as string} />
            </Animated.View>
          </View>
        </ScrollView>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(240)}
      className="flex-1 items-center justify-center gap-lg px-xl"
      style={{
        backgroundColor: palette.appBg,
      }}
      accessibilityRole="progressbar"
      accessibilityLabel={resolvedLabel}
    >
      <ActivityIndicator size="large" color={palette.primary} />
      <ThemedText type="caption" style={{ color: palette.textMuted }} selectable>
        {resolvedLabel}
      </ThemedText>
    </Animated.View>
  );
}
