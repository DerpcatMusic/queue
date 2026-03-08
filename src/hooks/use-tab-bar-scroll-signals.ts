import { useCallback, useMemo, useRef } from "react";
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollViewProps,
} from "react-native";

import {
  useTabBarScrollContext,
  type TabBarScrollSignal,
} from "@/contexts/tab-bar-scroll-context";

type ScrollDirection = TabBarScrollSignal["direction"];

function resolveDirection(delta: number): ScrollDirection {
  if (Math.abs(delta) < 0.5) return "idle";
  return delta > 0 ? "down" : "up";
}

type UseTabBarScrollSignalsResult = {
  onScroll: NonNullable<ScrollViewProps["onScroll"]>;
  getLatestSignal: () => TabBarScrollSignal | null;
};

export function useTabBarScrollSignals(
  routeKey: string,
): UseTabBarScrollSignalsResult {
  const { publishSignal, getSignal } = useTabBarScrollContext();
  const previousOffsetRef = useRef(0);
  const previousAtRef = useRef<number | null>(null);
  const previousDirectionRef = useRef<ScrollDirection>("idle");
  const previousVelocityRef = useRef(0);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = Math.max(0, event.nativeEvent.contentOffset.y);
      const now = Date.now();
      const previousOffset = previousOffsetRef.current;
      const delta = offset - previousOffset;
      const previousAt = previousAtRef.current;
      const elapsedMs =
        previousAt === null ? 16 : Math.max(1, now - previousAt);
      const velocity = Math.abs(delta) / elapsedMs;
      const direction = resolveDirection(delta);

      previousOffsetRef.current = offset;
      previousAtRef.current = now;
      const previousDirection = previousDirectionRef.current;
      const previousVelocity = previousVelocityRef.current;
      const velocityDelta = Math.abs(velocity - previousVelocity);
      const shouldPublish =
        Math.abs(delta) >= 3 ||
        direction !== previousDirection ||
        velocityDelta >= 0.04 ||
        previousAt === null;

      if (!shouldPublish) {
        return;
      }

      previousDirectionRef.current = direction;
      previousVelocityRef.current = velocity;
      publishSignal({
        routeKey,
        offset,
        direction,
        velocity,
        at: now,
      });
    },
    [publishSignal, routeKey],
  );

  const getLatestSignal = useCallback(
    () => getSignal(routeKey),
    [getSignal, routeKey],
  );

  return useMemo(
    () => ({ onScroll, getLatestSignal }),
    [getLatestSignal, onScroll],
  );
}
