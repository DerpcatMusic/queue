import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { AppSymbol } from "@/components/ui/app-symbol";
import { BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";

type LoadingScreenProps = {
  variant?: "inline" | "launch";
  label?: string;
  title?: string;
  /** @default true */
  showLogo?: boolean;
};

// ─── Launch variant (with logo) ─────────────────────────────────────────────────
function LaunchLoadingScreen({ label }: { label: string }) {
  const theme = useTheme();
  const logoOpacity = useSharedValue(1);

  // Gentle breathe: opacity 1 → 0.45 → 1, ~1.8s per cycle
  logoOpacity.value = withRepeat(
    withSequence(
      withTiming(0.45, {
        duration: 900,
        easing: Easing.inOut(Easing.ease),
      }),
      withTiming(1, {
        duration: 900,
        easing: Easing.inOut(Easing.ease),
      }),
    ),
    -1,
    false,
  );

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.color.primary,
        gap: BrandSpacing.lg,
      }}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <Animated.View style={logoAnimatedStyle}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 22,
            borderCurve: "continuous",
            backgroundColor: theme.color.primaryPressed,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AppSymbol
            name={{ ios: "bolt.fill", android: "bolt", web: "bolt.fill" }}
            size={36}
            tintColor={theme.color.onPrimary}
          />
        </View>
      </Animated.View>

      <ThemedText
        type="caption"
        style={{
          color: theme.color.onPrimary,
          opacity: 0.75,
          textAlign: "center",
        }}
      >
        {label}
      </ThemedText>
    </Animated.View>
  );
}

// ─── Launch variant (no logo) ──────────────────────────────────────────────────
function NoLogoLaunchLoadingScreen({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.color.primary,
      }}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <ActivityIndicator size="large" color={theme.color.onPrimary} />
    </Animated.View>
  );
}

// ─── Inline variant ────────────────────────────────────────────────────────────
function InlineLoadingScreen({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: BrandSpacing.md,
        paddingHorizontal: BrandSpacing.insetRoomy,
        backgroundColor: theme.color.appBg,
      }}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <ActivityIndicator size="large" color={theme.color.primary} />
      <ThemedText type="caption" style={{ color: theme.color.textMuted, textAlign: "center" }}>
        {label}
      </ThemedText>
    </Animated.View>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function LoadingScreen({ variant = "inline", label, showLogo = true }: LoadingScreenProps) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t("common.loading");

  if (variant === "launch") {
    if (!showLogo) {
      return <NoLogoLaunchLoadingScreen label={resolvedLabel} />;
    }
    return <LaunchLoadingScreen label={resolvedLabel} />;
  }

  return <InlineLoadingScreen label={resolvedLabel} />;
}
