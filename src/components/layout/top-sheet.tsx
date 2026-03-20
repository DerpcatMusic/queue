import { type PropsWithChildren, useEffect, useMemo, useState } from "react";
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

  const [internalStepIndex, setInternalStepIndex] = useState(initialStep);
  const resolvedStepIndex = activeStep ?? internalStepIndex;
  const isExpanded = resolvedStepIndex > initialStep;
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
  const currentStepIndex = useSharedValue(resolvedStepIndex);

  const dragStartHeight = useSharedValue<number | null>(null);

  useEffect(() => {
    const clampedStepIndex = Math.max(
      0,
      Math.min(resolvedStepIndex, Math.max(stepHeights.length - 1, 0)),
    );
    const nextHeight = stepHeights[clampedStepIndex] ?? 100;

    currentStepIndex.value = clampedStepIndex;
    dragStartHeight.value = nextHeight;
    sheetHeight.value = withSpring(nextHeight, SHEET_SPRING);
  }, [currentStepIndex, dragStartHeight, resolvedStepIndex, sheetHeight, stepHeights]);

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

          const VELOCITY_THRESHOLD = 500;
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
          const targetHeight = h[targetIdx] ?? h[0] ?? 100;

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
    [activeStep, currentStepIndex, dragStartHeight, onStepChange, sheetHeight, stepHeights],
  );

  const resolvedPadding = useMemo(
    () => ({
      vertical: padding?.vertical ?? BrandSpacing.lg,
      horizontal: padding?.horizontal ?? BrandSpacing.lg,
    }),
    [padding?.horizontal, padding?.vertical],
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
