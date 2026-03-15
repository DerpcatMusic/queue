import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColorValue, StyleProp, ViewStyle } from "react-native";
import { Dimensions, Pressable, TextInput, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useSystemUi } from "@/contexts/system-ui-context";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";

// ─── Constants ────────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const SHEET_SPRING = {
  damping: 24,
  stiffness: 220,
  mass: 0.7,
  overshootClamping: true as const,
};

const DEFAULT_STEPS = [0.16, 0.4, 0.65, 0.95] as const;
const HANDLE_HEIGHT = 28;
const HANDLE_PILL_WIDTH = 36;
const HANDLE_PILL_HEIGHT = 4;
const BOTTOM_TABS_ESTIMATE = 80;

// ─── Types ────────────────────────────────────────────────────────────────────

export type TopSheetPadding = {
  vertical?: number;
  horizontal?: number;
};

export type TopSheetExpandMode = "resize" | "overlay";

type TopSheetProps = PropsWithChildren<{
  /** Show drag handle and enable pan gestures. @default false */
  draggable?: boolean;
  /** Allow height to change between steps via drag. @default false */
  expandable?: boolean;
  /** Height snap points as fractions of the available content area. */
  steps?: readonly number[];
  /** Step index to start at. @default 0 */
  initialStep?: number;
  /** Padding inside the sheet below the safe area. */
  padding?: TopSheetPadding;
  /** Background color for the sheet content. */
  backgroundColor?: ColorValue;
  /** Color for the top status bar inset. Defaults to primary (purple). */
  topInsetColor?: ColorValue;
  /** Extra style for the outer animated container. */
  style?: StyleProp<ViewStyle>;
  /** Called when the sheet settles on a new step. */
  onStepChange?: (stepIndex: number) => void;
  /** Content that always sticks to the top of the sheet (visible always). */
  stickyHeader?: React.ReactNode;
  /** Content that always sticks to the bottom of the sheet (visible always). */
  stickyFooter?: React.ReactNode;
  /** Content that only reveals when sheet is expanded past the initial step. */
  revealOnExpand?: React.ReactNode;
  /** Expand mode: 'resize' pushes content down, 'overlay' overlaps without resizing. @default 'resize' */
  expandMode?: TopSheetExpandMode;
}>;

// ─── Drag Handle ──────────────────────────────────────────────────────────────

function DragHandle({ borderColor }: { borderColor: ColorValue }) {
  return (
    <View
      style={{
        alignItems: "center",
        paddingTop: BrandSpacing.sm,
        paddingBottom: BrandSpacing.xs,
      }}
    >
      <View
        style={{
          width: HANDLE_PILL_WIDTH,
          height: HANDLE_PILL_HEIGHT,
          borderRadius: BrandRadius.pill,
          backgroundColor: borderColor,
          opacity: 0.5,
        }}
      />
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TopSheet({
  children,
  draggable = false,
  expandable = false,
  steps = DEFAULT_STEPS,
  initialStep = 0,
  padding,
  backgroundColor,
  topInsetColor,
  style,
  onStepChange,
  stickyHeader,
  stickyFooter,
  revealOnExpand,
  expandMode = "resize",
}: TopSheetProps) {
  const palette = useBrand();
  const { setTopInsetTone, setTopInsetBackgroundColor } = useSystemUi();
  const { safeTop } = useAppInsets();
  const resolvedBackground = (backgroundColor ?? palette.primary) as ColorValue;
  const resolvedInsetColor = (topInsetColor ?? palette.primary) as ColorValue;

  // Track if sheet is expanded (step > initialStep)
  const [isExpanded, setIsExpanded] = useState(initialStep > 0);

  // Inset coloring
  useEffect(() => {
    setTopInsetTone("sheet");
    setTopInsetBackgroundColor(resolvedInsetColor);
    return () => {
      setTopInsetTone("app");
      setTopInsetBackgroundColor(null);
    };
  }, [resolvedInsetColor, setTopInsetBackgroundColor, setTopInsetTone]);

  // Available height for sheet steps (screen minus safe top minus bottom tabs)
  const availableHeight = SCREEN_HEIGHT - safeTop - BOTTOM_TABS_ESTIMATE;

  // Compute step heights in pixels
  const stepHeights = useMemo(
    () => steps.map((s) => Math.round(s * availableHeight)),
    [steps, availableHeight],
  );

  // Sheet height shared value
  const defaultHeight = stepHeights[initialStep] ?? stepHeights[0] ?? 100;
  const sheetHeight = useSharedValue(defaultHeight);

  // Track current step for callbacks
  const currentStepRef = useRef(initialStep);
  const stepsRef = useRef(stepHeights);
  const dragStartHeightRef = useRef<number | null>(null);
  stepsRef.current = stepHeights;

  // Find step based on drag direction - snap to next step in the direction of drag
  const findDirectionalStep = useCallback(
    (
      currentHeight: number,
      velocityY: number,
      startHeight: number,
    ): { index: number; height: number } => {
      const h = stepsRef.current;
      if (h.length === 0) return { index: 0, height: 100 };

      // Find current step index
      let currentStepIdx = 0;
      let minDist = Math.abs(currentHeight - h[0]!);
      for (let i = 1; i < h.length; i++) {
        const dist = Math.abs(currentHeight - h[i]!);
        if (dist < minDist) {
          currentStepIdx = i;
          minDist = dist;
        }
      }

      // Determine direction: use velocity as primary, fallback to position
      // Negative velocity = dragging up = expand (larger step)
      // Positive velocity = dragging down = contract (smaller step)
      // If velocity is low, use position relative to start
      const VELOCITY_THRESHOLD = 500;
      let direction: "up" | "down";

      if (Math.abs(velocityY) > VELOCITY_THRESHOLD) {
        direction = velocityY < 0 ? "up" : "down";
      } else {
        // Use position relative to drag start
        direction = currentHeight < startHeight ? "up" : "down";
      }

      // Calculate target step index
      let targetIdx: number;
      if (direction === "up") {
        // Dragging up - expand to next larger step (or stay at max)
        targetIdx = Math.min(currentStepIdx + 1, h.length - 1);
      } else {
        // Dragging down - contract to next smaller step (or stay at min)
        targetIdx = Math.max(currentStepIdx - 1, 0);
      }

      return { index: targetIdx, height: h[targetIdx]! };
    },
    [],
  );

  const snapToDirectional = useCallback(
    (velocityY: number) => {
      const startHeight = dragStartHeightRef.current ?? sheetHeight.value;
      const target = findDirectionalStep(sheetHeight.value, velocityY, startHeight);
      sheetHeight.value = withSpring(target.height, SHEET_SPRING);
      const wasExpanded = currentStepRef.current > initialStep;
      if (target.index !== currentStepRef.current) {
        currentStepRef.current = target.index;
        // Update expanded state
        const isNowExpanded = target.index > initialStep;
        if (isNowExpanded !== wasExpanded) {
          runOnJS(setIsExpanded)(isNowExpanded);
        }
        if (onStepChange) {
          runOnJS(onStepChange)(target.index);
        }
      }
    },
    [findDirectionalStep, sheetHeight, onStepChange, initialStep],
  );

  // Pan gesture (only active when draggable + expandable)
  const gestureEnabled = draggable && expandable;
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-8, 8])
        .onStart(() => {
          // Record the height when drag starts
          dragStartHeightRef.current = sheetHeight.value;
        })
        .onUpdate((event) => {
          const h = stepsRef.current;
          if (h.length === 0) return;
          const minH = h[0]!;
          const maxH = h[h.length - 1]!;
          sheetHeight.value = Math.max(
            minH,
            Math.min(maxH, sheetHeight.value + event.translationY),
          );
        })
        .onEnd((event) => {
          // Use directional snapping based on drag direction and velocity
          runOnJS(snapToDirectional)(event.velocityY);
        }),
    [sheetHeight, snapToDirectional],
  );

  const resolvedPadding = {
    vertical: padding?.vertical ?? BrandSpacing.lg,
    horizontal: padding?.horizontal ?? BrandSpacing.lg,
  };

  // Animated outer container (sets height)
  const outerStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
    // Overlay mode: position absolutely to overlap content below
    ...(expandMode === "overlay"
      ? {
          position: "absolute",
          left: 0,
          right: 0,
          top: safeTop,
        }
      : {}),
  }));

  // Animated inner content (padding + background)
  const innerStyle = useAnimatedStyle(() => ({
    flex: 1,
    paddingTop: 0, // Insets handled by AppSafeRoot naturally
    paddingHorizontal: resolvedPadding.horizontal,
    paddingBottom: resolvedPadding.vertical,
    backgroundColor: resolvedBackground,
  }));

  const sheetContent = (
    <Animated.View
      style={[
        {
          borderBottomLeftRadius: BrandRadius.card + 4,
          borderBottomRightRadius: BrandRadius.card + 4,
          borderCurve: "continuous" as const,
          overflow: "hidden" as const,
          zIndex: 100,
        },
        outerStyle,
        style,
      ]}
    >
      <Animated.View style={innerStyle}>
        {/* Sticky Header - always visible at top */}
        {stickyHeader ? <View style={{ flex: 0 }}>{stickyHeader}</View> : null}

        {/* Main children - always visible */}
        <View style={{ flex: 1 }}>{children}</View>

        {/* Reveal on Expand - only shows when expanded */}
        {revealOnExpand && isExpanded ? <View style={{ flex: 0 }}>{revealOnExpand}</View> : null}

        {/* Sticky Footer - always visible at bottom */}
        {stickyFooter ? <View style={{ flex: 0 }}>{stickyFooter}</View> : null}
      </Animated.View>
      {draggable && gestureEnabled ? (
        <GestureDetector gesture={panGesture}>
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: HANDLE_HEIGHT,
            }}
          >
            <DragHandle borderColor="#999" />
          </View>
        </GestureDetector>
      ) : draggable ? (
        // Draggable but not expandable - show handle but no gesture
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: HANDLE_HEIGHT,
          }}
        >
          <DragHandle borderColor="#999" />
        </View>
      ) : null}
    </Animated.View>
  );

  return sheetContent;
}

// ─── SearchBar Widget ─────────────────────────────────────────────────────────

type SearchBarWidgetProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  palette: {
    surfaceAlt: ColorValue;
    text: ColorValue;
    textMuted: ColorValue;
    primary: ColorValue;
  };
  onFocus?: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
};

function SearchBarWidget({
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
        flexDirection: "row",
        alignItems: "center",
        gap: BrandSpacing.sm,
        backgroundColor: palette.surfaceAlt as string,
        borderRadius: BrandRadius.card - 6,
        borderCurve: "continuous" as const,
        paddingHorizontal: BrandSpacing.md,
        paddingVertical: BrandSpacing.sm,
        borderWidth: isFocused ? 2 : 0,
        borderColor: isFocused ? (palette.primary as string) : "transparent",
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
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <IconSymbol name="xmark.circle.fill" size={18} color={palette.textMuted as string} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

// ─── Attach widgets ───────────────────────────────────────────────────────────

TopSheet.SearchBar = SearchBarWidget;
