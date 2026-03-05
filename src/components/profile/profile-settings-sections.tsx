import type { ReactNode } from "react";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { KitPressable } from "@/components/ui/kit";
import type { BrandPalette } from "@/constants/brand";

export function ProfileSectionHeader({ label, palette }: { label: string; palette: BrandPalette }) {
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 }}>
      <ThemedText
        type="title"
        style={{
          color: palette.text,
          fontWeight: "600",
          letterSpacing: -0.2,
          fontSize: 20,
        }}
      >
        {label}
      </ThemedText>
    </View>
  );
}

export function ProfileSettingRow({
  title,
  subtitle,
  accessory,
  onPress,
  palette,
  isLast = false,
}: {
  title: string;
  subtitle?: string;
  accessory?: ReactNode;
  onPress?: () => void;
  palette: BrandPalette;
  isLast?: boolean;
}) {
  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: palette.border as string,
      }}
    >
      <View style={{ flex: 1, paddingRight: 16 }}>
        <ThemedText
          style={{ fontSize: 16, fontWeight: "500", color: palette.text, letterSpacing: -0.1 }}
        >
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText
            style={{ color: palette.textMuted, fontSize: 13, fontWeight: "400", marginTop: 4 }}
          >
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {accessory ? <View>{accessory}</View> : null}
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
      style={({ pressed }) => [
        { backgroundColor: pressed ? (palette.surfaceAlt as string) : "transparent" },
      ]}
    >
      {content}
    </KitPressable>
  );
}
