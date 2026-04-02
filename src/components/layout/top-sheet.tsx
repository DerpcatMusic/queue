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
import { BrandRadius, BrandSpacing } from "@/theme/theme";
import { useLayoutSheetHeight, useSceneViewportHeight } from "./scroll-sheet-provider";
import {
  ANIMATION_DURATION_EXPANDED_PROGRESS,
  ANIMATION_DURATION_TOP_SHEET_SHELL,
  DEFAULT_STEPS,
  GESTURE_ACTIVE_OFFSET_Y,
  GESTURE_FAIL_OFFSET_X,
  HANDLE_HEIGHT,
  HANDLE_PILL_HEIGHT,
  HANDLE_PILL_WIDTH,
  REVEAL_TRANSLATE_OFFSET,
  SHEET_CORNER_RADIUS,
  SHEET_SPRING,
  TOP_SHEET_INACTIVE_OPACITY,
  TOP_SHEET_INACTIVE_SCALE,
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
  /** Resets tab-local sheet state without remounting the shell. */
  stateKey?: string;
  /** Triggers a shell transition pulse for route/tab swaps. */
  transitionKey?: string;
  /** Starting sheet height used on mount before animating to resolved height. */
  initialHeight?: number;
  /** Reports the animated outer sheet height. */
  onHeightChange?: (height: number) => void;
  /** Reports the height that should affect surrounding layout. */
  onLayoutHeightChange?: (height: number) => void;
  /** Content that always sticks to the top of the sheet (visible always). */
  stickyHeader?: React.ReactNode;
  /** Content that always sticks to the bottom of the sheet (visible always). */
  stickyFooter?: React.ReactNode;
  /** Content that determines the minimum sheet footprint. Defaults to children. */
  collapsedContent?: React.ReactNode;
  /** Extra content revealed during expansion. */
  expandedContent?: React.ReactNode;
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
  stateKey,
  transitionKey,
  onHeightChange,
  onLayoutHeightChange,
  stickyHeader,
  stickyFooter,
  collapsedContent,
  expandedContent,
  revealOnExpand,
  expandMode = "resize",
  onMinHeightChange,
}: TopSheetProps) {
  const theme = useTheme();
  const { setTopInsetTone, setTopInsetBackgroundColor } = useSystemUi();
  const { safeTop, safeBottom } = useAppInsets();
  const layoutSheetHeight = useLayoutSheetHeight();
  const sceneViewportHeight = useSceneViewportHeight();
  const { height: screenHeight } = useWindowDimensions();
  const resolvedBackground = backgroundColor ?? theme.color.surfaceElevated;
  const resolvedInsetColor = topInsetColor ?? resolvedBackground;
  const backgroundColorValue =
    typeof resolvedBackground === "string" ? resolvedBackground : theme.color.surfaceElevated;

  const [internalStepIndex, setInternalStepIndex] = useState(initialStep);
  const [measuredHeaderHeight, setMeasuredHeaderHeight] = useState(0);
  const [measuredBodyHeight, setMeasuredBodyHeight] = useState(0);
  const [measuredFooterHeight, setMeasuredFooterHeight] = useState(0);
  const resolvedStepIndex = activeStep ?? internalStepIndex;
  const isExpanded = resolvedStepIndex > initialStep;
  const baseContent = collapsedContent ?? children;
  const hasBaseContent = baseContent !== null && baseContent !== undefined;
  const revealedContent = expandedContent ?? revealOnExpand;
  const hasExpandedContent = Boolean(revealedContent);
  const animatedBackground = useSharedValue(backgroundColorValue);
  const expandedProgress = useSharedValue(isExpanded ? 1 : 0);
  const shellTransitionProgress = useSharedValue(1);

  useEffect(() => {
    void stateKey;
    setInternalStepIndex(initialStep);
  }, [initialStep, stateKey]);

  useEffect(() => {
    if (!stickyHeader) {
      setMeasuredHeaderHeight(0);
    }
  }, [stickyHeader]);

  useEffect(() => {
    if (!stickyFooter) {
      setMeasuredFooterHeight(0);
    }
  }, [stickyFooter]);

  useEffect(() => {
    if (!baseContent) {
      setMeasuredBodyHeight(0);
    }
  }, [baseContent]);

  useEffect(() => {
    animatedBackground.value = backgroundColorValue;
  }, [animatedBackground, backgroundColorValue]);

  useEffect(() => {
    expandedProgress.value = withTiming(isExpanded ? 1 : 0, {
      duration: ANIMATION_DURATION_EXPANDED_PROGRESS,
    });
  }, [expandedProgress, isExpanded]);

  useEffect(() => {
    void transitionKey;
    shellTransitionProgress.value = 0;
    shellTransitionProgress.value = withTiming(1, {
      duration: ANIMATION_DURATION_TOP_SHEET_SHELL,
    });
  }, [shellTransitionProgress, transitionKey]);

  // Inset coloring
  useLayoutEffect(() => {
    setTopInsetTone("sheet");
    setTopInsetBackgroundColor(resolvedInsetColor);
    return () => {
      setTopInsetTone("app");
      setTopInsetBackgroundColor(null);
    };
  }, [resolvedInsetColor, setTopInsetBackgroundColor, setTopInsetTone]);

  const availableHeight =
    sceneViewportHeight > 0
      ? sceneViewportHeight + layoutSheetHeight
      : Math.max(0, screenHeight - safeBottom);

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
    onMinHeightChange(stepHeights[initialStep] ?? resolvedMinHeight ?? 0);
  }, [initialStep, onMinHeightChange, resolvedMinHeight, stepHeights]);

  // Sheet height shared value
  const defaultHeight = stepHeights[resolvedStepIndex] ?? stepHeights[0] ?? resolvedMinHeight ?? 0;
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

  const minimumLayoutHeight = stepHeights[initialStep] ?? resolvedMinHeight ?? defaultHeight;
  const targetLayoutHeight =
    stepHeights[resolvedStepIndex] ?? stepHeights[0] ?? resolvedMinHeight ?? defaultHeight;
  const shouldAnimateLayoutHeight = expandMode === "resize" && draggable && expandable;

  useAnimatedReaction(
    () =>
      Math.round(
        expandMode === "overlay"
          ? minimumLayoutHeight
          : shouldAnimateLayoutHeight
            ? sheetHeight.value
            : targetLayoutHeight,
      ),
    (next, prev) => {
      if (!onLayoutHeightChange || next === prev) return;
      runOnJS(onLayoutHeightChange)(next);
    },
    [
      draggable,
      expandable,
      expandMode,
      minimumLayoutHeight,
      onLayoutHeightChange,
      sheetHeight,
      targetLayoutHeight,
      shouldAnimateLayoutHeight,
    ],
  );

  useEffect(() => {
    const clampedStepIndex = Math.max(
      0,
      Math.min(resolvedStepIndex, Math.max(stepHeights.length - 1, 0)),
    );
    const nextHeight = stepHeights[clampedStepIndex] ?? resolvedMinHeight ?? 0;

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
          const minH = h[0] ?? resolvedMinHeight ?? 0;
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
          const targetHeight = h[targetIdx] ?? h[0] ?? resolvedMinHeight ?? 0;

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
  const shellTransitionStyle = useAnimatedStyle(() => {
    const progress = shellTransitionProgress.value;
    const opacity = TOP_SHEET_INACTIVE_OPACITY + (1 - TOP_SHEET_INACTIVE_OPACITY) * progress;
    const scale = TOP_SHEET_INACTIVE_SCALE + (1 - TOP_SHEET_INACTIVE_SCALE) * progress;

    return {
      opacity,
      transform: [{ scale }],
    };
  });
  const revealStyle = useAnimatedStyle(() => ({
    flex: 1,
    minHeight: 0,
    opacity: expandedProgress.value,
    transform: [
      {
        translateY: (1 - expandedProgress.value) * REVEAL_TRANSLATE_OFFSET,
      },
    ],
  }));
  const overlayRevealStyle = useAnimatedStyle(() => ({
    opacity: expandedProgress.value,
    transform: [
      {
        translateY: (1 - expandedProgress.value) * REVEAL_TRANSLATE_OFFSET,
      },
    ],
  }));

  const mainContentFlex =
    hasExpandedContent && expandMode === "resize"
      ? 0
      : hasBaseContent
        ? 1
        : 0;
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
        styles.sheetChrome(theme.color.border),
        shellBackgroundStyle,
        shellTransitionStyle,
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
        {hasBaseContent && shouldUseContentScroll ? (
          <ScrollView
            bounces={bodyScrollEnabled}
            onContentSizeChange={(_, height) => handleBodyLayout(height)}
            scrollEnabled={bodyScrollEnabled}
            showsVerticalScrollIndicator={bodyScrollEnabled}
            style={styles.scrollBody}
          >
            <View>{baseContent}</View>
          </ScrollView>
        ) : hasBaseContent ? (
          <View
            style={styles.collapsedBody(mainContentFlex)}
            onLayout={(event) => handleBodyLayout(event.nativeEvent.layout.height)}
          >
            {baseContent}
          </View>
        ) : null}

        {/* Push expansion participates in layout below the collapsed footprint. */}
        {revealedContent && expandMode === "resize" ? (
          <Animated.View pointerEvents={isExpanded ? "auto" : "none"} style={revealStyle}>
            {revealedContent}
          </Animated.View>
        ) : null}

        {/* Sticky Footer - always visible at bottom */}
        {stickyFooter ? (
          <View onLayout={(event) => handleFooterLayout(event.nativeEvent.layout.height)}>
            {stickyFooter}
          </View>
        ) : null}

        {/* Overlay expansion renders below the collapsed footprint without changing layout. */}
        {revealedContent && expandMode === "overlay" ? (
          <Animated.View
            pointerEvents={isExpanded ? "auto" : "none"}
            style={[
              styles.overlayExpandedContent(minimumLayoutHeight, measuredFooterHeight),
              overlayRevealStyle,
            ]}
          >
            {revealedContent}
          </Animated.View>
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
  collapsedBody: (flex: number) => ({
    flex,
  }),
  overlayExpandedContent: (top: number, bottom: number) => ({
    position: "absolute" as const,
    top,
    right: 0,
    bottom,
    left: 0,
    zIndex: 2,
  }),
  sheetShell: {
    borderBottomLeftRadius: SHEET_CORNER_RADIUS,
    borderBottomRightRadius: SHEET_CORNER_RADIUS,
    borderCurve: "continuous" as const,
    overflow: "hidden" as const,
    zIndex: 100,
  },
  sheetChrome: (borderColor: ColorValue) => ({
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor,
  }),
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
