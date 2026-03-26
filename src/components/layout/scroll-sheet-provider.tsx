import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type Animated from "react-native-reanimated";
import { useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";

import { BrandSpacing } from "@/theme/theme";

type ScrollSheetScrollContextValue = {
  scrollY: ReturnType<typeof useSharedValue<number>>;
};

type ScrollSheetLayoutContextValue = {
  collapsedSheetHeight: number;
  setCollapsedSheetHeight: (height: number) => void;
  safeTop: number;
  safeBottom: number;
  overlayBottom: number;
};

export const ScrollSheetScrollContext = createContext<ScrollSheetScrollContextValue | null>(null);
export const ScrollSheetLayoutContext = createContext<ScrollSheetLayoutContextValue | null>(null);

export function ScrollSheetProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const [collapsedSheetHeight, setCollapsedSheetHeight] = useState(140);
  const updateCollapsedSheetHeight = useCallback((height: number) => {
    setCollapsedSheetHeight((current) => (Math.abs(current - height) < 1 ? current : height));
  }, []);
  const overlayBottom = BrandSpacing.lg;

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
      safeTop: insets.top,
      safeBottom: insets.bottom,
      overlayBottom,
    }),
    [collapsedSheetHeight, insets.bottom, insets.top, overlayBottom, updateCollapsedSheetHeight],
  );

  return (
    <ScrollSheetScrollContext.Provider value={scrollValue}>
      <ScrollSheetLayoutContext.Provider value={layoutValue}>
        {children}
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
