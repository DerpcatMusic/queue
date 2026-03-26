// Deprecated during primitive-first migration.
// Prefer src/primitives/text.tsx for new code.
import { I18nManager, Text, type TextProps, type TextStyle } from "react-native";
import { BrandType } from "@/theme/theme";

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

const TYPE_STYLES: Record<ThemedTextType, TextStyle> = {
  display: BrandType.display,
  heading: BrandType.heading,
  title: BrandType.title,
  body: BrandType.body,
  bodyMedium: BrandType.bodyMedium,
  bodyStrong: BrandType.bodyStrong,
  caption: BrandType.caption,
  labelStrong: BrandType.labelStrong,
  micro: BrandType.micro,
  screenTitle: BrandType.heading,
  sheetTitle: BrandType.title,
  sectionLabel: BrandType.radarLabel,
  sectionTitle: BrandType.title,
  cardTitle: BrandType.bodyStrong,
  meta: BrandType.caption,
  pillLabel: BrandType.micro,
  buttonLabel: BrandType.bodyMedium,
  statValue: BrandType.heading,
  // Legacy
  default: BrandType.body,
  defaultSemiBold: BrandType.bodyStrong,
  subtitle: BrandType.title,
  link: BrandType.bodyStrong,
};

const LEGACY_MAP: Record<string, ThemedTextType> = {
  default: "body",
  defaultSemiBold: "bodyStrong",
  subtitle: "title",
};

export function ThemedText({ style, type = "body", ...rest }: ThemedTextProps) {
  const resolved = LEGACY_MAP[type] ?? type;
  const textStyle = TYPE_STYLES[resolved] ?? TYPE_STYLES.body;

  return (
    <Text style={[textStyle, { writingDirection: I18nManager.isRTL ? "rtl" : "ltr" }, style]} {...rest} />
  );
}
