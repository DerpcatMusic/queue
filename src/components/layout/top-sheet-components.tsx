import { useCallback, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { TopSheet } from "@/components/layout/top-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useAppInsets } from "@/hooks/use-app-insets";

// Height constants matching homepage pattern
export const SEARCH_BAR_HEIGHT = 44;
export const TOP_SHEET_CONTENT_HEIGHT = 100;

// Instagram-style Search Bar - standalone use outside of TopSheet
type SearchBarTopProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  palette: BrandPalette;
  onFocus?: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
};

export function SearchBarTop({
  value,
  onChangeText,
  placeholder = "Search...",
  palette,
  onFocus,
  onBlur,
  autoFocus = false,
}: SearchBarTopProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const { safeTop } = useAppInsets();

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        paddingTop: safeTop + BrandSpacing.xs,
        paddingHorizontal: BrandSpacing.xl,
        paddingBottom: BrandSpacing.xs,
        backgroundColor: palette.surface as string,
      }}
    >
      <Pressable
        onPress={() => inputRef.current?.focus()}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: BrandSpacing.sm,
          backgroundColor: palette.surfaceAlt as string,
          borderRadius: BrandRadius.card - 6,
          borderCurve: "continuous",
          paddingHorizontal: BrandSpacing.md,
          paddingVertical: BrandSpacing.sm,
          borderWidth: isFocused ? 2 : 0,
          borderColor: isFocused ? palette.primary : "transparent",
          opacity: pressed ? 0.9 : 1,
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
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <IconSymbol name="xmark.circle.fill" size={18} color={palette.textMuted as string} />
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}

// Context sheet using the new TopSheet component
type ContextSheetProps = {
  children: React.ReactNode;
  palette: BrandPalette;
  /** Enable drag handle and pan gestures. @default false */
  draggable?: boolean;
  /** Allow height to change between steps via drag. @default false */
  expandable?: boolean;
  /** Height snap points as fractions of the available content area. */
  steps?: readonly number[];
  /** Step index to start at. @default 0 */
  initialStep?: number;
  /** Called when the sheet settles on a new step. */
  onStepChange?: (stepIndex: number) => void;
  /** Content that always sticks to the top of the sheet (visible always). */
  stickyHeader?: React.ReactNode;
  /** Content that always sticks to the bottom of the sheet (visible always). */
  stickyFooter?: React.ReactNode;
  /** Content that only reveals when sheet is expanded past the initial step. */
  revealOnExpand?: React.ReactNode;
  /** Expand mode: 'resize' pushes content down, 'overlay' overlaps without resizing. @default 'resize' */
  expandMode?: "resize" | "overlay";
  /** Color for the top status bar inset. Defaults to primary (purple). */
  topInsetColor?: string;
};

export function ContextSheet({
  children,
  palette,
  draggable = false,
  expandable = false,
  steps,
  initialStep = 0,
  onStepChange,
  stickyHeader,
  stickyFooter,
  revealOnExpand,
  expandMode = "resize",
  topInsetColor,
}: ContextSheetProps) {
  const handleStepChange = useCallback(
    (index: number) => {
      onStepChange?.(index);
    },
    [onStepChange],
  );

  return (
    <TopSheet
      draggable={draggable}
      expandable={expandable}
      steps={steps ?? [0.16, 0.4, 0.65, 0.95]}
      initialStep={initialStep}
      onStepChange={handleStepChange}
      stickyHeader={stickyHeader}
      stickyFooter={stickyFooter}
      revealOnExpand={revealOnExpand}
      expandMode={expandMode}
      topInsetColor={topInsetColor ?? palette.primary}
      backgroundColor={palette.surface as string}
      padding={{
        vertical: BrandSpacing.lg,
        horizontal: BrandSpacing.xl,
      }}
    >
      <View style={{ flex: 1, paddingTop: BrandSpacing.sm }}>{children}</View>
    </TopSheet>
  );
}
