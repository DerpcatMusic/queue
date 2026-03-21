import { useRef, useState } from "react";
import type { ColorValue } from "react-native";
import { Pressable, TextInput } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";

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

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      style={({ pressed }) => ({
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        gap: BrandSpacing.sm,
        minHeight: BrandSpacing.xxl + BrandSpacing.md,
        backgroundColor: (palette.appBg ?? palette.surfaceAlt) as string,
        borderRadius: BrandRadius.input,
        borderCurve: "continuous" as const,
        paddingHorizontal: BrandSpacing.lg,
        paddingVertical: BrandSpacing.md,
        borderWidth: isFocused ? 1.5 : 1,
        borderColor: isFocused
          ? (palette.primary as string)
          : ((palette.borderStrong ?? palette.surfaceAlt) as string),
        opacity: pressed ? 0.96 : 1,
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
        style={{
          flex: 1,
          ...BrandType.body,
          color: palette.text as string,
          padding: 0,
          margin: 0,
        }}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <IconSymbol name="xmark.circle.fill" size={18} color={palette.textMuted as string} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}
