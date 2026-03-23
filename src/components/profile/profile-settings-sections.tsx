import type { ComponentProps, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSurface } from "@/components/ui/kit";
import { type BrandPalette, BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useThemePreference } from "@/hooks/use-theme-preference";

type ProfileSymbolName = ComponentProps<typeof IconSymbol>["name"];

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
    <View
      style={{
        paddingHorizontal: flush ? 0 : BrandSpacing.xl,
        paddingTop: BrandSpacing.xl,
        paddingBottom: BrandSpacing.sm,
        gap: BrandSpacing.xs,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
        {icon ? <IconSymbol name={icon} size={14} color={palette.textMuted as string} /> : null}
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
          marginHorizontal: BrandSpacing.lg,
          overflow: "hidden",
          borderRadius: BrandRadius.card,
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
      size={40}
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

  const borderColor = tone === "danger" ? "transparent" : (palette.border as string);

  const rowBackground =
    tone === "accent"
      ? resolvedScheme === "dark"
        ? (palette.accentRowBgDark as string)
        : (palette.accentRowBgLight as string)
      : "transparent";

  const content = (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: subtitle && subtitle.length > 36 ? "flex-start" : "center",
          gap: BrandSpacing.md + 2, // 14px
          paddingHorizontal: BrandSpacing.md + 6, // 18px
          paddingVertical: BrandSpacing.md + 3, // 15px
          backgroundColor: rowBackground,
        }}
      >
        {icon ? (
          <View
            style={{
              width: BrandSpacing.iconContainer, // 38px
              height: BrandSpacing.iconContainer, // 38px
              borderRadius: BrandRadius.icon,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: iconBackground,
            }}
          >
            <IconSymbol name={icon} size={18} color={iconColor} />
          </View>
        ) : null}

        <View style={{ flex: 1, gap: subtitle ? BrandSpacing.xs + 1 : 0, minWidth: 0 }}>
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
            gap: BrandSpacing.md,
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
              ? BrandSpacing.iconContainer + BrandSpacing.md + 6
              : BrandSpacing.md + 6, // 38 + 12 + 6 = 56 : 18
            marginRight: BrandSpacing.md + 6, // 18px
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
