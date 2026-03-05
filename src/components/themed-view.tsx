import { I18nManager, View, type ViewProps } from "react-native";

import { useBrand } from "@/hooks/use-brand";
import { useThemeColor } from "@/hooks/use-theme-color";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const palette = useBrand();
  const backgroundColor = useThemeColor({
    light: lightColor ?? (palette.surface as string),
    dark: darkColor ?? (palette.surface as string),
  });

  return (
    <View
      style={[{ backgroundColor, direction: I18nManager.isRTL ? "rtl" : "ltr" }, style]}
      {...otherProps}
    />
  );
}
