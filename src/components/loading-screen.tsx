import { ActivityIndicator } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { useBrand } from "@/hooks/use-brand";

type LoadingScreenProps = {
  label?: string;
};

export function LoadingScreen({ label = "Loading..." }: LoadingScreenProps) {
  const palette = useBrand();

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
    >
      <ActivityIndicator size="large" color={palette.primary} />
      <ThemedText type="caption" style={{ color: palette.textMuted }}>
        {label}
      </ThemedText>
    </Animated.View>
  );
}
