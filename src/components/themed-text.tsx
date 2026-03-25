import { I18nManager, Text, type TextProps } from "react-native";

export type ThemedTextType =
  | "display"
  | "heading"
  | "title"
  | "body"
  | "bodyStrong"
  | "bodyMedium"
  | "caption"
  | "labelStrong"
  | "micro"
  | "screenTitle"
  | "sheetTitle"
  | "sectionLabel"
  | "sectionTitle"
  | "cardTitle"
  | "meta"
  | "pillLabel"
  | "buttonLabel"
  | "statValue"
  // Legacy aliases
  | "default"
  | "defaultSemiBold"
  | "subtitle"
  | "link";

export type ThemedTextProps = TextProps & {
  type?: ThemedTextType;
};

// Map semantic types to Tailwind class strings
const TYPE_CLASSES: Record<string, string> = {
  display: "font-display text-display font-bold",
  heading: "font-heading text-heading font-semibold",
  title: "font-title text-title font-medium",
  body: "font-body text-body",
  bodyMedium: "font-body-medium text-body font-medium",
  bodyStrong: "font-body-strong text-body font-semibold",
  caption: "font-body text-caption",
  labelStrong: "font-body-strong text-caption font-semibold",
  micro: "font-label text-micro font-medium",
  screenTitle: "font-heading text-heading font-semibold",
  sheetTitle: "font-title text-title font-medium",
  sectionLabel: "font-label text-micro font-medium uppercase tracking-wide",
  sectionTitle: "font-title text-title font-medium",
  cardTitle: "font-body-strong text-body font-semibold",
  meta: "font-body text-caption",
  pillLabel: "font-label text-micro font-medium",
  buttonLabel: "font-body-medium text-body font-medium",
  statValue: "font-heading text-heading font-semibold",
  // Legacy
  default: "font-body text-body",
  defaultSemiBold: "font-body-strong text-body font-semibold",
  subtitle: "font-title text-title font-medium",
  link: "font-body-strong text-body font-semibold",
};

const LEGACY_MAP: Record<string, ThemedTextType> = {
  default: "body",
  defaultSemiBold: "bodyStrong",
  subtitle: "title",
};

export function ThemedText({ style, type = "body", ...rest }: ThemedTextProps) {
  const resolved = LEGACY_MAP[type] ?? type;
  const classes = TYPE_CLASSES[resolved] ?? TYPE_CLASSES.body ?? "font-body text-body";

  return (
    <Text
      className={classes}
      style={[{ writingDirection: I18nManager.isRTL ? "rtl" : "ltr" }, style]}
      {...rest}
    />
  );
}
