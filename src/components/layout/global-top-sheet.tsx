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
import { type LayoutChangeEvent, Platform, StyleSheet, View } from "react-native";
import Reanimated, {
  FadeInDown,
  FadeOutUp,
  ReduceMotion,
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

const CONTENT_EXIT_MS = 120;

function getFallbackSheetColors(tabId: string, palette: ReturnType<typeof useBrand>) {
  if (tabId === "map") {
    return {
      backgroundColor: palette.surfaceElevated as string,
      topInsetColor: palette.surfaceElevated as string,
    };
  }

  return {
    backgroundColor: palette.primary as string,
    topInsetColor: palette.primary as string,
  };
}

function resolveTopSheetRouteTab(pathname: string | null): string | null {
  if (!pathname) return null;
  const clean = pathname.replace(/^\//, "");

  if (!clean) return null;
  if (clean === "sign-in" || clean.endsWith("/sign-in")) {
    return "sign-in";
  }
  if (clean === "onboarding" || clean.endsWith("/onboarding")) {
    return "onboarding";
  }

  const segments = clean.split("/");
  const lastSegment = segments[segments.length - 1];
  if (lastSegment === "sign-in") {
    return "sign-in";
  }

  const tabSegment = segments.length === 1 ? "index" : segments[1];
  return tabSegment || null;
}

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
  const palette = useBrand();
  const rootStyle = Platform.OS === "web" ? undefined : styles.overlayRoot;
  const reduceMotionEnabled = useReducedMotion();
  const transitionTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  // ── Determine active tab config from route ──────────────────────────
  const activeTabId = resolveTopSheetRouteTab(pathname);
  const routeConfig = useResolvedTabSheetConfig(activeTabId);
  const activeConfig = routeConfig;
  const activeRouteKey = activeTabId;

  // ── ScrollY from provider (for custom animated sheets) ─────────────
  const scrollCtx = useContext(ScrollSheetContext);
  const scrollY = scrollCtx?.scrollY ?? null;

  const [displayedConfig, setDisplayedConfig] = useState<TopSheetTabConfig | null>(activeConfig);
  const [displayedRouteKey, setDisplayedRouteKey] = useState<string | null>(activeRouteKey);
  const [contentPhase, setContentPhase] = useState<"visible" | "hidden">("visible");

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
      return;
    }

    if (displayedRouteKey === activeRouteKey) {
      if (displayedConfig !== activeConfig) {
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
      return;
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
    if (!displayedConfig) return DEFAULT_SHEET_PADDING_TOP;
    const steps = displayedConfig.steps ?? [0.18, 0.4, 0.65, 0.95];
    const collapsedStep = steps[0] ?? 0.18;
    return collapsedStep * 844 + safeTop;
  })();

  const collapsedSheetHeight = measuredHeight ?? fallbackHeight;

  useEffect(() => {
    scrollCtx?.setCollapsedSheetHeight(collapsedSheetHeight);
  }, [collapsedSheetHeight, scrollCtx]);

  // ── Render nothing if no config ─────────────────────────────────────
  if (!displayedConfig) return null;

  const transitionKey = displayedRouteKey ?? displayedConfig.tabId;
  const shouldHideContent = contentPhase === "hidden";
  const fallbackColors = getFallbackSheetColors(displayedConfig.tabId, palette);

  const baseSheetProps = {
    ...(displayedConfig.draggable !== undefined ? { draggable: displayedConfig.draggable } : {}),
    ...(displayedConfig.expandable !== undefined ? { expandable: displayedConfig.expandable } : {}),
    ...(displayedConfig.steps ? { steps: displayedConfig.steps } : {}),
    ...(displayedConfig.initialStep !== undefined
      ? { initialStep: displayedConfig.initialStep }
      : {}),
    ...(displayedConfig.activeStep !== undefined ? { activeStep: displayedConfig.activeStep } : {}),
    ...(displayedConfig.expandMode ? { expandMode: displayedConfig.expandMode } : {}),
    ...(displayedConfig.padding ? { padding: displayedConfig.padding } : {}),
    backgroundColor:
      (displayedConfig.backgroundColor as string | undefined) ?? fallbackColors.backgroundColor,
    topInsetColor:
      (displayedConfig.topInsetColor as string | undefined) ?? fallbackColors.topInsetColor,
    ...(displayedConfig.style ? { style: displayedConfig.style } : {}),
    ...(displayedConfig.onStepChange ? { onStepChange: displayedConfig.onStepChange } : {}),
    ...(displayedConfig.stickyHeader ? { stickyHeader: displayedConfig.stickyHeader } : {}),
    ...(displayedConfig.stickyFooter ? { stickyFooter: displayedConfig.stickyFooter } : {}),
    ...(displayedConfig.revealOnExpand ? { revealOnExpand: displayedConfig.revealOnExpand } : {}),
  };
  const hasRenderableContent = Boolean(
    displayedConfig.render ||
      displayedConfig.content ||
      displayedConfig.stickyHeader ||
      displayedConfig.stickyFooter ||
      displayedConfig.revealOnExpand,
  );

  const transitionProps = reduceMotionEnabled ? {} : {};
  const contentTransitionProps = reduceMotionEnabled
    ? {}
    : {
        entering: FadeInDown.duration(240).reduceMotion(ReduceMotion.System),
        exiting: FadeOutUp.duration(180).reduceMotion(ReduceMotion.System),
      };
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
  if (displayedConfig.render) {
    if (!scrollY) return null;

    const result = shouldHideContent ? null : displayedConfig.render({ scrollY });

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
        </View>
      );
    }

    return (
      <View pointerEvents="box-none" style={rootStyle}>
        <Reanimated.View onLayout={handleLayout} {...transitionProps}>
          {result as React.ReactNode}
        </Reanimated.View>
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
              {displayedConfig.content}
            </Reanimated.View>
          )}
        </TopSheet>
      </Reanimated.View>
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
});
