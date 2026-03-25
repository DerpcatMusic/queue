import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { AppSymbol } from "@/components/ui/app-symbol";
import { BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";

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
  const theme = useTheme();
  const resolvedLabel = label ?? t("common.loading");
  const resolvedTitle = title ?? t("launch.title");

  if (variant === "launch") {
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        style={{
          flex: 1,
          backgroundColor: theme.color.primary,
        }}
        accessibilityRole="progressbar"
        accessibilityLabel={resolvedLabel}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: BrandSpacing.insetRoomy,
            paddingVertical: BrandSpacing.section + BrandSpacing.sm, // 32+8=40
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
                backgroundColor: theme.color.primaryPressed,
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
                backgroundColor: theme.color.primarySubtle,
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
                    backgroundColor: theme.color.surface,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AppSymbol
                    name={{ ios: "bolt.fill", android: "bolt", web: "bolt.fill" }}
                    size={32}
                    tintColor={theme.color.primary}
                  />
                </View>
              ) : null}
            </Animated.View>
            <Animated.View
              entering={FadeInUp.delay(60).duration(420)}
              style={{ gap: BrandSpacing.sm, alignItems: "center" }}
            >
              <ThemedText
                type="title"
                style={{ textAlign: "center", color: theme.color.onPrimary }}
                selectable
              >
                {resolvedTitle}
              </ThemedText>
              <ThemedText
                type="caption"
                style={{
                  color: theme.color.onPrimary,
                  textAlign: "center",
                }}
                selectable
              >
                {resolvedLabel}
              </ThemedText>
            </Animated.View>
            <Animated.View entering={FadeInUp.delay(120).duration(420)}>
              <ActivityIndicator size="large" color={theme.color.onPrimary} />
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
        gap: BrandSpacing.lg,
        paddingHorizontal: BrandSpacing.insetRoomy,
        backgroundColor: theme.color.appBg,
      }}
      accessibilityRole="progressbar"
      accessibilityLabel={resolvedLabel}
    >
      <ActivityIndicator size="large" color={theme.color.primary} />
      <ThemedText type="caption" style={{ color: theme.color.textMuted }} selectable>
        {resolvedLabel}
      </ThemedText>
    </Animated.View>
  );
}
