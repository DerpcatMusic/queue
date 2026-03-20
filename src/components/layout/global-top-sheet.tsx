import { usePathname } from "expo-router";
import {
  isValidElement,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
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

import { ScrollSheetContext } from "@/components/layout/scroll-sheet-provider";
import { TopSheet } from "@/components/layout/top-sheet";
import {
  DEFAULT_SHEET_PADDING_TOP,
  type TopSheetTabConfig,
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

const CONTENT_EXIT_MS = 120;

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
  const transitionTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  // ── Determine active tab config from route ──────────────────────────
  const activeTabId = resolveTopSheetRouteTab(pathname);
  const routeConfig = useResolvedTabSheetConfig(activeTabId);
  const activeConfig = routeConfig;
  const activeRouteKey = pathname ?? activeTabId;

  // ── ScrollY from provider (for custom animated sheets) ─────────────
  const scrollCtx = useContext(ScrollSheetContext);
  const scrollY = scrollCtx?.scrollY ?? null;

  const [displayedConfig, setDisplayedConfig] = useState<TopSheetTabConfig | null>(activeConfig);
  const [displayedRouteKey, setDisplayedRouteKey] = useState<string | null>(activeRouteKey);
  const [contentPhase, setContentPhase] = useState<"visible" | "hidden">("visible");
  const [transitionDirection, setTransitionDirection] =
    useState<ContentTransitionDirection>("vertical");

  useEffect(() => {
    for (const timeout of transitionTimeoutsRef.current) {
      clearTimeout(timeout);
    }
    transitionTimeoutsRef.current = [];

    if (!activeRouteKey) {
      setDisplayedConfig(null);
      setDisplayedRouteKey(null);
      setContentPhase("visible");
      return;
    }

    if (!activeConfig) {
      return;
    }

    if (!displayedConfig || !displayedRouteKey) {
      setDisplayedConfig(activeConfig);
      setDisplayedRouteKey(activeRouteKey);
      setContentPhase("visible");
      setTransitionDirection("vertical");
      return;
    }

    if (displayedRouteKey === activeRouteKey) {
      if (!areSheetConfigsEqual(displayedConfig, activeConfig)) {
        startTransition(() => {
          setDisplayedConfig(activeConfig);
        });
      }
      setContentPhase("visible");
      return;
    }

    if (reduceMotionEnabled) {
      setDisplayedConfig(activeConfig);
      setDisplayedRouteKey(activeRouteKey);
      setContentPhase("visible");
      setTransitionDirection("vertical");
      return;
    }

    const displayedTabId = resolveTopSheetRouteTab(displayedRouteKey);
    const nextTabId = resolveTopSheetRouteTab(activeRouteKey);
    const isSameTabRouteChange = displayedTabId !== null && displayedTabId === nextTabId;

    if (isSameTabRouteChange) {
      const currentDepth = getRouteDepth(displayedRouteKey);
      const nextDepth = getRouteDepth(activeRouteKey);
      setTransitionDirection(nextDepth >= currentDepth ? "forward" : "backward");
    } else {
      setTransitionDirection("vertical");
    }

    setContentPhase("hidden");
    transitionTimeoutsRef.current.push(
      setTimeout(() => {
        startTransition(() => {
          setDisplayedConfig(activeConfig);
          setDisplayedRouteKey(activeRouteKey);
          setContentPhase("visible");
        });
      }, CONTENT_EXIT_MS),
    );

    return () => {
      for (const timeout of transitionTimeoutsRef.current) {
        clearTimeout(timeout);
      }
      transitionTimeoutsRef.current = [];
    };
  }, [activeConfig, activeRouteKey, displayedConfig, displayedRouteKey, reduceMotionEnabled]);

  // ── Measure collapsed sheet height for tab content padding ─────────
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setMeasuredHeight(h);
  }, []);

  const fallbackHeight = (() => {
    const fallbackConfig = activeConfig ?? displayedConfig;
    if (!fallbackConfig) return DEFAULT_SHEET_PADDING_TOP;
    const steps = fallbackConfig.steps ?? [0.18, 0.4, 0.65, 0.95];
    const collapsedStep = steps[0] ?? 0.18;
    return collapsedStep * screenHeight + safeTop;
  })();

  const collapsedSheetHeight = measuredHeight ?? fallbackHeight;

  useEffect(() => {
    scrollCtx?.setCollapsedSheetHeight(collapsedSheetHeight);
  }, [collapsedSheetHeight, scrollCtx]);

  // ── Render nothing if no config ─────────────────────────────────────
  const resolvedDisplayedConfig =
    activeRouteKey && displayedRouteKey === activeRouteKey && activeConfig
      ? activeConfig
      : displayedConfig;

  if (!resolvedDisplayedConfig) return null;

  const transitionKey = displayedRouteKey ?? activeRouteKey ?? resolvedDisplayedConfig.tabId;
  const shouldHideContent = contentPhase === "hidden";
  const fallbackColors = getFallbackSheetColors(resolvedDisplayedConfig.tabId, palette);

  const baseSheetProps = {
    ...(resolvedDisplayedConfig.draggable !== undefined
      ? { draggable: resolvedDisplayedConfig.draggable }
      : {}),
    ...(resolvedDisplayedConfig.expandable !== undefined
      ? { expandable: resolvedDisplayedConfig.expandable }
      : {}),
    ...(resolvedDisplayedConfig.steps ? { steps: resolvedDisplayedConfig.steps } : {}),
    ...(resolvedDisplayedConfig.initialStep !== undefined
      ? { initialStep: resolvedDisplayedConfig.initialStep }
      : {}),
    ...(resolvedDisplayedConfig.activeStep !== undefined
      ? { activeStep: resolvedDisplayedConfig.activeStep }
      : {}),
    ...(resolvedDisplayedConfig.expandMode
      ? { expandMode: resolvedDisplayedConfig.expandMode }
      : {}),
    ...(resolvedDisplayedConfig.padding ? { padding: resolvedDisplayedConfig.padding } : {}),
    backgroundColor:
      (resolvedDisplayedConfig.backgroundColor as string | undefined) ??
      fallbackColors.backgroundColor,
    topInsetColor:
      (resolvedDisplayedConfig.topInsetColor as string | undefined) ?? fallbackColors.topInsetColor,
    ...(resolvedDisplayedConfig.style ? { style: resolvedDisplayedConfig.style } : {}),
    ...(resolvedDisplayedConfig.onStepChange
      ? { onStepChange: resolvedDisplayedConfig.onStepChange }
      : {}),
    ...(resolvedDisplayedConfig.stickyHeader
      ? { stickyHeader: resolvedDisplayedConfig.stickyHeader }
      : {}),
    ...(resolvedDisplayedConfig.stickyFooter
      ? { stickyFooter: resolvedDisplayedConfig.stickyFooter }
      : {}),
    ...(resolvedDisplayedConfig.revealOnExpand
      ? { revealOnExpand: resolvedDisplayedConfig.revealOnExpand }
      : {}),
  };
  const hasRenderableContent = Boolean(
    resolvedDisplayedConfig.render ||
      resolvedDisplayedConfig.content ||
      resolvedDisplayedConfig.stickyHeader ||
      resolvedDisplayedConfig.stickyFooter ||
      resolvedDisplayedConfig.revealOnExpand ||
      resolvedDisplayedConfig.overlay,
  );

  const transitionProps = reduceMotionEnabled ? {} : {};
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
  if (resolvedDisplayedConfig.render) {
    if (!scrollY) return null;

    const result = shouldHideContent ? null : resolvedDisplayedConfig.render({ scrollY });

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
          <Reanimated.View onLayout={handleLayout} {...transitionProps}>
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
          {renderTransitionedNode("overlay", resolvedDisplayedConfig.overlay, styles.overlayLayer)}
        </View>
      );
    }

    return (
      <View pointerEvents="box-none" style={rootStyle}>
        <Reanimated.View onLayout={handleLayout} {...transitionProps}>
          {result as React.ReactNode}
        </Reanimated.View>
        {renderTransitionedNode("overlay", resolvedDisplayedConfig.overlay, styles.overlayLayer)}
      </View>
    );
  }

  if (!hasRenderableContent) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={rootStyle}>
      <Reanimated.View onLayout={handleLayout} {...transitionProps}>
        <TopSheet {...baseSheetProps}>
          {shouldHideContent ? null : (
            <Reanimated.View
              key={`${transitionKey}:content`}
              style={{ flex: 1 }}
              {...contentTransitionProps}
            >
              {resolvedDisplayedConfig.content}
            </Reanimated.View>
          )}
        </TopSheet>
      </Reanimated.View>
      {renderTransitionedNode("overlay", resolvedDisplayedConfig.overlay, styles.overlayLayer)}
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
