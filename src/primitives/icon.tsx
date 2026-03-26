import { type ComponentProps, memo } from "react";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";

import { AppSymbol } from "@/components/ui/app-symbol";
import { useTheme } from "@/hooks/use-theme";
import { IconSize } from "@/theme/theme";

import type { IconProps } from "./types";

type AppSymbolName = ComponentProps<typeof AppSymbol>["name"];

/**
 * Icon is the app symbol primitive.
 *
 * Wraps the existing AppSymbol infrastructure (SF Symbols on iOS,
 * Material Symbols on Android via expo-symbols, with MaterialIcons fallback).
 *
 * Uses IconSize tokens from theme/theme.ts:
 * - xs, sm, md, lg, xl
 *
 * Optional `color` token maps to theme color palette.
 */
export const Icon = memo(function Icon({ name, size = "md", color, tintColor, style }: IconProps) {
  const theme = useTheme();

  const resolvedSize = typeof size === "number" ? size : IconSize[size];
  const resolvedColor = tintColor ?? (color ? theme.color[color] : theme.color.text);

  return (
    <AppSymbol
      name={name as AppSymbolName}
      size={resolvedSize}
      tintColor={resolvedColor}
      style={style as StyleProp<ViewStyle | TextStyle>}
    />
  );
});
