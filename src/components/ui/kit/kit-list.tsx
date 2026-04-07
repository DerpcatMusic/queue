import React, { memo } from "react";
import { Pressable, type StyleProp, View, type ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { ThemedText } from "@/components/themed-text";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { BorderWidth } from "@/lib/design-system";
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

const styles = StyleSheet.create({
  containerInset: {
    borderWidth: BorderWidth.thin,
    borderRadius: BrandRadius.card,
    marginHorizontal: BrandSpacing.lg,
    overflow: "hidden",
  },
  containerNoInset: {
    borderWidth: BorderWidth.thin,
    borderRadius: 0,
    marginHorizontal: 0,
    overflow: "hidden",
  },
  divider: {
    height: 1,
    marginStart: BrandSpacing.lg,
  },
  itemBase: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: BrandSpacing.lg,
    paddingVertical: BrandSpacing.md,
    minHeight: BrandSpacing.listItemMinHeight,
  },
  itemPressable: {
    width: "100%",
  },
  leading: {
    marginEnd: BrandSpacing.md,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    gap: BrandSpacing.xs,
  },
  trailing: {
    marginStart: BrandSpacing.md,
  },
});

const KitListComponent = ({ children, style, inset = true }: KitListProps) => {
  const { border, background } = useKitTheme();
  const entries = React.Children.toArray(children);

  return (
    <View
      style={[
        inset ? styles.containerInset : styles.containerNoInset,
        { borderColor: border.primary, backgroundColor: background.surfaceElevated },
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
              <View style={[styles.divider, { backgroundColor: border.primary }]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

const KitListItemComponent = ({
  children,
  style,
  title,
  accessory,
  leading,
  onPress,
}: KitListItemProps) => {
  const { foreground, background } = useKitTheme();

  const content = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.content}>
        {title ? (
          <ThemedText type="bodyStrong" style={{ color: foreground.secondary }}>
            {title}
          </ThemedText>
        ) : null}
        {children}
      </View>
      {accessory ? <View style={styles.trailing}>{accessory}</View> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.itemBase,
          styles.itemPressable,
          {
            backgroundColor: pressed ? background.surfaceSecondary : background.surfaceElevated,
          },
          style,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.itemBase, style]}>{content}</View>;
};

export const KitList = memo(KitListComponent);
export const KitListItem = memo(KitListItemComponent);
