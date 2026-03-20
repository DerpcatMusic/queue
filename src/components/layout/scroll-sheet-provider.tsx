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

export type ScrollSheetContextValue = {
  scrollY: ReturnType<typeof useSharedValue<number>>;
  collapsedSheetHeight: number;
  setCollapsedSheetHeight: (height: number) => void;
};

export const ScrollSheetContext = createContext<ScrollSheetContextValue | null>(null);

export function ScrollSheetProvider({ children }: PropsWithChildren) {
  const scrollY = useSharedValue(0);
  const [collapsedSheetHeight, setCollapsedSheetHeight] = useState(140);
  const updateCollapsedSheetHeight = useCallback((height: number) => {
    setCollapsedSheetHeight((current) => (Math.abs(current - height) < 1 ? current : height));
  }, []);

  const value = useMemo<ScrollSheetContextValue>(
    () => ({
      scrollY,
      collapsedSheetHeight,
      setCollapsedSheetHeight: updateCollapsedSheetHeight,
    }),
    [collapsedSheetHeight, scrollY, updateCollapsedSheetHeight],
  );

  return <ScrollSheetContext.Provider value={value}>{children}</ScrollSheetContext.Provider>;
}

export function useScrollSheetBindings() {
  const ctx = useContext(ScrollSheetContext);
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
  const ctx = useContext(ScrollSheetContext);
  return ctx?.collapsedSheetHeight ?? 140;
}
