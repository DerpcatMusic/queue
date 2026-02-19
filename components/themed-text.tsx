import { I18nManager, StyleSheet, Text, type TextProps } from "react-native";

import { Brand } from "@/constants/brand";
import { useThemeColor } from "@/hooks/use-theme-color";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: "default" | "title" | "defaultSemiBold" | "subtitle" | "link";
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "default",
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor(
    {
      light: lightColor ?? Brand.light.text,
      dark: darkColor ?? Brand.dark.text,
    },
    "text",
  );

  const linkColor = useThemeColor(
    {
      light: Brand.light.primary,
      dark: Brand.dark.primary,
    },
    "tint",
  );

  return (
    <Text
      style={[
        { color },
        { writingDirection: I18nManager.isRTL ? "rtl" : "ltr" },
        type === "default" ? styles.default : undefined,
        type === "title" ? styles.title : undefined,
        type === "defaultSemiBold" ? styles.defaultSemiBold : undefined,
        type === "subtitle" ? styles.subtitle : undefined,
        type === "link" ? [styles.link, { color: linkColor }] : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
  },
  link: {
    lineHeight: 24,
    fontSize: 16,
    fontWeight: "600",
  },
});
