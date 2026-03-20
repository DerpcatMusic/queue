import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColorValue, StyleProp, ViewStyle } from "react-native";
import { useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useSystemUi } from "@/contexts/system-ui-context";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";
import {
  DEFAULT_STEPS,
  HANDLE_HEIGHT,
  HANDLE_PILL_HEIGHT,
  HANDLE_PILL_WIDTH,
  MIN_BOTTOM_CHROME_ESTIMATE,
  SHEET_SPRING,
} from "./top-sheet.helpers";
import { TopSheetSearchBar } from "./top-sheet-search-bar";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TopSheetPadding = {
  vertical?: number;
  horizontal?: number;
};

export type TopSheetExpandMode = "resize" | "overlay";

export type TopSheetProps = PropsWithChildren<{
  /** Show drag handle and enable pan gestures. @default false */
  draggable?: boolean;
  /** Allow height to change between steps via drag. @default false */
  expandable?: boolean;
  /** Height snap points as fractions of the available content area. */
  steps?: readonly number[];
  /** Step index to start at. @default 0 */
  initialStep?: number;
  /** Controlled active step index. When set, the sheet snaps to this step. */
  activeStep?: number;
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
  activeStep,
  padding,
  backgroundColor,
  topInsetColor,
  style,
  onStepChange,
  stickyHeader,
  stickyFooter,
  revealOnExpand,
  expandMode: _expandMode = "resize", // Reserved for future overlay mode implementation
}: TopSheetProps) {
  const palette = useBrand();
  const { setTopInsetTone, setTopInsetBackgroundColor } = useSystemUi();
  const { safeTop, safeBottom } = useAppInsets();
  const { height: screenHeight } = useWindowDimensions();
  const resolvedBackground = (backgroundColor ?? palette.surfaceElevated) as ColorValue;
  const resolvedInsetColor = (topInsetColor ?? resolvedBackground) as ColorValue;
  const backgroundColorValue = String(resolvedBackground);

  // Track if sheet is expanded (step > initialStep)
  const resolvedStepIndex = activeStep ?? initialStep;
  const [isExpanded, setIsExpanded] = useState(resolvedStepIndex > initialStep);
  const animatedBackground = useSharedValue(backgroundColorValue);

  useEffect(() => {
    animatedBackground.value = withTiming(backgroundColorValue, {
      duration: 220,
    });
  }, [animatedBackground, backgroundColorValue]);

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
  const bottomChromeEstimate = Math.max(MIN_BOTTOM_CHROME_ESTIMATE, safeBottom + 64);
  const availableHeight = screenHeight - safeTop - bottomChromeEstimate;

  // Compute step heights in pixels
  const stepHeights = useMemo(
    () => steps.map((s) => Math.round(s * availableHeight)),
    [steps, availableHeight],
  );

  // Sheet height shared value
  const defaultHeight = stepHeights[resolvedStepIndex] ?? stepHeights[0] ?? 100;
  const sheetHeight = useSharedValue(defaultHeight);

  // Track current step for callbacks
  const currentStepRef = useRef(resolvedStepIndex);
  const dragStartHeight = useSharedValue<number | null>(null);

  useEffect(() => {
    const clampedStepIndex = Math.max(
      0,
      Math.min(resolvedStepIndex, Math.max(stepHeights.length - 1, 0)),
    );
    const nextHeight = stepHeights[clampedStepIndex] ?? 100;

    currentStepRef.current = clampedStepIndex;
    dragStartHeight.value = nextHeight;
    sheetHeight.value = withSpring(nextHeight, SHEET_SPRING);
    setIsExpanded(clampedStepIndex > initialStep);
  }, [dragStartHeight, initialStep, resolvedStepIndex, sheetHeight, stepHeights]);

  // Find step based on drag direction - snap to next step in the direction of drag
  const findDirectionalStep = useCallback(
    (
      currentHeight: number,
      velocityY: number,
      startHeight: number,
    ): { index: number; height: number } => {
      const h = stepHeights;
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

      // Determine direction: use velocity as primary, fallback to position.
      // For a top sheet, dragging down expands and dragging up contracts.
      // If velocity is low, use position relative to start
      const VELOCITY_THRESHOLD = 500;
      let direction: "up" | "down";

      if (Math.abs(velocityY) > VELOCITY_THRESHOLD) {
        direction = velocityY < 0 ? "up" : "down";
      } else {
        // Use position relative to drag start
        direction = currentHeight > startHeight ? "down" : "up";
      }

      // Calculate target step index
      let targetIdx: number;
      if (direction === "down") {
        // Dragging down - expand to the next larger step (or stay at max)
        targetIdx = Math.min(currentStepIdx + 1, h.length - 1);
      } else {
        // Dragging up - contract to the next smaller step (or stay at min)
        targetIdx = Math.max(currentStepIdx - 1, 0);
      }

      return { index: targetIdx, height: h[targetIdx]! };
    },
    [stepHeights],
  );

  const snapToDirectional = useCallback(
    (velocityY: number, currentHeight: number, startHeight: number) => {
      const target = findDirectionalStep(currentHeight, velocityY, startHeight);
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
        .activeOffsetY([-4, 4])
        .failOffsetX([-18, 18])
        .onStart(() => {
          // Record the height when drag starts
          dragStartHeight.value = sheetHeight.value;
        })
        .onUpdate((event) => {
          const h = stepHeights;
          if (h.length === 0) return;
          const minH = h[0]!;
          const maxH = h[h.length - 1]!;
          const startHeight = dragStartHeight.value ?? sheetHeight.value;
          sheetHeight.value = Math.max(minH, Math.min(maxH, startHeight + event.translationY));
        })
        .onEnd((event) => {
          const currentHeight = sheetHeight.value;
          const startHeight = dragStartHeight.value ?? currentHeight;
          dragStartHeight.value = null;
          runOnJS(snapToDirectional)(event.velocityY, currentHeight, startHeight);
        }),
    [dragStartHeight, sheetHeight, snapToDirectional, stepHeights],
  );

  const resolvedPadding = {
    vertical: padding?.vertical ?? BrandSpacing.lg,
    horizontal: padding?.horizontal ?? BrandSpacing.lg,
  };

  // Animated outer container (sets height)
  // No marginTop — sheet extends behind the status bar overlay (zIndex 9999)
  // The AppSafeRoot overlay paints the same purple on top — seamless
  const outerStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
  }));

  // Animated inner content (padding + background)
  const innerStyle = useAnimatedStyle(() => ({
    flex: 1,
    paddingTop: safeTop + resolvedPadding.vertical,
    paddingHorizontal: resolvedPadding.horizontal,
    paddingBottom: resolvedPadding.vertical,
    backgroundColor: animatedBackground.value,
  }));

  const shellBackgroundStyle = useAnimatedStyle(() => ({
    backgroundColor: animatedBackground.value,
  }));

  const mainContentFlex = revealOnExpand ? 0 : 1;
  const revealFlex = revealOnExpand && isExpanded ? 1 : 0;

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
        shellBackgroundStyle,
        outerStyle,
        style,
      ]}
    >
      <Animated.View style={innerStyle}>
        {/* Sticky Header - always visible at top */}
        {stickyHeader ? <View style={{ flex: 0 }}>{stickyHeader}</View> : null}

        {/* Main children - always visible */}
        <View style={{ flex: mainContentFlex }}>{children}</View>

        {/* Reveal on Expand - only shows when expanded */}
        {revealOnExpand && isExpanded ? (
          <View style={{ flex: revealFlex }}>{revealOnExpand}</View>
        ) : null}

        {/* Sticky Footer - always visible at bottom */}
        {stickyFooter ? <View style={{ flex: 0 }}>{stickyFooter}</View> : null}
      </Animated.View>
      {draggable && gestureEnabled ? (
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              {
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: HANDLE_HEIGHT,
                borderTopWidth: 1,
                borderTopColor: palette.border as string,
              },
              shellBackgroundStyle,
            ]}
          >
            <DragHandle borderColor={palette.borderStrong} />
          </Animated.View>
        </GestureDetector>
      ) : draggable ? (
        // Draggable but not expandable - show handle but no gesture
        <Animated.View
          style={[
            {
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: HANDLE_HEIGHT,
              borderTopWidth: 1,
              borderTopColor: palette.border as string,
            },
            shellBackgroundStyle,
          ]}
        >
          <DragHandle borderColor={palette.borderStrong} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );

  return sheetContent;
}

// ─── SearchBar Widget ─────────────────────────────────────────────────────────

// ─── Attach widgets ───────────────────────────────────────────────────────────

TopSheet.SearchBar = TopSheetSearchBar;
