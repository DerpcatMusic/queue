import { usePathname } from "expo-router";
import { isValidElement, useCallback, useEffect, useRef } from "react";
import {
  Platform,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import Reanimated, {
  FadeIn,
  FadeOut,
  ReduceMotion,
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
import { useTheme } from "@/hooks/use-theme";
import { getFallbackSheetColors, resolveTopSheetRouteTab } from "./global-top-sheet.helpers";
import { getTopSheetStepHeights } from "./top-sheet.helpers";

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
  const theme = useTheme();
  const pathname = usePathname();
  const { safeBottom, safeTop } = useAppInsets();
  const { height: screenHeight } = useWindowDimensions();
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
  const measuredHeightRef = useRef<number | null>(null);
  const transitionKey = activeRouteKey ?? activeTabId ?? activeConfig?.tabId ?? "global-top-sheet";
  const fallbackColors = activeConfig
    ? getFallbackSheetColors(activeConfig.tabId)
    : {
        backgroundColor: theme.color.primary,
        topInsetColor: theme.color.primary,
      };

  const baseSheetProps = activeConfig
    ? {
        ...(activeConfig.draggable !== undefined ? { draggable: activeConfig.draggable } : {}),
        ...(activeConfig.expandable !== undefined ? { expandable: activeConfig.expandable } : {}),
        ...(activeConfig.steps ? { steps: activeConfig.steps } : {}),
        ...(activeConfig.initialStep !== undefined
          ? { initialStep: activeConfig.initialStep }
          : {}),
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
      }
    : null;
  const hasRenderableContent = Boolean(
    activeConfig &&
      (activeConfig.render ||
        activeConfig.content ||
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
  const staticCollapsedHeight =
    activeConfig && (!activeConfig.render || richResult)
      ? (getTopSheetStepHeights(
          richResult?.steps ?? activeConfig.steps ?? [0.18, 0.4, 0.65, 0.95],
          screenHeight,
          safeTop,
          safeBottom,
        )[0] ?? DEFAULT_SHEET_PADDING_TOP) + safeTop
      : null;

  useEffect(() => {
    if (!activeConfig) {
      setCollapsedSheetHeight(DEFAULT_SHEET_PADDING_TOP);
      return;
    }

    if (staticCollapsedHeight !== null) {
      setCollapsedSheetHeight(staticCollapsedHeight);
      return;
    }

    setCollapsedSheetHeight(measuredHeightRef.current ?? DEFAULT_SHEET_PADDING_TOP);
  }, [activeConfig, setCollapsedSheetHeight, staticCollapsedHeight]);

  const handleMeasuredLayout = useCallback(
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

  const contentTransitionProps = (() => {
    if (reduceMotionEnabled) {
      return {};
    }

    return {
      entering: FadeIn.duration(140).reduceMotion(ReduceMotion.System),
      exiting: FadeOut.duration(90).reduceMotion(ReduceMotion.System),
    };
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
        revealOnExpand: richRevealOnExpand,
        ...richSheetProps
      } = rich;

      return (
        <View pointerEvents="box-none" style={rootStyle}>
          <TopSheet
            {...baseSheetProps}
            {...richSheetProps}
            stickyHeader={renderTransitionedNode("sticky-header", richStickyHeader)}
            stickyFooter={renderTransitionedNode("sticky-footer", richStickyFooter)}
            revealOnExpand={renderTransitionedNode("reveal", richRevealOnExpand, { flex: 1 })}
          >
            {renderTransitionedNode(
              "children",
              richChildren,
              richChildren ? { flex: 1 } : undefined,
            )}
          </TopSheet>
          {activeConfig.overlay ? (
            <Reanimated.View
              key={`${transitionKey}:overlay`}
              style={styles.overlayLayer}
              {...contentTransitionProps}
            >
              {activeConfig.overlay}
            </Reanimated.View>
          ) : null}
        </View>
      );
    }

    return (
      <View pointerEvents="box-none" style={rootStyle}>
        <Reanimated.View
          key={`${transitionKey}:custom`}
          {...contentTransitionProps}
          onLayout={(event) => {
            handleMeasuredLayout(event.nativeEvent.layout.height);
          }}
        >
          {renderResult as React.ReactNode}
        </Reanimated.View>
        {activeConfig.overlay ? (
          <Reanimated.View
            key={`${transitionKey}:overlay`}
            style={styles.overlayLayer}
            {...contentTransitionProps}
          >
            {activeConfig.overlay}
          </Reanimated.View>
        ) : null}
      </View>
    );
  }

  if (!hasRenderableContent) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={rootStyle}>
      <TopSheet {...baseSheetProps!}>
        {renderTransitionedNode(
          "content",
          activeConfig.content,
          activeConfig.content ? { flex: 1 } : undefined,
        )}
      </TopSheet>
      {activeConfig.overlay ? (
        <Reanimated.View
          key={`${transitionKey}:overlay`}
          style={styles.overlayLayer}
          {...contentTransitionProps}
        >
          {activeConfig.overlay}
        </Reanimated.View>
      ) : null}
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
  contentClip: {
    overflow: "hidden",
  },
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 120,
  },
});
