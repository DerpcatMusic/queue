import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type Animated from "react-native-reanimated";
import { useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";

import { BrandSpacing } from "@/theme/theme";

type ScrollSheetScrollContextValue = {
  scrollY: ReturnType<typeof useSharedValue<number>>;
};

type ScrollSheetLayoutContextValue = {
  store: ScrollSheetLayoutStore;
  setCollapsedSheetHeight: (height: number) => void;
  setLayoutSheetHeight: (height: number) => void;
  setSceneViewportHeight: (height: number) => void;
  safeTop: number;
  safeBottom: number;
  overlayBottom: number;
};

type ScrollSheetLayoutSnapshot = {
  collapsedSheetHeight: number;
  layoutSheetHeight: number;
  sceneViewportHeight: number;
};

type ScrollSheetLayoutStore = {
  getSnapshot: () => ScrollSheetLayoutSnapshot;
  subscribe: (listener: () => void) => () => void;
  setCollapsedSheetHeight: (height: number) => void;
  setLayoutSheetHeight: (height: number) => void;
  setSceneViewportHeight: (height: number) => void;
};

export const ScrollSheetScrollContext = createContext<ScrollSheetScrollContextValue | null>(null);
export const ScrollSheetLayoutContext = createContext<ScrollSheetLayoutContextValue | null>(null);

function createScrollSheetLayoutStore(
  initialSnapshot: ScrollSheetLayoutSnapshot,
): ScrollSheetLayoutStore {
  let snapshot = initialSnapshot;
  const listeners = new Set<() => void>();

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setCollapsedSheetHeight: (height) => {
      if (Math.abs(snapshot.collapsedSheetHeight - height) < 1) {
        return;
      }
      snapshot = {
        ...snapshot,
        collapsedSheetHeight: height,
      };
      emit();
    },
    setLayoutSheetHeight: (height) => {
      if (Math.abs(snapshot.layoutSheetHeight - height) < 1) {
        return;
      }
      snapshot = {
        ...snapshot,
        layoutSheetHeight: height,
      };
      emit();
    },
    setSceneViewportHeight: (height) => {
      if (Math.abs(snapshot.sceneViewportHeight - height) < 1) {
        return;
      }
      snapshot = {
        ...snapshot,
        sceneViewportHeight: height,
      };
      emit();
    },
  };
}

export function ScrollSheetProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const layoutStoreRef = useRef<ScrollSheetLayoutStore | null>(null);
  if (!layoutStoreRef.current) {
    layoutStoreRef.current = createScrollSheetLayoutStore({
      collapsedSheetHeight: 0,
      layoutSheetHeight: 0,
      sceneViewportHeight: 0,
    });
  }
  const updateCollapsedSheetHeight = useCallback((height: number) => {
    layoutStoreRef.current?.setCollapsedSheetHeight(height);
  }, []);
  const updateLayoutSheetHeight = useCallback((height: number) => {
    layoutStoreRef.current?.setLayoutSheetHeight(height);
  }, []);
  const updateSceneViewportHeight = useCallback((height: number) => {
    layoutStoreRef.current?.setSceneViewportHeight(height);
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
      store: layoutStoreRef.current!,
      setCollapsedSheetHeight: updateCollapsedSheetHeight,
      setLayoutSheetHeight: updateLayoutSheetHeight,
      setSceneViewportHeight: updateSceneViewportHeight,
      safeTop: insets.top,
      safeBottom: insets.bottom,
      overlayBottom,
    }),
    [
      insets.bottom,
      insets.top,
      overlayBottom,
      updateCollapsedSheetHeight,
      updateLayoutSheetHeight,
      updateSceneViewportHeight,
    ],
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
  return useSyncExternalStore(
    ctx?.store.subscribe ?? (() => () => {}),
    () => ctx?.store.getSnapshot().collapsedSheetHeight ?? 0,
    () => ctx?.store.getSnapshot().collapsedSheetHeight ?? 0,
  );
}

export function useLayoutSheetHeight(): number {
  const ctx = useContext(ScrollSheetLayoutContext);
  return useSyncExternalStore(
    ctx?.store.subscribe ?? (() => () => {}),
    () => ctx?.store.getSnapshot().layoutSheetHeight ?? 0,
    () => ctx?.store.getSnapshot().layoutSheetHeight ?? 0,
  );
}

export function useSceneViewportHeight(): number {
  const ctx = useContext(ScrollSheetLayoutContext);
  return useSyncExternalStore(
    ctx?.store.subscribe ?? (() => () => {}),
    () => ctx?.store.getSnapshot().sceneViewportHeight ?? 0,
    () => ctx?.store.getSnapshot().sceneViewportHeight ?? 0,
  );
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
