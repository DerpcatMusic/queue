import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitPressable } from "@/components/ui/kit";
import { type BrandPalette, BrandSpacing, BrandType } from "@/constants/brand";

export function ProfileSectionHeader({
  label,
  description,
  palette,
  flush = false,
}: {
  label: string;
  description?: string;
  palette: BrandPalette;
  flush?: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: flush ? 0 : BrandSpacing.xl,
        paddingTop: BrandSpacing.xl,
        paddingBottom: BrandSpacing.sm,
        gap: 4,
      }}
    >
      <Text
        style={{
          ...BrandType.micro,
          color: palette.textMuted as string,
          letterSpacing: 1.0,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      {description ? (
        <Text
          style={{
            ...BrandType.caption,
            color: palette.textMuted as string,
            maxWidth: 520,
          }}
        >
          {description}
        </Text>
      ) : null}
    </View>
  );
}

export function ProfileSettingRow({
  eyebrow,
  title,
  subtitle,
  accessory,
  onPress,
  palette,
  isLast = false,
  tone = "default",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  accessory?: ReactNode;
  onPress?: () => void;
  palette: BrandPalette;
  isLast?: boolean;
  tone?: "default" | "danger";
}) {
  const rowBackgroundColor =
    tone === "danger"
      ? (palette.dangerSubtle as string)
      : onPress
        ? (palette.surface as string)
        : (palette.surfaceAlt as string);
  const titleColor = tone === "danger" ? (palette.danger as string) : (palette.text as string);
  const subtitleColor =
    tone === "danger" ? (palette.danger as string) : (palette.textMuted as string);

  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        paddingVertical: 18,
        paddingHorizontal: 18,
        borderRadius: 26,
        borderCurve: "continuous",
        backgroundColor: rowBackgroundColor,
        opacity: isLast ? 1 : 1,
      }}
    >
      <View style={{ flex: 1, paddingRight: 16 }}>
        {eyebrow ? (
          <Text
            style={{
              ...BrandType.micro,
              color: palette.textMuted as string,
              letterSpacing: 0.9,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            {eyebrow}
          </Text>
        ) : null}
        <Text style={{ ...BrandType.bodyStrong, color: titleColor, letterSpacing: -0.1 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              ...BrandType.caption,
              color: subtitleColor,
              marginTop: 4,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          minHeight: 28,
          alignItems: "flex-end",
          justifyContent: "center",
          paddingTop: subtitle ? 2 : 0,
        }}
      >
        {accessory ??
          (onPress ? (
            <View
              style={{
                minWidth: 46,
                height: 32,
                borderRadius: 999,
                borderCurve: "continuous",
                backgroundColor:
                  tone === "danger" ? "rgba(0,0,0,0.08)" : (palette.primarySubtle as string),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconSymbol
                name="arrow.up.right"
                size={16}
                color={tone === "danger" ? palette.danger : palette.primary}
              />
            </View>
          ) : null)}
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <KitPressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.82 : 1 }]}
    >
      {content}
    </KitPressable>
  );
}
