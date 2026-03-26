import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type Animated from "react-native-reanimated";
import { useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandSpacing } from "@/constants/brand";

// ─── Layout Inset Contract ───────────────────────────────────────────────────
//
// INSET OWNERSHIP RULE (Expo 55 best practice):
//   - Insets are sourced ONCE at the layout root level via ScrollSheetProvider
//   - All layout infrastructure reads from LayoutInsetsContext
//   - Feature screens receive insets via layout infrastructure (TabScreenRoot,
//     TabScreenScrollView, ScreenScaffold) or useAppInsets() which reads context
//   - Direct useSafeAreaInsets() is ONLY acceptable in app-safe-root.tsx (the
//     true root that paints the status bar overlay)
//
// This contract eliminates ad-hoc inset fetching throughout feature files and
// ensures consistent inset propagation across all screens.

export type LayoutInsets = {
  safeTop: number;
  safeBottom: number;
  overlayBottom: number;
};

export const LayoutInsetsContext = createContext<LayoutInsets | null>(null);

export const ScrollSheetScrollContext = createContext<ScrollSheetScrollContextValue | null>(null);
export const ScrollSheetLayoutContext = createContext<ScrollSheetLayoutContextValue | null>(null);

type ScrollSheetScrollContextValue = {
  scrollY: ReturnType<typeof useSharedValue<number>>;
};

type ScrollSheetLayoutContextValue = {
  collapsedSheetHeight: number;
  setCollapsedSheetHeight: (height: number) => void;
};

export function ScrollSheetProvider({ children }: PropsWithChildren) {
  // Source insets once at layout level — this is the ONLY place useSafeAreaInsets()
  // should be called outside of app-safe-root.tsx
  const insets = useSafeAreaInsets();

  const scrollY = useSharedValue(0);
  const [collapsedSheetHeight, setCollapsedSheetHeight] = useState(140);
  const updateCollapsedSheetHeight = useCallback((height: number) => {
    setCollapsedSheetHeight((current) => (Math.abs(current - height) < 1 ? current : height));
  }, []);

  const layoutInsets = useMemo<LayoutInsets>(
    () => ({
      safeTop: insets.top,
      safeBottom: insets.bottom,
      // Native tabs already account for bottom safe area. Floating controls should use
      // the same semantic gutter on both axes instead of double-counting the bottom inset.
      overlayBottom: BrandSpacing.lg,
    }),
    [insets.bottom, insets.top],
  );

  const scrollValue = useMemo<ScrollSheetScrollContextValue>(
    () => ({
      scrollY,
    }),
    [scrollY],
  );
  const layoutValue = useMemo<ScrollSheetLayoutContextValue>(
    () => ({
      collapsedSheetHeight,
      setCollapsedSheetHeight: updateCollapsedSheetHeight,
    }),
    [collapsedSheetHeight, updateCollapsedSheetHeight],
  );

  return (
    <ScrollSheetScrollContext.Provider value={scrollValue}>
      <ScrollSheetLayoutContext.Provider value={layoutValue}>
        <LayoutInsetsContext.Provider value={layoutInsets}>{children}</LayoutInsetsContext.Provider>
      </ScrollSheetLayoutContext.Provider>
    </ScrollSheetScrollContext.Provider>
  );
}

export function useScrollSheetBindings() {
  const ctx = useContext(ScrollSheetScrollContext);
  if (!ctx) {
    throw new Error("useScrollSheetBindings must be used inside <ScrollSheetProvider>");
  }

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      ctx.scrollY.value = event.contentOffset.y;
    },
  });

  return {
    scrollRef,
    onScroll,
    scrollY: ctx.scrollY,
  };
}

export function useCollapsedSheetHeight(): number {
  const ctx = useContext(ScrollSheetLayoutContext);
  return ctx?.collapsedSheetHeight ?? 140;
}

export function useScrollSheetLayout() {
  const ctx = useContext(ScrollSheetLayoutContext);
  if (!ctx) {
    throw new Error("useScrollSheetLayout must be used inside <ScrollSheetProvider>");
  }
  return ctx;
}

export function useScrollSheetScrollValue() {
  const ctx = useContext(ScrollSheetScrollContext);
  if (!ctx) {
    throw new Error("useScrollSheetScrollValue must be used inside <ScrollSheetProvider>");
  }
  return ctx.scrollY;
}
