import { memo } from "react";
import { Text as RNText, type StyleProp, type TextStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native-unistyles";

import type { TypographyToken } from "@/theme/theme";

import type { TextProps } from "./types";

const styles = StyleSheet.create((theme) => ({
  // ─── Typography variants ──────────────────────────────────────────────────────
  variant_display: theme.typography.display,
  variant_displayItalic: theme.typography.displayItalic,
  variant_hero: theme.typography.hero,
  variant_heroItalic: theme.typography.heroItalic,
  variant_heroSmall: theme.typography.heroSmall,
  variant_heroCompact: theme.typography.heroCompact,
  variant_heading: theme.typography.heading,
  variant_headingItalic: theme.typography.headingItalic,
  variant_headingDisplay: theme.typography.headingDisplay,
  variant_titleLarge: theme.typography.titleLarge,
  variant_title: theme.typography.title,
  variant_body: theme.typography.body,
  variant_bodyMedium: theme.typography.bodyMedium,
  variant_bodyStrong: theme.typography.bodyStrong,
  variant_caption: theme.typography.caption,
  variant_labelStrong: theme.typography.labelStrong,
  variant_micro: theme.typography.micro,
  variant_microItalic: theme.typography.microItalic,
  variant_radarLabel: theme.typography.radarLabel,

  // ─── Color variants ─────────────────────────────────────────────────────────
  color_primary: { color: theme.color.primary },
  color_secondary: { color: theme.color.secondary },
  color_tertiary: { color: theme.color.tertiary },
  color_success: { color: theme.color.success },
  color_danger: { color: theme.color.danger },
  color_warning: { color: theme.color.warning },
  color_text: { color: theme.color.text },
  color_textMuted: { color: theme.color.textMuted },
  color_textMicro: { color: theme.color.textMicro },
}));

const variantMap: Record<TypographyToken, string> = {
  display: "variant_display",
  displayItalic: "variant_displayItalic",
  hero: "variant_hero",
  heroItalic: "variant_heroItalic",
  heroSmall: "variant_heroSmall",
  heroCompact: "variant_heroCompact",
  heading: "variant_heading",
  headingItalic: "variant_headingItalic",
  headingDisplay: "variant_headingDisplay",
  titleLarge: "variant_titleLarge",
  title: "variant_title",
  body: "variant_body",
  bodyMedium: "variant_bodyMedium",
  bodyStrong: "variant_bodyStrong",
  caption: "variant_caption",
  labelStrong: "variant_labelStrong",
  micro: "variant_micro",
  microItalic: "variant_microItalic",
  radarLabel: "variant_radarLabel",
};

const colorMap: Record<string, string> = {
  primary: "color_primary",
  secondary: "color_secondary",
  tertiary: "color_tertiary",
  success: "color_success",
  danger: "color_danger",
  warning: "color_warning",
  text: "color_text",
  textMuted: "color_textMuted",
  textMicro: "color_textMicro",
};

export const Text = memo(function Text({
  variant = "body",
  color,
  style,
  children,
  ...rest
}: TextProps) {
  const { i18n } = useTranslation();
  const variantStyle = (styles as Record<string, TextStyle>)[variantMap[variant] ?? "variant_body"];
  const colorStyle = color
    ? (styles as Record<string, TextStyle>)[colorMap[color] ?? `color_${color}`]
    : undefined;
  const isRtl = (i18n.resolvedLanguage ?? i18n.language ?? "en").toLowerCase().startsWith("he");

  return (
    <RNText
      {...rest}
      style={
        [
          variantStyle,
          colorStyle,
          {
            includeFontPadding: false,
            writingDirection: isRtl ? ("rtl" as const) : ("ltr" as const),
            textAlign: "auto" as const,
          },
          style,
        ] as StyleProp<TextStyle>
      }
    >
      {children}
    </RNText>
  );
});
