import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSurface } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { BorderWidth, FontFamily } from "@/lib/design-system";
import { Box } from "@/primitives";

type ProfileSymbolName = ComponentProps<typeof IconSymbol>["name"];

const PROFILE_SECTION_HEADER_ICON_SIZE = 14;

const PROFILE_SECTION_CARD_MARGIN_HORIZONTAL = BrandSpacing.inset;

const PROFILE_SETTING_ROW_PADDING_HORIZONTAL = BrandSpacing.md;
const PROFILE_SETTING_ROW_ICON_SIZE = 20;
const PROFILE_SETTING_ROW_SECONDARY_GAP = BrandSpacing.xxs;
const PROFILE_SETTING_ROW_DIVIDER_LEFT_WITH_ICON = BrandSpacing.md + 24;
const PROFILE_SETTING_ROW_DIVIDER_LEFT_WITHOUT_ICON = BrandSpacing.md;
const PROFILE_SETTING_ROW_DIVIDER_RIGHT = BrandSpacing.md;
const PROFILE_ICON_BUTTON_SIZE = 40;
const PROFILE_ROW_VERTICAL_PADDING = BrandSpacing.md;

export function ProfileSectionHeader({
  label,
  description,
  icon,
  flush = false,
}: {
  label: string;
  description?: string;
  icon?: ProfileSymbolName;
  flush?: boolean;
}) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const isHebrew = (i18n.resolvedLanguage ?? "en").toLowerCase().startsWith("he");
  const headerFontFamily = isHebrew ? "Kanit_700Bold" : FontFamily.displayBold;

  return (
    <Box gap="xs" pt="xl" pb="sm" {...(!flush ? { px: "inset" } : {})}>
      <Box flexDirection="row" alignItems="center" gap="sm">
        {icon ? (
          <IconSymbol
            name={icon}
            size={PROFILE_SECTION_HEADER_ICON_SIZE}
            color={theme.color.textMicro}
          />
        ) : null}
        <Text
          style={[
            BrandType.micro,
            {
              fontFamily: headerFontFamily,
              fontStyle: isHebrew ? "normal" : "italic",
              textTransform: "uppercase",
              letterSpacing: 1.8,
              color: theme.color.textMicro,
            },
          ]}
        >
          {label}
        </Text>
      </Box>
      {description ? (
        <Text style={[BrandType.caption, { maxWidth: 540, color: theme.color.textMuted }]}>
          {description}
        </Text>
      ) : null}
    </Box>
  );
}

export function ProfileSectionCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: ComponentProps<typeof View>["style"];
}) {
  const theme = useTheme();
  return (
    <KitSurface
      tone="base"
      padding={0}
      gap={0}
      style={[
        {
          marginHorizontal: PROFILE_SECTION_CARD_MARGIN_HORIZONTAL,
          overflow: "hidden",
          borderRadius: BrandRadius.card,
          borderCurve: "continuous",
          borderWidth: BorderWidth.thin,
          borderColor: theme.color.outline,
        },
        style,
      ]}
    >
      {children}
    </KitSurface>
  );
}

export function ProfileIconButton({
  icon,
  label,
  onPress,
  tone = "neutral",
}: {
  icon: ProfileSymbolName;
  label: string;
  onPress: () => void;
  tone?: "neutral" | "accent";
}) {
  const theme = useTheme();
  const iconColor = tone === "accent" ? theme.color.primary : theme.color.text;

  return (
    <IconButton
      accessibilityLabel={label}
      icon={<IconSymbol name={icon} size={18} color={iconColor} />}
      onPress={onPress}
      tone={tone === "accent" ? "primarySubtle" : "secondary"}
      size={PROFILE_ICON_BUTTON_SIZE}
    />
  );
}

export function ProfileSettingRow({
  title,
  subtitle,
  value,
  icon,
  accessory,
  onPress,
  tone = "default",
  accentColor,
  showDivider = false,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: ProfileSymbolName;
  accessory?: ReactNode;
  onPress?: () => void;
  tone?: "default" | "danger" | "accent";
  accentColor?: string;
  showDivider?: boolean;
}) {
  const theme = useTheme();
  const { resolvedScheme } = useThemePreference();
  const resolvedAccentColor = accentColor ?? theme.color.tertiary;
  const rowBackgroundColor = theme.color.surface;

  const secondaryColor =
    tone === "danger"
      ? theme.color.danger
      : tone === "accent"
        ? resolvedScheme === "dark"
          ? theme.color.primary
          : theme.color.primary
        : theme.color.textMicro;

  const iconColor =
    tone === "danger"
      ? theme.color.danger
      : tone === "accent"
        ? resolvedAccentColor
        : theme.color.primary;

  const dividerColor = theme.color.outlineStrong;

  const content = (
    <Box>
      <Box
        flexDirection="row"
        alignItems={subtitle && subtitle.length > 36 ? "flex-start" : "center"}
        gap="md"
        style={{
          paddingHorizontal: PROFILE_SETTING_ROW_PADDING_HORIZONTAL,
          paddingVertical: PROFILE_ROW_VERTICAL_PADDING,
          backgroundColor: rowBackgroundColor,
          minHeight: BrandSpacing.listItemMinHeight,
        }}
      >
        {icon ? (
          <Box style={{ width: PROFILE_SETTING_ROW_ICON_SIZE + 4 }} alignItems="center">
            <IconSymbol name={icon} size={18} color={iconColor} />
          </Box>
        ) : null}

        <Box
          flex={1}
          minWidth={0}
          style={{ gap: subtitle ? PROFILE_SETTING_ROW_SECONDARY_GAP : 0 }}
        >
          <Text
            style={{
              fontFamily: "Manrope_600SemiBold",
              fontSize: 15,
              fontWeight: "600",
              lineHeight: 20,
              color: theme.color.text,
              includeFontPadding: false,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                fontFamily: "Manrope_400Regular",
                fontSize: 13,
                fontWeight: "400",
                lineHeight: 17,
                color: theme.color.textMuted,
                includeFontPadding: false,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </Box>

        <Box
          flexDirection="row"
          alignItems="center"
          justifyContent="flex-end"
          gap="sm"
          style={{ maxWidth: "48%" }}
        >
          {value ? (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: "Manrope_500Medium",
                fontSize: 13,
                fontWeight: "500",
                lineHeight: 18,
                textAlign: "right",
                color: theme.color.textMuted,
                includeFontPadding: false,
              }}
            >
              {value}
            </Text>
          ) : null}
          {accessory ??
            (onPress ? <IconSymbol name="chevron.right" size={14} color={secondaryColor} /> : null)}
        </Box>
      </Box>
      {showDivider ? (
        <View
          style={{
            height: BorderWidth.thin,
            marginLeft: icon
              ? PROFILE_SETTING_ROW_DIVIDER_LEFT_WITH_ICON
              : PROFILE_SETTING_ROW_DIVIDER_LEFT_WITHOUT_ICON,
            marginRight: PROFILE_SETTING_ROW_DIVIDER_RIGHT,
            backgroundColor: dividerColor,
          }}
        />
      ) : null}
    </Box>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, value].filter(Boolean).join(". ")}
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
    >
      {content}
    </Pressable>
  );
}
