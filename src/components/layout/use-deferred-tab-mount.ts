import { useEffect, useState } from "react";

type DeferredTabMountOptions = {
  delayMs?: number;
};

export function useDeferredTabMount(
  enabled: boolean,
  { delayMs = 48 }: DeferredTabMountOptions = {},
) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!enabled || isReady) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let frameId: number | null = null;
    let idleId: number | null = null;

    const commitReady = () => {
      if (cancelled) return;
      setIsReady(true);
    };

    const queueCommit = () => {
      if (typeof globalThis.requestIdleCallback === "function") {
        idleId = globalThis.requestIdleCallback(() => {
          timeoutId = setTimeout(commitReady, delayMs);
        });
        return;
      }

      timeoutId = setTimeout(commitReady, delayMs);
    };

    frameId = globalThis.requestAnimationFrame(queueCommit);

    return () => {
      cancelled = true;
      if (frameId !== null) {
        globalThis.cancelAnimationFrame(frameId);
      }
      if (idleId !== null && typeof globalThis.cancelIdleCallback === "function") {
        globalThis.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [delayMs, enabled, isReady]);

  return isReady;
}
