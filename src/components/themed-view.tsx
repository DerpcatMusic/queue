import { I18nManager, View, type ViewProps } from "react-native";

import { useTheme } from "@/hooks/use-theme";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const { color } = useTheme();
  const backgroundColor = lightColor ?? darkColor ?? color.surface;

  return (
    <View
      style={[{ backgroundColor, direction: I18nManager.isRTL ? "rtl" : "ltr" }, style]}
      {...otherProps}
    />
  );
}
