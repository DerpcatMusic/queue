import { usePathname } from "expo-router";
import { isValidElement, useCallback, useEffect, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Reanimated, {
  FadeInDown,
  FadeOutUp,
  ReduceMotion,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  useReducedMotion,
} from "react-native-reanimated";

import {
  useScrollSheetLayout,
  useScrollSheetScrollValue,
} from "@/components/layout/scroll-sheet-provider";
import { TopSheet } from "@/components/layout/top-sheet";
import {
  DEFAULT_SHEET_PADDING_TOP,
  useResolvedTabSheetConfig,
} from "@/components/layout/top-sheet-registry";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";
import {
  areSheetConfigsEqual,
  type ContentTransitionDirection,
  getFallbackSheetColors,
  getRouteDepth,
  resolveTopSheetRouteTab,
} from "./global-top-sheet.helpers";

/**
 * One global TopSheet mounted in RoleTabsLayout above NativeTabs.
 *
 * - Reads the active route, looks up the tab config
 * - For simple tabs: renders content inside a standard TopSheet
 * - For custom tabs: calls config.render() which can return:
 *     - ReactNode → used as TopSheet children
 *     - { stickyHeader, children, draggable, ... } → rich result
 * - Reports its collapsed height to ScrollSheetProvider
 */
export function GlobalTopSheet() {
  const pathname = usePathname();
  const { safeTop } = useAppInsets();
  const { height: screenHeight } = useWindowDimensions();
  const palette = useBrand();
  const rootStyle = Platform.OS === "web" ? undefined : styles.overlayRoot;
  const reduceMotionEnabled = useReducedMotion();

  // ── Determine active tab config from route ──────────────────────────
  const activeTabId = resolveTopSheetRouteTab(pathname);
  const routeConfig = useResolvedTabSheetConfig(activeTabId);
  const activeConfig = routeConfig;
  const activeRouteKey = pathname ?? activeTabId;

  // ── ScrollY from provider (for custom animated sheets) ─────────────
  const { setCollapsedSheetHeight } = useScrollSheetLayout();
  const scrollY = useScrollSheetScrollValue();

  const [transitionDirection, setTransitionDirection] =
    useState<ContentTransitionDirection>("vertical");
  const previousRouteKeyRef = useRef<string | null>(activeRouteKey);
  const previousConfigRef = useRef(activeConfig);

  useEffect(() => {
    const previousRouteKey = previousRouteKeyRef.current;
    const previousConfig = previousConfigRef.current;

    if (!activeRouteKey || !activeConfig || reduceMotionEnabled) {
      setTransitionDirection("vertical");
      previousRouteKeyRef.current = activeRouteKey;
      previousConfigRef.current = activeConfig;
      return;
    }

    if (previousRouteKey === activeRouteKey) {
      if (!areSheetConfigsEqual(previousConfig, activeConfig)) {
        setTransitionDirection("vertical");
      }
      previousConfigRef.current = activeConfig;
      return;
    }

    const displayedTabId = resolveTopSheetRouteTab(previousRouteKey);
    const nextTabId = resolveTopSheetRouteTab(activeRouteKey);
    const isSameTabRouteChange = displayedTabId !== null && displayedTabId === nextTabId;

    if (isSameTabRouteChange) {
      const currentDepth = getRouteDepth(previousRouteKey);
      const nextDepth = getRouteDepth(activeRouteKey);
      setTransitionDirection(nextDepth >= currentDepth ? "forward" : "backward");
    } else {
      setTransitionDirection("vertical");
    }

    previousRouteKeyRef.current = activeRouteKey;
    previousConfigRef.current = activeConfig;
  }, [activeConfig, activeRouteKey, reduceMotionEnabled]);

  // ── Measure collapsed sheet height for tab content padding ─────────
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const measuredHeightRef = useRef<number | null>(null);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h <= 0) {
      return;
    }
    if (measuredHeightRef.current !== null && Math.abs(measuredHeightRef.current - h) < 1) {
      return;
    }
    measuredHeightRef.current = h;
    setMeasuredHeight(h);
  }, []);

  const fallbackHeight = (() => {
    const fallbackConfig = activeConfig;
    if (!fallbackConfig) return DEFAULT_SHEET_PADDING_TOP;
    const steps = fallbackConfig.steps ?? [0.18, 0.4, 0.65, 0.95];
    const collapsedStep = steps[0] ?? 0.18;
    return collapsedStep * screenHeight + safeTop;
  })();

  const collapsedSheetHeight = measuredHeight ?? fallbackHeight;

  useEffect(() => {
    setCollapsedSheetHeight(collapsedSheetHeight);
  }, [collapsedSheetHeight, setCollapsedSheetHeight]);

  // ── Render nothing if no config ─────────────────────────────────────
  if (!activeConfig) return null;

  const transitionKey = activeRouteKey ?? activeTabId ?? activeConfig.tabId;
  const fallbackColors = getFallbackSheetColors(activeConfig.tabId, palette);

  const baseSheetProps = {
    ...(activeConfig.draggable !== undefined ? { draggable: activeConfig.draggable } : {}),
    ...(activeConfig.expandable !== undefined ? { expandable: activeConfig.expandable } : {}),
    ...(activeConfig.steps ? { steps: activeConfig.steps } : {}),
    ...(activeConfig.initialStep !== undefined ? { initialStep: activeConfig.initialStep } : {}),
    ...(activeConfig.activeStep !== undefined ? { activeStep: activeConfig.activeStep } : {}),
    ...(activeConfig.expandMode ? { expandMode: activeConfig.expandMode } : {}),
    ...(activeConfig.padding ? { padding: activeConfig.padding } : {}),
    backgroundColor:
      (activeConfig.backgroundColor as string | undefined) ?? fallbackColors.backgroundColor,
    topInsetColor:
      (activeConfig.topInsetColor as string | undefined) ?? fallbackColors.topInsetColor,
    ...(activeConfig.style ? { style: activeConfig.style } : {}),
    ...(activeConfig.onStepChange ? { onStepChange: activeConfig.onStepChange } : {}),
    ...(activeConfig.stickyHeader ? { stickyHeader: activeConfig.stickyHeader } : {}),
    ...(activeConfig.stickyFooter ? { stickyFooter: activeConfig.stickyFooter } : {}),
    ...(activeConfig.revealOnExpand ? { revealOnExpand: activeConfig.revealOnExpand } : {}),
  };
  const hasRenderableContent = Boolean(
    activeConfig.render ||
      activeConfig.content ||
      activeConfig.stickyHeader ||
      activeConfig.stickyFooter ||
      activeConfig.revealOnExpand ||
      activeConfig.overlay,
  );

  const contentTransitionProps = (() => {
    if (reduceMotionEnabled) {
      return {};
    }

    if (transitionDirection === "forward") {
      return {
        entering: SlideInRight.duration(240).reduceMotion(ReduceMotion.System),
        exiting: SlideOutLeft.duration(180).reduceMotion(ReduceMotion.System),
      };
    }

    if (transitionDirection === "backward") {
      return {
        entering: SlideInLeft.duration(240).reduceMotion(ReduceMotion.System),
        exiting: SlideOutRight.duration(180).reduceMotion(ReduceMotion.System),
      };
    }

    return {
      entering: FadeInDown.duration(240).reduceMotion(ReduceMotion.System),
      exiting: FadeOutUp.duration(180).reduceMotion(ReduceMotion.System),
    };
  })();
  const renderTransitionedNode = (
    slotKey: string,
    node: React.ReactNode,
    style?: React.ComponentProps<typeof Reanimated.View>["style"],
  ) => {
    if (!node) return null;
    return (
      <Reanimated.View
        key={`${transitionKey}:${slotKey}`}
        style={style}
        {...contentTransitionProps}
      >
        {node}
      </Reanimated.View>
    );
  };

  // ── Render function mode ────────────────────────────────────────────
  if (activeConfig.render) {
    const result = activeConfig.render({ scrollY });

    const isRichResult =
      typeof result === "object" &&
      result !== null &&
      !isValidElement(result) &&
      !Array.isArray(result);

    if (isRichResult) {
      const rich = result as Omit<React.ComponentProps<typeof TopSheet>, "children"> & {
        children?: React.ReactNode;
      };
      const {
        children: richChildren,
        stickyHeader: richStickyHeader,
        stickyFooter: richStickyFooter,
        revealOnExpand: richRevealOnExpand,
        ...richSheetProps
      } = rich;

      return (
        <View pointerEvents="box-none" style={rootStyle}>
          <Reanimated.View onLayout={handleLayout}>
            <TopSheet
              {...baseSheetProps}
              {...richSheetProps}
              stickyHeader={renderTransitionedNode("sticky-header", richStickyHeader)}
              stickyFooter={renderTransitionedNode("sticky-footer", richStickyFooter)}
              revealOnExpand={renderTransitionedNode("reveal", richRevealOnExpand, { flex: 1 })}
            >
              {renderTransitionedNode("children", richChildren ?? <View style={{ flex: 1 }} />, {
                flex: 1,
              })}
            </TopSheet>
          </Reanimated.View>
          {renderTransitionedNode("overlay", activeConfig.overlay, styles.overlayLayer)}
        </View>
      );
    }

    return (
      <View pointerEvents="box-none" style={rootStyle}>
        <Reanimated.View onLayout={handleLayout}>{result as React.ReactNode}</Reanimated.View>
        {renderTransitionedNode("overlay", activeConfig.overlay, styles.overlayLayer)}
      </View>
    );
  }

  if (!hasRenderableContent) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={rootStyle}>
      <Reanimated.View onLayout={handleLayout}>
        <TopSheet {...baseSheetProps}>
          <Reanimated.View
            key={`${transitionKey}:content`}
            style={{ flex: 1 }}
            {...contentTransitionProps}
          >
            {activeConfig.content}
          </Reanimated.View>
        </TopSheet>
      </Reanimated.View>
      {renderTransitionedNode("overlay", activeConfig.overlay, styles.overlayLayer)}
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
  },
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 120,
  },
});
