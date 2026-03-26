import type { ColorValue } from "react-native";
import { SearchField, type SearchFieldProps } from "@/components/ui/search-field";

export type TopSheetSearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  palette?: {
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

/**
 * Thin wrapper around SearchField for TopSheet integration.
 *
 * SearchField uses Unistyles with the canonical theme.ts token system.
 * Palette remains supported here because the top sheet is highly dynamic and
 * still needs surface-specific overrides during the rewrite.
 * TODO: remove palette overrides once TopSheet itself is migrated to theme.ts + primitives.
 */
export function TopSheetSearchBar({
  value,
  onChangeText,
  placeholder = "Search...",
  palette,
  onFocus,
  onBlur,
  autoFocus = false,
}: TopSheetSearchBarProps) {
  const handleFocus: SearchFieldProps["onFocus"] = () => {
    onFocus?.();
  };

  const handleBlur: SearchFieldProps["onBlur"] = () => {
    onBlur?.();
  };

  const colorOverrides = palette
    ? {
        backgroundColor: palette.appBg ?? palette.surfaceAlt,
        pressedBackgroundColor: palette.surface ?? palette.surfaceAlt,
        borderColor: palette.borderStrong ?? palette.surfaceAlt,
        focusedBorderColor: palette.primary,
        textColor: palette.text,
        placeholderColor: palette.textMuted,
        iconColor: palette.textMuted,
        clearTintColor: palette.primary,
        clearPressedBackgroundColor: palette.surface ?? palette.surfaceAlt,
      }
    : null;

  return (
    <SearchField
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      {...(colorOverrides ? { colors: colorOverrides } : {})}
      onFocus={handleFocus}
      onBlur={handleBlur}
      autoFocus={autoFocus}
      size="md"
    />
  );
}
