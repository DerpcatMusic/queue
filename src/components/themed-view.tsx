// Deprecated during primitive-first migration.
// Prefer src/primitives/box.tsx for new code.
import { View, type ViewProps } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/hooks/use-theme";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const { color } = useTheme();
  const backgroundColor = lightColor ?? darkColor ?? color.surface;
  const { i18n } = useTranslation();
  const isRtl = (i18n.resolvedLanguage ?? i18n.language ?? "en").toLowerCase().startsWith("he");

  return (
    <View
      style={[{ backgroundColor, direction: isRtl ? "rtl" : "ltr" }, style]}
      {...otherProps}
    />
  );
}
