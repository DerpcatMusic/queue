import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

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
          backgroundColor: palette.appBg,
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
              gap: 22,
            }}
          >
            <View
              style={{
                width: 184,
                height: 184,
                borderRadius: 999,
                backgroundColor: palette.primarySubtle as string,
                opacity: 0.9,
                position: "absolute",
              }}
            />
            <View
              style={{
                width: "100%",
                maxWidth: 380,
                borderRadius: 32,
                borderCurve: "continuous",
                paddingHorizontal: 28,
                paddingVertical: 32,
                gap: 18,
                alignItems: "center",
                backgroundColor: palette.surface as string,
                borderWidth: 1,
                borderColor: palette.border as string,
              }}
            >
              {showBrandMark ? (
                <View
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 28,
                    borderCurve: "continuous",
                    backgroundColor: palette.primary as string,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AppSymbol
                    name={{ ios: "bolt.fill", android: "bolt", web: "bolt.fill" }}
                    size={34}
                    tintColor={palette.onPrimary as string}
                  />
                </View>
              ) : null}
              <View style={{ gap: 8, alignItems: "center" }}>
                <ThemedText type="title" style={{ textAlign: "center" }} selectable>
                  {resolvedTitle}
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: palette.textMuted, textAlign: "center" }}
                  selectable
                >
                  {resolvedLabel}
                </ThemedText>
              </View>
              <ActivityIndicator size="large" color={palette.primary as string} />
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
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
