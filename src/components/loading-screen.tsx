import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

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
            paddingHorizontal: 24,
            paddingVertical: 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              gap: 26,
            }}
          >
            <Animated.View
              entering={FadeInUp.duration(420)}
              style={{
                width: 236,
                height: 236,
                borderRadius: 118,
                backgroundColor: "rgba(255,255,255,0.1)",
                position: "absolute",
              }}
            />
            <Animated.View
              entering={FadeInDown.duration(380)}
              style={{
                width: 112,
                height: 112,
                borderRadius: 36,
                borderCurve: "continuous",
                backgroundColor: "rgba(255,255,255,0.14)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {showBrandMark ? (
                <View
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 28,
                    borderCurve: "continuous",
                    backgroundColor: "rgba(255,255,255,0.94)",
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
              style={{ gap: 8, alignItems: "center" }}
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
                  color: "rgba(255,255,255,0.78)",
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
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        paddingHorizontal: 24,
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
