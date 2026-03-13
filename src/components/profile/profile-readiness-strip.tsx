import { Pressable, Text, useWindowDimensions, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { type BrandPalette, BrandRadius, BrandType } from "@/constants/brand";

type ReadinessItem = {
  label: string;
  value: string;
  caption?: string;
  accent?: string;
  onPress?: (() => void) | undefined;
};

export function ProfileReadinessStrip({
  items,
  palette,
  columns,
}: {
  items: ReadinessItem[];
  palette: BrandPalette;
  columns?: 1 | 2 | 4;
}) {
  const { width } = useWindowDimensions();
  const resolvedColumns =
    columns ?? (process.env.EXPO_OS === "web" && width >= 1180 ? 4 : 2);
  const horizontalPadding = 48;
  const totalGap = resolvedColumns === 1 ? 0 : 10 * (resolvedColumns - 1);
  const tileWidth = Math.max(
    resolvedColumns === 4 ? 150 : 180,
    Math.floor((width - horizontalPadding - totalGap) / resolvedColumns),
  );

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        paddingHorizontal: 24,
      }}
    >
      {items.map((item) => {
        const content = (
          <View
            style={{
              minHeight: 108,
              borderRadius: BrandRadius.card,
              borderCurve: "continuous",
              backgroundColor: item.onPress
                ? (palette.surface as string)
                : (palette.surfaceAlt as string),
              paddingHorizontal: 16,
              paddingVertical: 16,
              gap: 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Text
                style={{
                  ...BrandType.micro,
                  color: palette.textMuted as string,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                }}
              >
                {item.label}
              </Text>
              {item.onPress ? (
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    borderCurve: "continuous",
                    backgroundColor: palette.primarySubtle as string,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconSymbol
                    name="arrow.up.right"
                    size={14}
                    color={palette.primary}
                  />
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={2}
              style={{
                ...BrandType.title,
                color: (item.accent ?? palette.text) as string,
                lineHeight: 22,
              }}
            >
              {item.value}
            </Text>
            {item.caption ? (
              <Text
                numberOfLines={2}
                style={{
                  ...BrandType.caption,
                  color: palette.textMuted as string,
                }}
              >
                {item.caption}
              </Text>
            ) : null}
          </View>
        );

        if (!item.onPress) {
          return (
            <View key={item.label} style={{ width: tileWidth }}>
              {content}
            </View>
          );
        }

        return (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}. ${item.value}`}
            onPress={item.onPress}
            style={({ pressed }) => [
              { width: tileWidth, opacity: pressed ? 0.84 : 1 },
            ]}
          >
            {content}
          </Pressable>
        );
      })}
    </View>
  );
}
