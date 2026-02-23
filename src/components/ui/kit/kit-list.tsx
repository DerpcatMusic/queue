import React from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { BrandRadius } from "@/constants/brand";
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
          marginHorizontal: inset ? 16 : 0,
        },
        style,
      ]}
    >
      {entries.map((child, index) => {
        const isLast = index === entries.length - 1;
        return (
          <View key={index}>
            {child}
            {!isLast ? (
              <View
                style={{
                  height: 1,
                  marginLeft: 16,
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
  const { foreground, background, interaction } = useKitTheme();

  const content = (
    <>
      {leading ? <View style={{ marginRight: 12 }}>{leading}</View> : null}
      <View style={{ flex: 1, justifyContent: "center", gap: children ? 2 : 0 }}>
        {title ? (
          <ThemedText type="body" style={{ color: foreground.secondary, fontSize: 17 }}>
            {title}
          </ThemedText>
        ) : null}
        {children}
      </View>
      {accessory ? <View style={{ marginLeft: 12 }}>{accessory}</View> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        android_ripple={{ color: interaction.ripple as string }}
        onPress={onPress}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 14,
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
          paddingHorizontal: 16,
          paddingVertical: 14,
          minHeight: 56,
        },
        style,
      ]}
    >
      {content}
    </View>
  );
}
