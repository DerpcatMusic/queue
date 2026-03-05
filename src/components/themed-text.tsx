import { I18nManager, Text, type TextProps } from "react-native";

import { BrandType } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import { useThemeColor } from "@/hooks/use-theme-color";

export type ThemedTextType =
  | "display"
  | "heading"
  | "title"
  | "body"
  | "bodyStrong"
  | "caption"
  | "micro"
  // Legacy aliases — kept for backwards compatibility
  | "default"
  | "defaultSemiBold"
  | "subtitle"
  | "link";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemedTextType;
};

const LEGACY_TYPE_MAP: Partial<Record<string, ThemedTextType>> = {
  default: "body",
  defaultSemiBold: "bodyStrong",
  subtitle: "title",
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "body",
  ...rest
}: ThemedTextProps) {
  const resolved = (LEGACY_TYPE_MAP[type as string] ?? type) as ThemedTextType;
  const palette = useBrand();

  const color = useThemeColor({
    light: lightColor ?? (palette.text as string),
    dark: darkColor ?? (palette.text as string),
  });

  const linkColor = palette.primary;

  const typeStyle =
    resolved === "link"
      ? { ...BrandType.body, fontWeight: "600" as const, color: linkColor }
      : (BrandType[resolved as keyof typeof BrandType] ?? BrandType.body);

  return (
    <Text
      style={[{ color }, { writingDirection: I18nManager.isRTL ? "rtl" : "ltr" }, typeStyle, style]}
      {...rest}
    />
  );
}
