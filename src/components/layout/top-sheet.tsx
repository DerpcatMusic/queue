import {
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import type { ColorValue, StyleProp, ViewStyle } from "react-native";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { useSystemUi } from "@/contexts/system-ui-context";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useTheme } from "@/hooks/use-theme";
import { BrandRadius, BrandSpacing, Motion } from "@/theme/theme";
import {
  ANIMATION_DURATION_EXPANDED_PROGRESS,
  DEFAULT_STEPS,
  GESTURE_ACTIVE_OFFSET_Y,
  GESTURE_FAIL_OFFSET_X,
  HANDLE_HEIGHT,
  HANDLE_PILL_HEIGHT,
  HANDLE_PILL_WIDTH,
  MIN_BOTTOM_CHROME_ESTIMATE,
  REVEAL_TRANSLATE_OFFSET,
  SHEET_CORNER_RADIUS,
  SHEET_SPRING,
  TAB_BAR_ESTIMATE,
  VELOCITY_THRESHOLD,
} from "./top-sheet-constants";
import { TopSheetSearchBar } from "./top-sheet-search-bar";
import {
  computeCollapsedHeight,
  computeIntrinsicMinHeight,
  computeStepHeights,
} from "./top-sheet-sizing";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TopSheetPadding = {
  vertical?: number;
  horizontal?: number;
};

export type TopSheetExpandMode = "resize" | "overlay";
export type TopSheetCollapsedHeightMode = "step" | "content";

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
  /** Absolute minimum sheet height in pixels. */
  minHeight?: number;
  /** How the collapsed sheet height is resolved. @default 'step' */
  collapsedHeightMode?: TopSheetCollapsedHeightMode;
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
  /** Starting sheet height used on mount before animating to resolved height. */
  initialHeight?: number;
  /** Reports the animated outer sheet height. */
  onHeightChange?: (height: number) => void;
  /** Content that always sticks to the top of the sheet (visible always). */
  stickyHeader?: React.ReactNode;
  /** Content that always sticks to the bottom of the sheet (visible always). */
  stickyFooter?: React.ReactNode;
  /** Content that only reveals when sheet is expanded past the initial step. */
  revealOnExpand?: React.ReactNode;
  /** Expand mode: 'resize' pushes content down, 'overlay' overlaps without resizing. @default 'resize' */
  expandMode?: TopSheetExpandMode;
  /** Internal callback for publishing the resolved collapsed height. */
  onMinHeightChange?: (height: number) => void;
}>;

// ─── Drag Handle ──────────────────────────────────────────────────────────────

function DragHandle({ borderColor }: { borderColor: ColorValue }) {
  return (
    <View style={styles.dragHandleContainer}>
      <View style={styles.dragHandlePill(borderColor)} />
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
  initialHeight,
  minHeight,
  collapsedHeightMode = "step",
  padding,
  backgroundColor,
  topInsetColor,
  style,
  onStepChange,
  onHeightChange,
  stickyHeader,
  stickyFooter,
  revealOnExpand,
  expandMode: _expandMode = "resize", // Reserved for future overlay mode implementation
  onMinHeightChange,
}: TopSheetProps) {
  const theme = useTheme();
  const { setTopInsetTone, setTopInsetBackgroundColor } = useSystemUi();
  const { safeTop, safeBottom } = useAppInsets();
  const { height: screenHeight } = useWindowDimensions();
  const resolvedBackground = backgroundColor ?? theme.color.surfaceElevated;
  const resolvedInsetColor = topInsetColor ?? resolvedBackground;
  const backgroundColorValue =
    typeof resolvedBackground === "string" ? resolvedBackground : theme.color.surfaceElevated;
  const sheetGlowColor =
    backgroundColorValue === theme.jobs.canvas || backgroundColorValue === theme.jobs.surface
      ? theme.jobs.glowStrong
      : theme.color.sheetGlowStrong;

  const [internalStepIndex, setInternalStepIndex] = useState(initialStep);
  const [measuredHeaderHeight, setMeasuredHeaderHeight] = useState(0);
  const [measuredBodyHeight, setMeasuredBodyHeight] = useState(0);
  const [measuredFooterHeight, setMeasuredFooterHeight] = useState(0);
  const resolvedStepIndex = activeStep ?? internalStepIndex;
  const isExpanded = resolvedStepIndex > initialStep;
  const animatedBackground = useSharedValue(backgroundColorValue);
  const expandedProgress = useSharedValue(isExpanded ? 1 : 0);

  useEffect(() => {
    animatedBackground.value = withTiming(backgroundColorValue, {
      duration: Motion.normal,
    });
  }, [animatedBackground, backgroundColorValue]);

  useEffect(() => {
    expandedProgress.value = withTiming(isExpanded ? 1 : 0, {
      duration: ANIMATION_DURATION_EXPANDED_PROGRESS,
    });
  }, [expandedProgress, isExpanded]);

  // Inset coloring
  useLayoutEffect(() => {
    setTopInsetTone("sheet");
    setTopInsetBackgroundColor(resolvedInsetColor);
    return () => {
      setTopInsetTone("app");
      setTopInsetBackgroundColor(null);
    };
  }, [resolvedInsetColor, setTopInsetBackgroundColor, setTopInsetTone]);

  // Available height for sheet steps (screen minus safe top minus bottom tabs)
  const bottomChromeEstimate = Math.max(MIN_BOTTOM_CHROME_ESTIMATE, safeBottom + TAB_BAR_ESTIMATE);
  const availableHeight = screenHeight - safeTop - bottomChromeEstimate;

  const resolvedPadding = useMemo(
    () => ({
      vertical: padding?.vertical ?? BrandSpacing.lg,
      horizontal: padding?.horizontal ?? BrandSpacing.lg,
    }),
    [padding?.horizontal, padding?.vertical],
  );

  const intrinsicContentHeight = useMemo(
    () => computeIntrinsicMinHeight(measuredHeaderHeight, measuredFooterHeight, measuredBodyHeight),
    [measuredBodyHeight, measuredFooterHeight, measuredHeaderHeight],
  );
  const chromeHeight = safeTop + resolvedPadding.vertical * 2 + (draggable ? HANDLE_HEIGHT : 0);
  const resolvedMinHeight = useMemo(() => {
    if (collapsedHeightMode === "content") {
      return computeCollapsedHeight(
        chromeHeight + intrinsicContentHeight,
        minHeight ?? 0,
        availableHeight,
      );
    }

    return Math.max(0, Math.ceil(minHeight ?? 0));
  }, [availableHeight, chromeHeight, collapsedHeightMode, intrinsicContentHeight, minHeight]);

  // Compute step heights in pixels
  const stepHeights = useMemo(
    () => computeStepHeights(steps, availableHeight, resolvedMinHeight),
    [availableHeight, resolvedMinHeight, steps],
  );

  useEffect(() => {
    if (!onMinHeightChange) return;
    onMinHeightChange(resolvedMinHeight || stepHeights[0] || 0);
  }, [onMinHeightChange, resolvedMinHeight, stepHeights]);

  // Sheet height shared value
  const defaultHeight =
    stepHeights[resolvedStepIndex] ?? stepHeights[0] ?? (resolvedMinHeight || 100);
  const sheetHeight = useSharedValue(initialHeight ?? defaultHeight);
  const currentStepIndex = useSharedValue(resolvedStepIndex);

  const dragStartHeight = useSharedValue<number | null>(null);

  useAnimatedReaction(
    () => Math.round(sheetHeight.value),
    (next, prev) => {
      if (!onHeightChange || next === prev) return;
      runOnJS(onHeightChange)(next);
    },
    [onHeightChange, sheetHeight],
  );

  useEffect(() => {
    const clampedStepIndex = Math.max(
      0,
      Math.min(resolvedStepIndex, Math.max(stepHeights.length - 1, 0)),
    );
    const nextHeight = stepHeights[clampedStepIndex] ?? resolvedMinHeight ?? 100;

    currentStepIndex.value = clampedStepIndex;
    dragStartHeight.value = nextHeight;
    sheetHeight.value = withSpring(nextHeight, SHEET_SPRING);
  }, [
    currentStepIndex,
    dragStartHeight,
    resolvedMinHeight,
    resolvedStepIndex,
    sheetHeight,
    stepHeights,
  ]);

  // Pan gesture (only active when draggable + expandable)
  const gestureEnabled = draggable && expandable;
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(GESTURE_ACTIVE_OFFSET_Y)
        .failOffsetX(GESTURE_FAIL_OFFSET_X)
        .onStart(() => {
          // Record the height when drag starts
          dragStartHeight.value = sheetHeight.value;
        })
        .onUpdate((event) => {
          const h = stepHeights;
          if (h.length === 0) return;
          const minH = h[0] ?? resolvedMinHeight ?? 100;
          const maxH = h[h.length - 1]!;
          const startHeight = dragStartHeight.value ?? sheetHeight.value;
          sheetHeight.value = Math.max(minH, Math.min(maxH, startHeight + event.translationY));
        })
        .onEnd((event) => {
          const h = stepHeights;
          if (h.length === 0) return;
          const currentHeight = sheetHeight.value;
          const startHeight = dragStartHeight.value ?? currentHeight;
          dragStartHeight.value = null;

          let nearestStepIdx = 0;
          let minDistance = Math.abs(currentHeight - h[0]!);
          for (let index = 1; index < h.length; index++) {
            const distance = Math.abs(currentHeight - h[index]!);
            if (distance < minDistance) {
              nearestStepIdx = index;
              minDistance = distance;
            }
          }

          const direction =
            Math.abs(event.velocityY) > VELOCITY_THRESHOLD
              ? event.velocityY < 0
                ? "up"
                : "down"
              : currentHeight > startHeight
                ? "down"
                : "up";

          const targetIdx =
            direction === "down"
              ? Math.min(nearestStepIdx + 1, h.length - 1)
              : Math.max(nearestStepIdx - 1, 0);
          const targetHeight = h[targetIdx] ?? h[0] ?? resolvedMinHeight ?? 100;

          sheetHeight.value = withSpring(targetHeight, SHEET_SPRING);
          if (targetIdx !== currentStepIndex.value) {
            currentStepIndex.value = targetIdx;
            if (activeStep === undefined) {
              runOnJS(setInternalStepIndex)(targetIdx);
            }
            if (onStepChange) {
              runOnJS(onStepChange)(targetIdx);
            }
          }
        }),
    [
      activeStep,
      currentStepIndex,
      dragStartHeight,
      onStepChange,
      resolvedMinHeight,
      sheetHeight,
      stepHeights,
    ],
  );

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
  const revealStyle = useAnimatedStyle(() => ({
    flex: 1,
    minHeight: 0,
    transform: [
      {
        translateY: (1 - expandedProgress.value) * REVEAL_TRANSLATE_OFFSET,
      },
    ],
  }));

  const mainContentFlex = revealOnExpand ? 0 : 1;
  const shouldUseContentScroll = collapsedHeightMode === "content";
  const bodyScrollEnabled =
    shouldUseContentScroll && chromeHeight + intrinsicContentHeight > availableHeight;

  const updateMeasuredHeight = (setter: Dispatch<SetStateAction<number>>) => (height: number) => {
    if (height <= 0) return;
    setter((current) => (Math.abs(current - height) < 1 ? current : height));
  };

  const handleHeaderLayout = updateMeasuredHeight(setMeasuredHeaderHeight);
  const handleBodyLayout = updateMeasuredHeight(setMeasuredBodyHeight);
  const handleFooterLayout = updateMeasuredHeight(setMeasuredFooterHeight);

  const sheetContent = (
    <Animated.View
      style={[
        styles.sheetShell,
        {
          shadowColor: sheetGlowColor,
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 1,
          shadowRadius: 28,
          elevation: 18,
        },
        shellBackgroundStyle,
        outerStyle,
        style,
      ]}
    >
      <Animated.View style={innerStyle}>
        {/* Sticky Header - always visible at top */}
        {stickyHeader ? (
          <View onLayout={(event) => handleHeaderLayout(event.nativeEvent.layout.height)}>
            {stickyHeader}
          </View>
        ) : null}

        {/* Main children - always visible */}
        {shouldUseContentScroll ? (
          <ScrollView
            bounces={bodyScrollEnabled}
            onContentSizeChange={(_, height) => handleBodyLayout(height)}
            scrollEnabled={bodyScrollEnabled}
            showsVerticalScrollIndicator={bodyScrollEnabled}
            style={styles.scrollBody}
          >
            <View>{children}</View>
          </ScrollView>
        ) : (
          <View
            style={{ flex: mainContentFlex }}
            onLayout={(event) => handleBodyLayout(event.nativeEvent.layout.height)}
          >
            {children}
          </View>
        )}

        {/* Reveal on Expand - stays mounted to avoid React mount churn during snaps */}
        {revealOnExpand ? (
          <Animated.View pointerEvents={isExpanded ? "auto" : "none"} style={revealStyle}>
            {revealOnExpand}
          </Animated.View>
        ) : null}

        {/* Sticky Footer - always visible at bottom */}
        {stickyFooter ? (
          <View onLayout={(event) => handleFooterLayout(event.nativeEvent.layout.height)}>
            {stickyFooter}
          </View>
        ) : null}
      </Animated.View>
      {draggable && gestureEnabled ? (
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.dragHandleZone,
              styles.dragHandleBorder(theme.color.border),
              shellBackgroundStyle,
            ]}
          >
            <DragHandle borderColor={theme.color.borderStrong} />
          </Animated.View>
        </GestureDetector>
      ) : draggable ? (
        // Draggable but not expandable - show handle but no gesture
        <Animated.View
          style={[
            styles.dragHandleZone,
            styles.dragHandleBorder(theme.color.border),
            shellBackgroundStyle,
          ]}
        >
          <DragHandle borderColor={theme.color.borderStrong} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );

  return sheetContent;
}

const styles = StyleSheet.create(() => ({
  dragHandleContainer: {
    alignItems: "center",
    paddingTop: BrandSpacing.sm,
    paddingBottom: BrandSpacing.xs,
  },
  dragHandlePill: (borderColor: ColorValue) => ({
    width: HANDLE_PILL_WIDTH,
    height: HANDLE_PILL_HEIGHT,
    borderRadius: BrandRadius.pill,
    backgroundColor: borderColor,
  }),
  scrollBody: {
    flex: 1,
    minHeight: 0,
  },
  sheetShell: {
    borderBottomLeftRadius: SHEET_CORNER_RADIUS,
    borderBottomRightRadius: SHEET_CORNER_RADIUS,
    borderCurve: "continuous" as const,
    overflow: "hidden" as const,
    zIndex: 100,
  },
  dragHandleZone: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: HANDLE_HEIGHT,
  },
  dragHandleBorder: (borderColor: ColorValue) => ({
    borderTopWidth: 1,
    borderTopColor: borderColor,
  }),
}));

// ─── SearchBar Widget ─────────────────────────────────────────────────────────

// ─── Attach widgets ───────────────────────────────────────────────────────────

TopSheet.SearchBar = TopSheetSearchBar;
