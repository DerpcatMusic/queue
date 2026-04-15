import type { ColorValue, StyleProp, ViewStyle } from "react-native";

import type { TopSheetProps } from "./top-sheet";
import type { ResolvedTopSheetTabConfig } from "./top-sheet-registry";

export type ContentTransitionDirection = "vertical" | "forward" | "backward";

export type ResolvedBaseSheetProps = Omit<TopSheetProps, "children"> & {
  backgroundColor: ColorValue;
  topInsetColor: ColorValue;
  style?: StyleProp<ViewStyle>;
};

export function areSheetConfigsEqual(
  previous: ResolvedTopSheetTabConfig | null | undefined,
  next: ResolvedTopSheetTabConfig | null | undefined,
) {
  if (previous === next) {
    return true;
  }

  if (!previous || !next) {
    return false;
  }

  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);

  if (previousKeys.length !== nextKeys.length) {
    return false;
  }

  return nextKeys.every((key) =>
    Object.is(
      previous[key as keyof ResolvedTopSheetTabConfig],
      next[key as keyof ResolvedTopSheetTabConfig],
    ),
  );
}

export function buildBaseSheetProps(
  config: ResolvedTopSheetTabConfig | null,
): ResolvedBaseSheetProps | null {
  if (!config) {
    return null;
  }

  return {
    ...(config.draggable !== undefined ? { draggable: config.draggable } : {}),
    ...(config.expandable !== undefined ? { expandable: config.expandable } : {}),
    ...(config.steps ? { steps: config.steps } : {}),
    ...(config.initialStep !== undefined ? { initialStep: config.initialStep } : {}),
    ...(config.activeStep !== undefined ? { activeStep: config.activeStep } : {}),
    ...(config.collapsedHeightMode ? { collapsedHeightMode: config.collapsedHeightMode } : {}),
    ...(config.expandMode ? { expandMode: config.expandMode } : {}),
    ...(config.padding ? { padding: config.padding } : {}),
    ...(config.style ? { style: config.style } : {}),
    ...(config.onStepChange ? { onStepChange: config.onStepChange } : {}),
    ...(config.stickyHeader ? { stickyHeader: config.stickyHeader } : {}),
    ...(config.stickyFooter ? { stickyFooter: config.stickyFooter } : {}),
    ...(config.collapsedContent ? { collapsedContent: config.collapsedContent } : {}),
    ...(config.expandedContent ? { expandedContent: config.expandedContent } : {}),
    ...(config.revealOnExpand ? { revealOnExpand: config.revealOnExpand } : {}),
    ...(config.disableSafeTopPadding !== undefined
      ? { disableSafeTopPadding: config.disableSafeTopPadding }
      : {}),
    ...(config.gradientBackground !== undefined
      ? { gradientBackground: config.gradientBackground }
      : {}),
    ...(config.shadow !== undefined ? { shadow: config.shadow } : {}),
    backgroundColor: config.backgroundColor,
    topInsetColor: config.topInsetColor,
  };
}

export function resolveTopSheetRouteTab(pathname: string | null): string | null {
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

export function getRouteDepth(routeKey: string | null) {
  if (!routeKey) return 0;
  return routeKey.split("/").filter(Boolean).length;
}

type TopSheetRouteIdentity = {
  stateKey: string;
  transitionKey: string;
  routeDepth: number;
};

export function resolveTopSheetRouteIdentity(
  pathname: string | null,
  activeTabId: string | null,
  activeConfig: ResolvedTopSheetTabConfig | null,
): TopSheetRouteIdentity {
  // activeTabId is the tab identifier (index, profile, jobs, calendar, map)
  // pathname is the full route path (e.g., /instructor, /instructor/profile)
  const fallbackKey = activeConfig?.tabId ?? activeTabId ?? "global-top-sheet";

  // Route-scoped sheets own their own measurement/state. Parent tab sheets keep tab-level state.
  const stateKey = activeConfig?.routeMatchPath ?? activeTabId ?? fallbackKey;

  const transitionKey = activeConfig?.routeMatchPath ?? pathname ?? activeTabId ?? fallbackKey;

  return {
    stateKey,
    transitionKey,
    routeDepth: getRouteDepth(pathname),
  };
}
