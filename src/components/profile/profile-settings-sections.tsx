import type { ComponentProps, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSurface } from "@/components/ui/kit";
import { type BrandPalette, BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useThemePreference } from "@/hooks/use-theme-preference";

type ProfileSymbolName = ComponentProps<typeof IconSymbol>["name"];

const PROFILE_SECTION_HEADER_ICON_SIZE = 14;

const PROFILE_SECTION_CARD_MARGIN_HORIZONTAL = BrandSpacing.inset;

const PROFILE_SETTING_ROW_GAP = 14;
const PROFILE_SETTING_ROW_PADDING_HORIZONTAL = 18;
const PROFILE_SETTING_ROW_PADDING_VERTICAL = 15;
const PROFILE_SETTING_ROW_ICON_SIZE = BrandSpacing.iconContainer;
const PROFILE_SETTING_ROW_SECONDARY_GAP = 5;
const PROFILE_SETTING_ROW_VALUE_GAP = BrandSpacing.inset;
const PROFILE_SETTING_ROW_DIVIDER_LEFT_WITH_ICON = 56;
const PROFILE_SETTING_ROW_DIVIDER_LEFT_WITHOUT_ICON = 18;
const PROFILE_SETTING_ROW_DIVIDER_RIGHT = 18;
const PROFILE_ICON_BUTTON_SIZE = 40;

export function ProfileSectionHeader({
  label,
  description,
  icon,
  palette,
  flush = false,
}: {
  label: string;
  description?: string;
  icon?: ProfileSymbolName;
  palette: BrandPalette;
  flush?: boolean;
}) {
  return (
    <View className={`gap-xs pt-section pb-stack-tight ${flush ? "px-0" : "px-section"}`}>
      <View className="flex-row items-center gap-sm">
        {icon ? (
          <IconSymbol
            name={icon}
            size={PROFILE_SECTION_HEADER_ICON_SIZE}
            color={palette.textMuted as string}
          />
        ) : null}
        <Text
          style={{
            ...BrandType.micro,
            color: palette.textMuted as string,
            letterSpacing: BrandType.micro.letterSpacing,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
      </View>
      {description ? (
        <Text
          style={{
            ...BrandType.caption,
            color: palette.textMuted as string,
            maxWidth: 540,
          }}
        >
          {description}
        </Text>
      ) : null}
    </View>
  );
}

export function ProfileSectionCard({
  children,
  palette,
  style,
}: {
  children: ReactNode;
  palette: BrandPalette;
  style?: ComponentProps<typeof View>["style"];
}) {
  return (
    <KitSurface
      tone="base"
      padding={0}
      gap={0}
      style={[
        {
          marginHorizontal: PROFILE_SECTION_CARD_MARGIN_HORIZONTAL,
          overflow: "hidden",
          borderRadius: BrandRadius.soft,
          borderCurve: "continuous",
          backgroundColor: palette.surface as string,
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
  palette,
  tone = "neutral",
}: {
  icon: ProfileSymbolName;
  label: string;
  onPress: () => void;
  palette: BrandPalette;
  tone?: "neutral" | "accent";
}) {
  const iconColor = tone === "accent" ? (palette.primary as string) : (palette.text as string);

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
  palette,
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
  palette: BrandPalette;
  tone?: "default" | "danger" | "accent";
  accentColor?: string;
  showDivider?: boolean;
}) {
  const { resolvedScheme } = useThemePreference();
  const resolvedAccentColor = accentColor ?? palette.didit.accent;

  const titleColor =
    tone === "danger"
      ? (palette.danger as string)
      : tone === "accent"
        ? resolvedAccentColor
        : (palette.text as string);

  const secondaryColor =
    tone === "danger"
      ? (palette.danger as string)
      : tone === "accent"
        ? resolvedScheme === "dark"
          ? (palette.accentTextDark as string)
          : (palette.accentTextLight as string)
        : (palette.textMuted as string);

  const iconBackground =
    tone === "danger"
      ? (palette.dangerSubtle as string)
      : tone === "accent"
        ? resolvedScheme === "dark"
          ? (palette.accentDark as string)
          : (palette.accentLight as string)
        : (palette.surfaceAlt as string);

  const iconColor =
    tone === "danger"
      ? (palette.danger as string)
      : tone === "accent"
        ? resolvedAccentColor
        : (palette.primary as string);

  const borderColor = tone === "danger" ? (palette.danger as string) : (palette.border as string);

  const rowBackground =
    tone === "accent"
      ? resolvedScheme === "dark"
        ? (palette.accentRowBgDark as string)
        : (palette.accentRowBgLight as string)
      : (palette.surface as string);

  const content = (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: subtitle && subtitle.length > 36 ? "flex-start" : "center",
          gap: PROFILE_SETTING_ROW_GAP,
          paddingHorizontal: PROFILE_SETTING_ROW_PADDING_HORIZONTAL,
          paddingVertical: PROFILE_SETTING_ROW_PADDING_VERTICAL,
          backgroundColor: rowBackground,
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
            style={{
              ...BrandType.bodyStrong,
              color: titleColor,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ ...BrandType.caption, color: secondaryColor }}>{subtitle}</Text>
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
              style={{
                ...BrandType.bodyMedium,
                color: secondaryColor,
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
