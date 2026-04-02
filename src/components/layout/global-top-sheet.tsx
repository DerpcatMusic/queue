import { usePathname } from "expo-router";
import { Fragment, isValidElement, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import {
  type StyleProp,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

import {
  useLayoutSheetHeight,
  useSceneViewportHeight,
  useScrollSheetLayout,
  useScrollSheetScrollValue,
} from "@/components/layout/scroll-sheet-provider";
import { TopSheet } from "@/components/layout/top-sheet";
import { useResolvedTabSheetConfig } from "@/components/layout/top-sheet-registry";
import { useAppInsets } from "@/hooks/use-app-insets";
import { TabSceneDescriptorContext } from "@/modules/navigation/role-tabs-layout";
import type { RoleTabRouteName } from "@/navigation/role-routes";
import {
  buildBaseSheetProps,
  resolveTopSheetRouteIdentity,
  resolveTopSheetRouteTab,
} from "./global-top-sheet.helpers";
import { getTopSheetStepHeights } from "./top-sheet.helpers";
import {
  ANIMATION_DURATION_TOP_SHEET_SHELL,
  DEFAULT_STEPS,
} from "./top-sheet-constants";

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
  const { safeBottom } = useAppInsets();
  const { height: screenHeight } = useWindowDimensions();
  const layoutSheetHeight = useLayoutSheetHeight();
  const sceneViewportHeight = useSceneViewportHeight();
  const blockerHeight = Math.max(0, layoutSheetHeight);
  const reduceMotionEnabled = useReducedMotion();
  const visualSheetHeight = useSharedValue(blockerHeight);
  const availableSheetHeight =
    sceneViewportHeight > 0
      ? sceneViewportHeight + layoutSheetHeight
      : Math.max(0, screenHeight - safeBottom);

  // ── Determine active tab config from route ──────────────────────────
  const activeTabId = resolveTopSheetRouteTab(pathname);
  const routeConfig = useResolvedTabSheetConfig(activeTabId, pathname);

  // ── Merge scene descriptor sheetConfig (from TabSceneDescriptorContext) ──
  const descriptorContext = useContext(TabSceneDescriptorContext);
  const descriptorSheetConfig = descriptorContext?.getDescriptor(
    activeTabId as RoleTabRouteName,
  )?.sheetConfig;

  const activeConfig = useMemo(() => {
    if (!routeConfig) return null;
    if (routeConfig.routeMatchPath) {
      return routeConfig;
    }
    if (!descriptorSheetConfig) return routeConfig;
    return {
      ...descriptorSheetConfig,
      ...routeConfig,
      tabId: activeTabId ?? routeConfig.tabId,
    } as typeof routeConfig & Partial<typeof descriptorSheetConfig>;
  }, [routeConfig, descriptorSheetConfig, activeTabId]);
  const {
    stateKey: sheetStateKey,
    transitionKey,
    routeDepth,
  } = resolveTopSheetRouteIdentity(pathname, activeTabId, activeConfig);

  // ── ScrollY from provider (for custom animated sheets) ─────────────
  const { setCollapsedSheetHeight, setLayoutSheetHeight } = useScrollSheetLayout();
  const scrollY = useScrollSheetScrollValue();
  const measuredHeightRef = useRef<number | null>(null);
  const lastRenderedSheetHeightRef = useRef<number | null>(null);
  const lastCommittedLayoutHeightRef = useRef(0);
  const pendingLayoutHeightRef = useRef<number | null>(null);
  const layoutFreezeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLayoutHeightFrozenRef = useRef(false);
  const previousTabIdRef = useRef<string | null>(activeTabId);
  const previousRouteDepthRef = useRef(routeDepth);
  const baseSheetProps = buildBaseSheetProps(activeConfig);
  const hasRenderableContent = Boolean(
    activeConfig &&
      (activeConfig.render ||
        activeConfig.content ||
        activeConfig.collapsedContent ||
        activeConfig.expandedContent ||
        activeConfig.stickyHeader ||
        activeConfig.stickyFooter ||
        activeConfig.revealOnExpand ||
        activeConfig.overlay),
  );
  const renderResult = activeConfig?.render ? activeConfig.render({ scrollY }) : null;
  const isRichResult =
    typeof renderResult === "object" &&
    renderResult !== null &&
    !isValidElement(renderResult) &&
    !Array.isArray(renderResult);
  const richResult = isRichResult
    ? (renderResult as Omit<React.ComponentProps<typeof TopSheet>, "children"> & {
        children?: React.ReactNode;
      })
    : null;
  const resolvedCollapsedHeightMode =
    richResult?.collapsedHeightMode ?? activeConfig?.collapsedHeightMode ?? "step";
  const resolvedMinHeight = richResult?.minHeight ?? activeConfig?.minHeight;
  const staticCollapsedHeight =
    activeConfig &&
    resolvedCollapsedHeightMode !== "content" &&
    (!activeConfig.render || richResult)
      ? (getTopSheetStepHeights(
          richResult?.steps ?? activeConfig.steps ?? DEFAULT_STEPS,
          availableSheetHeight,
          resolvedMinHeight,
        )[0] ?? 0)
      : null;

  const commitLayoutHeight = useCallback(
    (height: number) => {
      if (height < 0) {
        return;
      }
      pendingLayoutHeightRef.current = null;
      lastCommittedLayoutHeightRef.current = height;
      setLayoutSheetHeight(height);
    },
    [setLayoutSheetHeight],
  );

  useEffect(() => {
    if (!activeConfig) {
      setCollapsedSheetHeight(0);
      commitLayoutHeight(0);
      visualSheetHeight.value = 0;
      return;
    }

    if (staticCollapsedHeight !== null) {
      setCollapsedSheetHeight(staticCollapsedHeight);
      commitLayoutHeight(staticCollapsedHeight);
      visualSheetHeight.value = staticCollapsedHeight;
      return;
    }

    const nextMeasuredHeight = measuredHeightRef.current ?? 0;
    setCollapsedSheetHeight(nextMeasuredHeight);
    commitLayoutHeight(nextMeasuredHeight);
    if (nextMeasuredHeight > 0) {
      visualSheetHeight.value = nextMeasuredHeight;
    }
  }, [
    activeConfig,
    commitLayoutHeight,
    setCollapsedSheetHeight,
    staticCollapsedHeight,
    visualSheetHeight,
  ]);

  const handleMeasuredMinimumHeight = useCallback(
    (height: number) => {
      if (height <= 0) {
        return;
      }
      if (measuredHeightRef.current !== null && Math.abs(measuredHeightRef.current - height) < 1) {
        return;
      }
      measuredHeightRef.current = height;
      setCollapsedSheetHeight(height);
    },
    [setCollapsedSheetHeight],
  );
  const handleSheetHeightChange = useCallback((height: number) => {
    if (height <= 0) return;
    lastRenderedSheetHeightRef.current = height;
    visualSheetHeight.value = height;
  }, [visualSheetHeight]);
  const handleLayoutHeightChange = useCallback(
    (height: number) => {
      if (height <= 0) return;
      if (isLayoutHeightFrozenRef.current) {
        pendingLayoutHeightRef.current = height;
        return;
      }
      commitLayoutHeight(height);
    },
    [commitLayoutHeight],
  );

  // Preserve the previous rendered shell height across tab switches so the next tab can morph
  // from the outgoing shell instead of remounting from its own default size.
  const isPrimaryTabSwitch =
    previousTabIdRef.current !== null && previousTabIdRef.current !== activeTabId;
  const isNestedRouteChange =
    previousTabIdRef.current === activeTabId && previousRouteDepthRef.current !== routeDepth;

  useEffect(() => {
    if (layoutFreezeTimeoutRef.current !== null) {
      clearTimeout(layoutFreezeTimeoutRef.current);
      layoutFreezeTimeoutRef.current = null;
    }

    if (reduceMotionEnabled || (!isPrimaryTabSwitch && !isNestedRouteChange)) {
      isLayoutHeightFrozenRef.current = false;
      return;
    }

    isLayoutHeightFrozenRef.current = true;
    layoutFreezeTimeoutRef.current = setTimeout(() => {
      isLayoutHeightFrozenRef.current = false;
      const nextHeight =
        pendingLayoutHeightRef.current ??
        measuredHeightRef.current ??
        lastCommittedLayoutHeightRef.current;
      commitLayoutHeight(nextHeight);
      layoutFreezeTimeoutRef.current = null;
    }, ANIMATION_DURATION_TOP_SHEET_SHELL + 36);

    return () => {
      if (layoutFreezeTimeoutRef.current !== null) {
        clearTimeout(layoutFreezeTimeoutRef.current);
        layoutFreezeTimeoutRef.current = null;
      }
    };
  }, [commitLayoutHeight, isNestedRouteChange, isPrimaryTabSwitch, reduceMotionEnabled]);

  const continuitySheetProps = {
    ...(!isPrimaryTabSwitch && lastRenderedSheetHeightRef.current !== null
      ? { initialHeight: lastRenderedSheetHeightRef.current }
      : {}),
    onHeightChange: handleSheetHeightChange,
  };

  useEffect(() => {
    previousTabIdRef.current = activeTabId;
    previousRouteDepthRef.current = routeDepth;
  }, [activeTabId, routeDepth]);

  const contentTransitionProps = (() => {
    void reduceMotionEnabled;
    void isPrimaryTabSwitch;
    return {};
  })();
  const renderTransitionedNode = (
    slotKey: string,
    node: React.ReactNode,
    style?: StyleProp<ViewStyle>,
  ) => {
    if (!node) return null;
    return (
      <View style={[styles.contentClip, style]}>
        <Reanimated.View
          key={`${transitionKey}:${slotKey}`}
          style={style}
          {...contentTransitionProps}
        >
          {node}
        </Reanimated.View>
      </View>
    );
  };
  const visualLayerStyle = useAnimatedStyle(() => ({
    height: Math.max(blockerHeight, visualSheetHeight.value),
  }));
  const renderWithinFlowRoot = (sheetNode: React.ReactNode, overlayNode?: React.ReactNode) => (
    <Fragment>
      {blockerHeight > 0 ? <View pointerEvents="none" style={{ height: blockerHeight }} /> : null}
      <Reanimated.View pointerEvents="auto" style={[styles.visualLayer, visualLayerStyle]}>
        <View pointerEvents="box-only" style={styles.hitShield} />
        {sheetNode}
        {overlayNode}
      </Reanimated.View>
    </Fragment>
  );

  // ── Render nothing if no config ─────────────────────────────────────
  if (!activeConfig) return null;

  // ── Render function mode ────────────────────────────────────────────
  if (activeConfig.render) {
    if (richResult && baseSheetProps) {
      const rich = richResult;
      const {
        children: richChildren,
        stickyHeader: richStickyHeader,
        stickyFooter: richStickyFooter,
        collapsedContent: richCollapsedContent,
        expandedContent: richExpandedContent,
        revealOnExpand: richRevealOnExpand,
        ...richSheetProps
      } = rich;

      return (
        renderWithinFlowRoot(
          <TopSheet
            {...baseSheetProps}
            {...continuitySheetProps}
            {...richSheetProps}
            stateKey={sheetStateKey}
            transitionKey={transitionKey}
            onLayoutHeightChange={handleLayoutHeightChange}
            {...(resolvedCollapsedHeightMode === "content"
              ? { onMinHeightChange: handleMeasuredMinimumHeight }
              : {})}
            stickyHeader={renderTransitionedNode("sticky-header", richStickyHeader)}
            stickyFooter={renderTransitionedNode("sticky-footer", richStickyFooter)}
            collapsedContent={renderTransitionedNode("collapsed", richCollapsedContent)}
            expandedContent={renderTransitionedNode("expanded", richExpandedContent, { flex: 1 })}
            revealOnExpand={renderTransitionedNode("reveal", richRevealOnExpand, { flex: 1 })}
          >
            {renderTransitionedNode(
              "children",
              richChildren,
              richChildren && resolvedCollapsedHeightMode !== "content" ? { flex: 1 } : undefined,
            )}
          </TopSheet>,
          activeConfig.overlay ? (
            <Reanimated.View
              key={`${transitionKey}:overlay`}
              style={styles.overlayLayer}
              {...contentTransitionProps}
            >
              {activeConfig.overlay}
            </Reanimated.View>
          ) : undefined,
        )
      );
    }

    return (
      renderWithinFlowRoot(
        <Reanimated.View
          key={`${transitionKey}:custom`}
          {...contentTransitionProps}
          onLayout={(event) => {
            const nextHeight = event.nativeEvent.layout.height;
            handleMeasuredMinimumHeight(nextHeight);
            handleLayoutHeightChange(nextHeight);
          }}
        >
          {renderResult as React.ReactNode}
        </Reanimated.View>,
        activeConfig.overlay ? (
          <Reanimated.View
            key={`${transitionKey}:overlay`}
            style={styles.overlayLayer}
            {...contentTransitionProps}
          >
            {activeConfig.overlay}
          </Reanimated.View>
        ) : undefined,
      )
    );
  }

  if (!hasRenderableContent) {
    return null;
  }

  return (
    renderWithinFlowRoot(
      <TopSheet
        {...baseSheetProps!}
        {...continuitySheetProps}
        stateKey={sheetStateKey}
        transitionKey={transitionKey}
        onLayoutHeightChange={handleLayoutHeightChange}
        {...(resolvedCollapsedHeightMode === "content"
          ? { onMinHeightChange: handleMeasuredMinimumHeight }
          : {})}
      >
        {renderTransitionedNode(
          "content",
          activeConfig.content,
          activeConfig.content && resolvedCollapsedHeightMode !== "content"
            ? { flex: 1 }
            : undefined,
        )}
      </TopSheet>,
      activeConfig.overlay ? (
        <Reanimated.View
          key={`${transitionKey}:overlay`}
          style={styles.overlayLayer}
          {...contentTransitionProps}
        >
          {activeConfig.overlay}
        </Reanimated.View>
      ) : undefined,
    )
  );
}

const styles = StyleSheet.create({
  visualLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: "auto",
    overflow: "visible",
    zIndex: 40,
  },
  hitShield: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  contentClip: {
    overflow: "hidden",
  },
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 120,
  },
});
