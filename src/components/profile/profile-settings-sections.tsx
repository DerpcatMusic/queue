import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSurface } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { BorderWidth, FontFamily, LetterSpacing } from "@/lib/design-system";
import { Box, Text } from "@/primitives";

type ProfileSymbolName = ComponentProps<typeof IconSymbol>["name"];

const PROFILE_SECTION_HEADER_ICON_SIZE = 14;
const PROFILE_SECTION_CARD_MARGIN_HORIZONTAL = BrandSpacing.inset;
const PROFILE_SETTING_ROW_SECONDARY_GAP = BrandSpacing.xxs;
const PROFILE_SETTING_ROW_DIVIDER_LEFT_WITHOUT_ICON = BrandSpacing.md;
const PROFILE_SETTING_ROW_DIVIDER_RIGHT = BrandSpacing.md;
const PROFILE_ICON_BUTTON_SIZE = 40;

const URGENT_ORANGE = "#FF5E00";

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
            color={theme.color.textMuted}
          />
        ) : null}
        <Text
          variant="radarLabel"
          style={[
            {
              fontFamily: headerFontFamily,
              fontStyle: isHebrew ? "normal" : "italic",
              letterSpacing: LetterSpacing.trackingWide,
              color: theme.color.textMuted,
            },
          ]}
        >
          {label}
        </Text>
      </Box>
      {description ? (
        <Text variant="caption" style={{ maxWidth: 540, color: theme.color.textMuted }}>
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
          borderColor: theme.color.border,
          backgroundColor: theme.color.surfaceElevated,
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
      icon={<IconSymbol name={icon} size={20} color={iconColor} />}
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

  const secondaryColor =
    tone === "danger"
      ? URGENT_ORANGE
      : tone === "accent"
        ? resolvedScheme === "dark"
          ? theme.color.primary
          : theme.color.primary
        : theme.color.textMuted;

  const iconColor =
    tone === "danger"
      ? URGENT_ORANGE
      : tone === "accent"
        ? resolvedAccentColor
        : theme.color.primary;

  const dividerColor = theme.color.divider;

  const content = (
    <Box>
      <Box
        flexDirection="row"
        alignItems={subtitle && subtitle.length > 36 ? "flex-start" : "center"}
        gap="md"
        px="md"
        py="md"
        minHeight={BrandSpacing.listItemMinHeight}
      >
        {icon ? (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: BrandRadius.lg,
              backgroundColor: theme.color.surfaceAlt,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconSymbol name={icon} size={20} color={iconColor} />
          </View>
        ) : null}

        <Box
          flex={1}
          minWidth={0}
          style={{ gap: subtitle ? PROFILE_SETTING_ROW_SECONDARY_GAP : 0 }}
        >
          <Text variant="bodyMedium" color="text">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" color="textMuted">
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
              variant="caption"
              numberOfLines={1}
              style={{ textAlign: "right", color: theme.color.textMuted }}
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
              ? BrandSpacing.md + 40 + BrandSpacing.md
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

// Support grid card (Help Center, Terms) - matches mock's card style
export function ProfileSupportCard({
  icon,
  title,
  onPress,
  fullWidth = false,
}: {
  icon: ProfileSymbolName;
  title: string;
  onPress?: () => void;
  fullWidth?: boolean;
}) {
  const theme = useTheme();

  const cardContent = (
    <View
      style={{
        backgroundColor: theme.color.surfaceAlt,
        borderRadius: BrandRadius.card,
        borderWidth: BorderWidth.thin,
        borderColor: theme.color.border,
        padding: BrandSpacing.md,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: BrandSpacing.xs,
        minHeight: 80,
      }}
    >
      <IconSymbol name={icon} size={24} color={theme.color.textMuted} />
      <Text variant="bodyMedium" color="text" style={{ fontSize: 14, fontWeight: "600" }}>
        {title}
      </Text>
    </View>
  );

  if (!onPress) {
    return cardContent;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, flex: fullWidth ? 1 : undefined }]}
    >
      {cardContent}
    </Pressable>
  );
}

// Sign Out button - matches mock's urgent-orange style
export function ProfileSignOutButton({ title, onPress }: { title: string; onPress?: () => void }) {
  const theme = useTheme();
  const cardContent = (
    <View
      style={{
        backgroundColor: theme.color.secondarySubtle,
        borderRadius: BrandRadius.card,
        borderWidth: 1,
        borderColor: theme.color.secondary,
        padding: BrandSpacing.md,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: BrandSpacing.sm,
        minHeight: 52,
      }}
    >
      <IconSymbol name="logout" size={20} color={theme.color.secondary} />
      <Text
        variant="bodyMedium"
        style={{
          color: theme.color.secondary,
          fontWeight: "700",
        }}
      >
        {title}
      </Text>
    </View>
  );

  if (!onPress) {
    return cardContent;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
    >
      {cardContent}
    </Pressable>
  );
}
