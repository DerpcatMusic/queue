import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSurface } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { FontFamily } from "@/lib/design-system";

type ProfileSymbolName = ComponentProps<typeof IconSymbol>["name"];

const PROFILE_SECTION_HEADER_ICON_SIZE = 14;
const PROFILE_SECTION_CARD_MARGIN_HORIZONTAL = BrandSpacing.inset;
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
    <View
      style={[
        styles.headerContainer,
        { gap: BrandSpacing.xs },
        flush ? { paddingHorizontal: 0 } : { paddingHorizontal: BrandSpacing.section },
      ]}
    >
      <View style={[styles.headerRow, { gap: BrandSpacing.sm }]}>
        {icon ? (
          <IconSymbol
            name={icon}
            size={PROFILE_SECTION_HEADER_ICON_SIZE}
            color={theme.color.textMuted}
          />
        ) : null}
        <Text
          style={[
            BrandType.micro,
            {
              color: theme.color.textMuted,
              textTransform: "uppercase",
              letterSpacing: 1.2,
              fontFamily: FontFamily.display,
            },
          ]}
        >
          {label}
        </Text>
      </View>
      {description ? (
        <Text style={[BrandType.caption, { color: theme.color.textMuted, maxWidth: 540 }]}>
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
          borderRadius: BrandRadius.xl,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: theme.color.border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 4,
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
        style={{
          backgroundColor: theme.color.surface,
          flexDirection: "row",
          alignItems: subtitle && subtitle.length > 36 ? "flex-start" : "center",
          gap: BrandSpacing.sm,
          paddingHorizontal: BrandSpacing.md,
          paddingVertical: BrandSpacing.md,
        }}
      >
        {icon ? <IconSymbol name={icon} size={20} color={iconColor} /> : null}

        <View style={{ flex: 1, gap: subtitle ? BrandSpacing.xs : 0, minWidth: 0 }}>
          <Text
            style={{
              fontFamily: FontFamily.bodyStrong,
              fontSize: 14,
              fontWeight: "600",
              lineHeight: 20,
              color: theme.color.text,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                fontFamily: FontFamily.body,
                fontSize: 12,
                fontWeight: "400",
                lineHeight: 16,
                color: theme.color.textMuted,
              }}
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
            gap: BrandSpacing.sm,
            maxWidth: "48%",
          }}
        >
          {value ? (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: FontFamily.bodyMedium,
                fontSize: 14,
                fontWeight: "500",
                lineHeight: 20,
                textAlign: "right",
                color: theme.color.textMuted,
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
            marginLeft: icon ? BrandSpacing.iconContainer + BrandSpacing.sm : BrandSpacing.md,
            marginRight: BrandSpacing.md,
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
      style={({ pressed }) => [
        { backgroundColor: pressed ? "rgba(255,255,255,0.05)" : "transparent" },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: BrandSpacing.section,
    paddingBottom: BrandSpacing.stackTight,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});
