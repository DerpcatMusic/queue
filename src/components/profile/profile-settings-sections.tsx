import type { ComponentProps, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSurface } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { useThemePreference } from "@/hooks/use-theme-preference";

type ProfileSymbolName = ComponentProps<typeof IconSymbol>["name"];

const PROFILE_SECTION_HEADER_ICON_SIZE = 14;

const PROFILE_SECTION_CARD_MARGIN_HORIZONTAL = BrandSpacing.inset;

const PROFILE_SETTING_ROW_GAP = BrandSpacing.component;
const PROFILE_SETTING_ROW_PADDING_HORIZONTAL = BrandSpacing.insetSoft;
const PROFILE_SETTING_ROW_PADDING_VERTICAL = 15;
const PROFILE_SETTING_ROW_ICON_SIZE = BrandSpacing.iconContainer;
const PROFILE_SETTING_ROW_SECONDARY_GAP = BrandSpacing.stackHair;
const PROFILE_SETTING_ROW_VALUE_GAP = BrandSpacing.inset;
const PROFILE_SETTING_ROW_DIVIDER_LEFT_WITH_ICON = BrandSpacing.iconContainer + BrandSpacing.inset;
const PROFILE_SETTING_ROW_DIVIDER_LEFT_WITHOUT_ICON = BrandSpacing.insetSoft;
const PROFILE_SETTING_ROW_DIVIDER_RIGHT = BrandSpacing.insetSoft;
const PROFILE_ICON_BUTTON_SIZE = 40;

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

  return (
    <View className={`gap-xs pt-section pb-stack-tight ${flush ? "px-0" : "px-section"}`}>
      <View className="flex-row items-center gap-sm">
        {icon ? (
          <IconSymbol
            name={icon}
            size={PROFILE_SECTION_HEADER_ICON_SIZE}
            color={theme.color.textMuted}
          />
        ) : null}
        <Text className="text-muted" style={[BrandType.micro, { textTransform: "uppercase" }]}>
          {label}
        </Text>
      </View>
      {description ? (
        <Text className="text-muted" style={[BrandType.caption, { maxWidth: 540 }]}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

export function ProfileSectionCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: ComponentProps<typeof View>["style"];
}) {
  return (
    <KitSurface
      tone="base"
      padding={0}
      gap={0}
      className="bg-surface"
      style={[
        {
          marginHorizontal: PROFILE_SECTION_CARD_MARGIN_HORIZONTAL,
          overflow: "hidden",
          borderRadius: BrandRadius.soft,
          borderCurve: "continuous",
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

  const secondaryColor =
    tone === "danger"
      ? theme.color.danger
      : tone === "accent"
        ? resolvedScheme === "dark"
          ? theme.color.text
          : theme.color.text
        : theme.color.textMuted;

  const iconBackground =
    tone === "danger"
      ? theme.color.dangerSubtle
      : tone === "accent"
        ? resolvedScheme === "dark"
          ? theme.color.primarySubtle
          : theme.color.primarySubtle
        : theme.color.surfaceAlt;

  const iconColor =
    tone === "danger"
      ? theme.color.danger
      : tone === "accent"
        ? resolvedAccentColor
        : theme.color.primary;

  const borderColor = tone === "danger" ? theme.color.danger : theme.color.border;

  const content = (
    <View>
      <View
        className="bg-surface"
        style={{
          flexDirection: "row",
          alignItems: subtitle && subtitle.length > 36 ? "flex-start" : "center",
          gap: PROFILE_SETTING_ROW_GAP,
          paddingHorizontal: PROFILE_SETTING_ROW_PADDING_HORIZONTAL,
          paddingVertical: PROFILE_SETTING_ROW_PADDING_VERTICAL,
        }}
      >
        {icon ? (
          <View
            style={{
              width: PROFILE_SETTING_ROW_ICON_SIZE,
              height: PROFILE_SETTING_ROW_ICON_SIZE,
              borderRadius: BrandRadius.pill,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: iconBackground,
            }}
          >
            <IconSymbol name={icon} size={18} color={iconColor} />
          </View>
        ) : null}

        <View
          style={{ flex: 1, gap: subtitle ? PROFILE_SETTING_ROW_SECONDARY_GAP : 0, minWidth: 0 }}
        >
          <Text
            className="text-brand"
            style={{
              fontFamily: "Manrope_600SemiBold",
              fontSize: 16,
              fontWeight: "600",
              lineHeight: 22,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                fontFamily: "Manrope_400Regular",
                fontSize: 14,
                fontWeight: "400",
                lineHeight: 19,
              }}
              className="text-muted"
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: PROFILE_SETTING_ROW_VALUE_GAP,
            maxWidth: "48%",
          }}
        >
          {value ? (
            <Text
              numberOfLines={1}
              className="text-muted"
              style={{
                fontFamily: "Manrope_500Medium",
                fontSize: 16,
                fontWeight: "500",
                lineHeight: 22,
                textAlign: "right",
              }}
            >
              {value}
            </Text>
          ) : null}
          {accessory ??
            (onPress ? <IconSymbol name="chevron.right" size={18} color={secondaryColor} /> : null)}
        </View>
      </View>
      {showDivider ? (
        <View
          style={{
            height: 1,
            marginLeft: icon
              ? PROFILE_SETTING_ROW_DIVIDER_LEFT_WITH_ICON
              : PROFILE_SETTING_ROW_DIVIDER_LEFT_WITHOUT_ICON,
            marginRight: PROFILE_SETTING_ROW_DIVIDER_RIGHT,
            backgroundColor: borderColor,
          }}
        />
      ) : null}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, value].filter(Boolean).join(". ")}
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
    >
      {content}
    </Pressable>
  );
}
