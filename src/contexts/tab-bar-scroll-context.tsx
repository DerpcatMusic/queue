import { createContext, useCallback, useContext, useMemo, useRef } from "react";

type ScrollDirection = "up" | "down" | "idle";

export type TabBarScrollSignal = {
  routeKey: string;
  offset: number;
  direction: ScrollDirection;
  velocity: number;
  at: number;
};

type TabBarScrollContextValue = {
  publishSignal: (signal: TabBarScrollSignal) => void;
  getSignal: (routeKey: string) => TabBarScrollSignal | null;
};

const TabBarScrollContext = createContext<TabBarScrollContextValue | null>(null);

export function TabBarScrollProvider({ children }: { children: React.ReactNode }) {
  const signalMapRef = useRef<Map<string, TabBarScrollSignal>>(new Map());

  const publishSignal = useCallback((signal: TabBarScrollSignal) => {
    signalMapRef.current.set(signal.routeKey, signal);
  }, []);

  const getSignal = useCallback((routeKey: string) => {
    return signalMapRef.current.get(routeKey) ?? null;
  }, []);

  const value = useMemo<TabBarScrollContextValue>(
    () => ({ publishSignal, getSignal }),
    [getSignal, publishSignal],
  );

  return <TabBarScrollContext.Provider value={value}>{children}</TabBarScrollContext.Provider>;
}

export function useTabBarScrollContext() {
  const context = useContext(TabBarScrollContext);
  if (!context) {
    throw new Error("useTabBarScrollContext must be used within TabBarScrollProvider");
  }
  return context;
}
