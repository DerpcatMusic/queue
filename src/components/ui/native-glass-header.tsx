import React from "react";
import { Platform, View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { BlurView, type BlurTint } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBrand } from "@/hooks/use-brand";
import { useThemePreference } from "@/hooks/use-theme-preference";

interface NativeGlassHeaderProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: BlurTint;
}

/**
 * A header component that utilizes iOS 18 liquid glass effects when available,
 * falling back to a standard Material 3 surface container on Android.
 */
export function NativeGlassHeader({
  children,
  style,
  tint = "regular",
}: NativeGlassHeaderProps) {
  const palette = useBrand();
  const { stylePreference } = useThemePreference();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, 12);
  const allowNativeGlass = stylePreference === "native";

  if (Platform.OS === "ios" && allowNativeGlass) {
    // GlassView from expo-glass-effect is highly recommended for iOS 26+
    if (isLiquidGlassAvailable()) {
      return (
        <GlassView
          style={[
            styles.glassHeader,
            { paddingTop: safeTop },
            { borderBottomColor: palette.border },
            style,
          ]}
        >
          {children}
        </GlassView>
      );
    }
    return (
      <BlurView
        tint={tint}
        intensity={100}
        style={[styles.glassHeader, { paddingTop: safeTop, borderBottomColor: palette.border }, style]}
      >
        {children}
      </BlurView>
    );
  }

  // Fallback for Android & Web
  return (
    <View
      style={[
        styles.fallbackHeader,
        {
          paddingTop: safeTop,
          backgroundColor: palette.surfaceElevated,
          borderBottomColor: palette.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  glassHeader: {
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fallbackHeader: {
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
