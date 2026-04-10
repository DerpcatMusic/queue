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
  DEFAULT_STEPS,
  GESTURE_ACTIVE_OFFSET_Y,
  GESTURE_FAIL_OFFSET_X,
  HANDLE_HEIGHT,
  HANDLE_PILL_HEIGHT,
  HANDLE_PILL_WIDTH,
  REVEAL_TRANSLATE_OFFSET,
  SHEET_CORNER_RADIUS,
  SHEET_SPRING,
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
  /** Height snap points as fractions of the remaining viewport above the measured base content. */
  steps?: readonly number[];
  /** Step index to start at. @default 0 */
  initialStep?: number;
  /** Controlled active step index. When set, the sheet snaps to this step. */
  activeStep?: number;
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
  void transitionKey; // intentionally unused — kept for interface compatibility
  const animatedBackground = useSharedValue(backgroundColorValue);
  const expandedProgress = useSharedValue(isExpanded ? 1 : 0);

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
  const resolvedBaseHeight = useMemo(
    () => computeCollapsedHeight(chromeHeight + intrinsicContentHeight, availableHeight),
    [availableHeight, chromeHeight, intrinsicContentHeight],
  );

  // Compute step heights as additive growth on top of the measured base height.
  const stepHeights = useMemo(
    () => computeStepHeights(steps, availableHeight, resolvedBaseHeight),
    [availableHeight, resolvedBaseHeight, steps],
  );

  useEffect(() => {
    if (!onMinHeightChange) return;
    onMinHeightChange(resolvedBaseHeight);
  }, [onMinHeightChange, resolvedBaseHeight]);

  // Sheet height shared value
  const defaultHeight = stepHeights[resolvedStepIndex] ?? stepHeights[0] ?? resolvedBaseHeight ?? 0;
  const sheetHeight = useSharedValue(initialHeight ?? defaultHeight);
  const currentStepIndex = useSharedValue(resolvedStepIndex);

  // translateY for drag feedback (GPU-composited, no layout thrash)
  // Only used during active drag; height snaps on release
  const translateY = useSharedValue(0);
  const dragStartHeight = useSharedValue<number | null>(null);

  useAnimatedReaction(
    () => Math.round(sheetHeight.value),
    (next, prev) => {
      if (!onHeightChange || next === prev) return;
      runOnJS(onHeightChange)(next);
    },
    [onHeightChange, sheetHeight],
  );

  const minimumLayoutHeight = stepHeights[initialStep] ?? resolvedBaseHeight ?? defaultHeight;
  const targetLayoutHeight =
    stepHeights[resolvedStepIndex] ?? stepHeights[0] ?? resolvedBaseHeight ?? defaultHeight;

  useAnimatedReaction(
    () => Math.round(expandMode === "overlay" ? minimumLayoutHeight : targetLayoutHeight),
    (next, prev) => {
      if (!onLayoutHeightChange || next === prev) return;
      runOnJS(onLayoutHeightChange)(next);
    },
    [expandMode, minimumLayoutHeight, onLayoutHeightChange, targetLayoutHeight],
  );

  useEffect(() => {
    const clampedStepIndex = Math.max(
      0,
      Math.min(resolvedStepIndex, Math.max(stepHeights.length - 1, 0)),
    );
    const nextHeight = stepHeights[clampedStepIndex] ?? resolvedBaseHeight ?? 0;

    currentStepIndex.value = clampedStepIndex;
    dragStartHeight.value = nextHeight;
    sheetHeight.value = withSpring(nextHeight, SHEET_SPRING);
  }, [
    currentStepIndex,
    dragStartHeight,
    resolvedBaseHeight,
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
          dragStartHeight.value = sheetHeight.value;
          translateY.value = 0;
        })
        .onUpdate((event) => {
          if (expandMode === "overlay") {
            // Overlay: directly adjust height. Sheet is absolutely positioned
            // so height changes are cheap (no scene reflow).
            // Dragging DOWN (translationY > 0) expands; UP collapses.
            const startH = dragStartHeight.value ?? sheetHeight.value;
            sheetHeight.value = Math.max(
              resolvedBaseHeight,
              Math.min(availableHeight, startH + event.translationY),
            );
          } else {
            // Resize: translateY for GPU-composited feedback, height on snap only.
            translateY.value = event.translationY;
          }
        })
        .onEnd((event) => {
          const h = stepHeights;
          if (h.length === 0) return;

          const startHeight = dragStartHeight.value ?? sheetHeight.value;
          dragStartHeight.value = null;

          // Determine which step the sheet should snap to.
          // For overlay mode the height was adjusted during drag so sheetHeight.value
          // already reflects the user's drag position — snap to whichever step is
          // closest to that *current* position, allowing multi-step jumps in a
          // single fast gesture. For resize mode, only the nearest step to the
          // *start* height is known (translateY is visual-only), so we still use
          // the ±1 step approach.
          const fastVelocity = Math.abs(event.velocityY) > VELOCITY_THRESHOLD;

          let targetIdx: number;
          if (expandMode === "overlay") {
            // Overlay: snap to the step closest to where the user actually dragged.
            // A strong velocity flick overrides in that direction.
            const currentHeight = sheetHeight.value;
            let closestIdx = 0;
            let closestDist = Math.abs(currentHeight - h[0]!);
            for (let i = 1; i < h.length; i++) {
              const dist = Math.abs(currentHeight - h[i]!);
              if (dist < closestDist) {
                closestIdx = i;
                closestDist = dist;
              }
            }
            // Velocity override: a fast flick guarantees at least ±1 step in
            // that direction beyond whatever closest-step gravity gives.
            if (fastVelocity) {
              const velocityDir = event.velocityY > 0 ? 1 : -1; // positive velocity = drag down = expand
              const velocityTarget = closestIdx + velocityDir;
              if (velocityTarget >= 0 && velocityTarget < h.length) {
                closestIdx = velocityTarget;
              }
            }
            targetIdx = closestIdx;
          } else {
            // Resize: find nearest step to starting height, then move ±1.
            let nearestStepIdx = 0;
            let minDistance = Math.abs(startHeight - h[0]!);
            for (let index = 1; index < h.length; index++) {
              const distance = Math.abs(startHeight - h[index]!);
              if (distance < minDistance) {
                nearestStepIdx = index;
                minDistance = distance;
              }
            }

            // "down" = expand (higher step index), "up" = collapse (lower step index).
            // Positive velocityY = finger moving down = expand; negative = collapse.
            const direction = fastVelocity
              ? event.velocityY > 0
                ? "down"
                : "up"
              : translateY.value > 0
                ? "down"
                : "up";

            targetIdx =
              direction === "down"
                ? Math.min(nearestStepIdx + 1, h.length - 1)
                : Math.max(nearestStepIdx - 1, 0);
          }

          const targetHeight = h[targetIdx] ?? h[0] ?? resolvedBaseHeight ?? 0;

          if (expandMode === "overlay") {
            // Single spring — no competing translateY animation.
            sheetHeight.value = withSpring(targetHeight, SHEET_SPRING);
          } else {
            // Reset translateY and animate height (single layout recalc on settle).
            translateY.value = withSpring(0, SHEET_SPRING);
            sheetHeight.value = withSpring(targetHeight, SHEET_SPRING);
          }

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
      availableHeight,
      currentStepIndex,
      dragStartHeight,
      expandMode,
      onStepChange,
      resolvedBaseHeight,
      sheetHeight,
      stepHeights,
      translateY,
    ],
  );

  // Overlay vs resize use fundamentally different drag strategies:
  //
  // RESIZE mode:
  //   translateY for GPU-composited drag feedback → single layout recalc on snap.
  //   The sheet pushes scene content down, so avoiding layout-per-frame matters.
  //
  // OVERLAY mode:
  //   Direct height adjustment — the sheet is absolutely positioned (no scene reflow),
  //   so changing height every frame is cheap. The collapsed header stays PINNED;
  //   only the bottom edge grows downward. No translateY → no "whole sheet slides" bug.
  const outerStyle = useAnimatedStyle(() => {
    if (expandMode === "overlay") {
      return {
        height: sheetHeight.value,
        overflow: "hidden" as const,
      };
    }
    return {
      height: sheetHeight.value,
      transform: [{ translateY: translateY.value }],
      overflow: "hidden" as const,
    };
  });

  // Animated inner content uses translateY for reveal (GPU-composited, no layout thrash)
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
  // Sheet has its OWN animation: height morph driven by content.
  // Do NOT add opacity or scale here — that creates the pop/bounce effect.
  // The TabTransitionVeil handles the overlay fade separately.
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
  // NOTE: overlay reveal is handled by shell overflow:hidden clipping —
  // no opacity/translateY animation needed for overlay expanded content.

  // Overlay content pointer events: driven by sheetHeight so content is tappable
  // the moment the shell clips past it, not gated by the step-based isExpanded.
  const overlayContentPointerStyle = useAnimatedStyle(() => {
    // When collapsed (height ≈ minimumLayoutHeight), suppress touches.
    // The 1px buffer prevents floating-point flicker at the boundary.
    if (sheetHeight.value < minimumLayoutHeight + 1) {
      return { opacity: 0 };
    }
    return { opacity: 1 };
  });

  const mainContentFlex =
    hasExpandedContent && expandMode === "resize" ? 0 : hasBaseContent ? 1 : 0;
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

        {/* Overlay expansion: positioned absolutely below collapsed content.
            Shell overflow:hidden provides a clip-reveal effect as height grows —
            no opacity transform needed, the clip IS the animation.
            pointerEvents driven by sheetHeight so content is tappable the moment
            it's unclipped, not gated by the step-based isExpanded boolean. */}
        {revealedContent && expandMode === "overlay" ? (
          <Animated.View
            pointerEvents="auto"
            style={[
              styles.overlayExpandedContent(minimumLayoutHeight, measuredFooterHeight),
              overlayContentPointerStyle,
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
