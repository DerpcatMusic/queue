import { useRef, useState } from "react";
import type { ColorValue, StyleProp, TextInputProps, TextStyle, ViewStyle } from "react-native";
import { Pressable, TextInput } from "react-native";
import Animated, { LinearTransition, ReduceMotion } from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

import { useTheme } from "@/hooks/use-theme";
import { Icon } from "@/primitives";
import { Radius, Spacing } from "@/theme/theme";

export type SearchFieldSize = "sm" | "md";

export type SearchFieldColors = {
  backgroundColor?: ColorValue;
  pressedBackgroundColor?: ColorValue;
  borderColor?: ColorValue;
  focusedBorderColor?: ColorValue;
  textColor?: ColorValue;
  placeholderColor?: ColorValue;
  iconColor?: ColorValue;
  clearTintColor?: ColorValue;
  clearPressedBackgroundColor?: ColorValue;
};

export type SearchFieldProps = Omit<TextInputProps, "value" | "onChangeText"> & {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  size?: SearchFieldSize;
  colors?: SearchFieldColors;
  animateLayout?: boolean;
  clearAccessibilityLabel?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

const SEARCH_SIZE_CONFIG = {
  sm: {
    containerMinHeight: Spacing.controlSm + Spacing.sm,
    inputMinHeight: Spacing.controlSm,
    horizontalPadding: Spacing.md,
    iconSize: 16,
    clearIconSize: 16,
    radius: Radius.buttonSubtle,
  },
  md: {
    containerMinHeight: Spacing.controlMd + Spacing.sm,
    inputMinHeight: Spacing.controlMd,
    horizontalPadding: Spacing.lg,
    iconSize: 18,
    clearIconSize: 18,
    radius: Radius.input,
  },
} as const;

const styles = StyleSheet.create((theme) => ({
  container: (
    size: SearchFieldSize,
    colors: SearchFieldColors | undefined,
    isFocused: boolean,
    pressed: boolean,
  ) => {
    const metrics = SEARCH_SIZE_CONFIG[size];

    return {
      width: "100%",
      minWidth: 0,
      minHeight: metrics.containerMinHeight,
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      paddingHorizontal: metrics.horizontalPadding,
      borderWidth: isFocused ? 1.5 : 1,
      borderRadius: metrics.radius,
      borderCurve: "continuous",
      borderColor: isFocused
        ? (colors?.focusedBorderColor as string) ?? theme.color.primary
        : (colors?.borderColor as string) ?? theme.color.borderStrong,
      backgroundColor: pressed
        ? (colors?.pressedBackgroundColor as string) ?? theme.color.surface
        : (colors?.backgroundColor as string) ?? theme.color.surfaceAlt,
    } satisfies ViewStyle;
  },
  input: (size: SearchFieldSize, colors: SearchFieldColors | undefined) => ({
    flex: 1,
    minWidth: 0,
    minHeight: SEARCH_SIZE_CONFIG[size].inputMinHeight,
    padding: 0,
    margin: 0,
    color: (colors?.textColor as string) ?? theme.color.text,
    includeFontPadding: false,
    ...theme.typography.body,
  }),
  clearButton: (colors: SearchFieldColors | undefined, pressed: boolean) => ({
    borderRadius: Radius.pill,
    padding: Spacing.xxs,
    backgroundColor: pressed
      ? (colors?.clearPressedBackgroundColor as string) ?? theme.color.surface
      : "transparent",
  }),
}));

export function SearchField({
  value,
  onChangeText,
  placeholder = "Search...",
  size = "md",
  colors,
  animateLayout = false,
  clearAccessibilityLabel = "Clear search",
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  autoFocus,
  ...rest
}: SearchFieldProps) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const metrics = SEARCH_SIZE_CONFIG[size];
  const iconProps = colors?.iconColor
    ? ({ tintColor: colors.iconColor as string } as const)
    : ({ color: "textMuted" as const } as const);
  const clearIconProps = colors?.clearTintColor
    ? ({ tintColor: colors.clearTintColor as string } as const)
    : ({ color: "primary" as const } as const);
  const placeholderColor =
    (colors?.placeholderColor as string) ?? (colors?.iconColor as string) ?? theme.color.textMuted;
  const accentColor = (colors?.focusedBorderColor as string) ?? theme.color.primary;

  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      {({ pressed }) => (
        <Animated.View
          {...(animateLayout
            ? {
                layout: LinearTransition.duration(220).reduceMotion(ReduceMotion.System),
              }
            : {})}
          style={[styles.container(size, colors, isFocused, pressed), containerStyle]}
        >
          <Icon name="magnifyingglass" size={metrics.iconSize} {...iconProps} />
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={placeholderColor}
            onFocus={(event) => {
              setIsFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setIsFocused(false);
              onBlur?.(event);
            }}
            autoFocus={autoFocus}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor={accentColor}
            cursorColor={accentColor}
            underlineColorAndroid="transparent"
            style={[styles.input(size, colors), inputStyle]}
            {...rest}
          />
          {value.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={clearAccessibilityLabel}
              onPress={() => onChangeText("")}
              hitSlop={8}
            >
              {({ pressed: clearPressed }) => (
                <Animated.View style={styles.clearButton(colors, clearPressed)}>
                  <Icon name="xmark.circle.fill" size={metrics.clearIconSize} {...clearIconProps} />
                </Animated.View>
              )}
            </Pressable>
          ) : null}
        </Animated.View>
      )}
    </Pressable>
  );
}
