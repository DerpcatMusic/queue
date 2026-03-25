import { getTheme } from "@/lib/design-system";
import type { TopSheetTabConfig } from "./top-sheet-registry";

export type ContentTransitionDirection = "vertical" | "forward" | "backward";

export function areSheetConfigsEqual(
  previous: TopSheetTabConfig | null | undefined,
  next: TopSheetTabConfig | null | undefined,
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
    Object.is(previous[key as keyof TopSheetTabConfig], next[key as keyof TopSheetTabConfig]),
  );
}

// Real color values for native TopSheet (CSS vars don't resolve in RN native views)
const FALLBACK_THEME = getTheme("light");

export function getFallbackSheetColors(tabId: string) {
  if (tabId === "map") {
    return {
      backgroundColor: FALLBACK_THEME.color.surfaceElevated,
      topInsetColor: FALLBACK_THEME.color.surfaceElevated,
    };
  }

  return {
    backgroundColor: FALLBACK_THEME.color.primary,
    topInsetColor: FALLBACK_THEME.color.primary,
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
