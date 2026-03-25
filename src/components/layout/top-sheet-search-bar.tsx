import { useRef, useState } from "react";
import type { ColorValue } from "react-native";
import { Pressable, TextInput } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";

export type SearchBarWidgetProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  palette: {
    appBg?: ColorValue;
    surface?: ColorValue;
    surfaceAlt: ColorValue;
    text: ColorValue;
    textMuted: ColorValue;
    primary: ColorValue;
    borderStrong?: ColorValue;
  };
  onFocus?: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
};

export function TopSheetSearchBar({
  value,
  onChangeText,
  placeholder = "Search...",
  palette,
  onFocus,
  onBlur,
  autoFocus = false,
}: SearchBarWidgetProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };
  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };
  const pressedBackgroundColor = (palette.surface ?? palette.surfaceAlt) as string;
  const clearButtonColor = palette.text as string;

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      style={({ pressed }) => ({
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        gap: BrandSpacing.sm,
        minHeight: BrandSpacing.xxl + BrandSpacing.md,
        borderRadius: BrandRadius.input,
        borderCurve: "continuous" as const,
        paddingHorizontal: BrandSpacing.lg,
        paddingVertical: BrandSpacing.md,
        borderWidth: isFocused ? 1.5 : 1,
        borderColor: isFocused
          ? (palette.primary as string)
          : ((palette.borderStrong ?? palette.surfaceAlt) as string),
        backgroundColor: pressed
          ? pressedBackgroundColor
          : ((palette.appBg ?? palette.surfaceAlt) as string),
        borderTopColor: isFocused
          ? (palette.primary as string)
          : ((palette.borderStrong ?? palette.surfaceAlt) as string),
        borderLeftColor: isFocused
          ? (palette.primary as string)
          : ((palette.borderStrong ?? palette.surfaceAlt) as string),
      })}
    >
      <IconSymbol name="magnifyingglass" size={18} color={palette.textMuted as string} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted as string}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoFocus={autoFocus}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        className="text-brand"
        style={{
          flex: 1,
          fontFamily: "Manrope_400Regular",
          fontSize: 16,
          fontWeight: "400",
          lineHeight: 22,
          padding: 0,
          margin: 0,
        }}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={8}
          style={({ pressed }) => ({
            borderRadius: BrandRadius.pill,
            backgroundColor: pressed ? pressedBackgroundColor : clearButtonColor,
          })}
        >
          <IconSymbol name="xmark.circle.fill" size={18} color={palette.primary as string} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}
