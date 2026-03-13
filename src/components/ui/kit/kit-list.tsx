import React from "react";
import { Pressable, type StyleProp, View, type ViewStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useKitTheme } from "./use-kit-theme";

type KitListProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  inset?: boolean;
};

type KitListItemProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  title?: string;
  accessory?: React.ReactNode;
  leading?: React.ReactNode;
  onPress?: () => void;
};

export function KitList({ children, style, inset = true }: KitListProps) {
  const { border, background } = useKitTheme();
  const entries = React.Children.toArray(children);

  return (
    <View
      style={[
        {
          overflow: "hidden",
          borderWidth: 1,
          borderColor: border.primary,
          backgroundColor: background.surfaceElevated,
          borderRadius: inset ? BrandRadius.card : 0,
          marginHorizontal: inset ? BrandSpacing.lg : 0,
        },
        style,
      ]}
    >
      {entries.map((child, index) => {
        const isLast = index === entries.length - 1;
        const childKey =
          React.isValidElement(child) && child.key != null
            ? String(child.key)
            : typeof child === "string" || typeof child === "number"
              ? `content-${child}`
              : "content";
        return (
          <View key={childKey}>
            {child}
            {!isLast ? (
              <View
                style={{
                  height: 1,
                  marginStart: BrandSpacing.lg,
                  backgroundColor: border.primary,
                }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export function KitListItem({
  children,
  style,
  title,
  accessory,
  leading,
  onPress,
}: KitListItemProps) {
  const { foreground, background } = useKitTheme();

  const content = (
    <>
      {leading ? (
        <View style={{ marginEnd: BrandSpacing.md }}>{leading}</View>
      ) : null}
      <View
        style={{ flex: 1, justifyContent: "center", gap: children ? 2 : 0 }}
      >
        {title ? (
          <ThemedText type="bodyStrong" style={{ color: foreground.secondary }}>
            {title}
          </ThemedText>
        ) : null}
        {children}
      </View>
      {accessory ? (
        <View style={{ marginStart: BrandSpacing.md }}>{accessory}</View>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: BrandSpacing.lg,
            paddingVertical: BrandSpacing.md,
            minHeight: 56,
            backgroundColor: pressed
              ? background.surfaceSecondary
              : background.transparent,
          },
          style,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: BrandSpacing.lg,
          paddingVertical: BrandSpacing.md,
          minHeight: 56,
        },
        style,
      ]}
    >
      {content}
    </View>
  );
}
