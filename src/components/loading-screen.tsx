import { useTranslation } from "react-i18next";
import { ActivityIndicator } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { useBrand } from "@/hooks/use-brand";

type LoadingScreenProps = {
  label?: string;
};

export function LoadingScreen({ label }: LoadingScreenProps) {
  const { t } = useTranslation();
  const palette = useBrand();
  const resolvedLabel = label ?? t("common.loading");

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
