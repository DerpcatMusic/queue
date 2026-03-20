import { useEffect, useState } from "react";

type DeferredTabMountOptions = {
  delayMs?: number;
};

export function useDeferredTabMount(
  enabled: boolean,
  { delayMs = 32 }: DeferredTabMountOptions = {},
) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!enabled || isReady) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let frameId: number | null = null;

    const commitReady = () => {
      if (cancelled) return;
      setIsReady(true);
    };

    frameId = globalThis.requestAnimationFrame(() => {
      timeoutId = setTimeout(commitReady, delayMs);
    });

    return () => {
      cancelled = true;
      if (frameId !== null) {
        globalThis.cancelAnimationFrame(frameId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [delayMs, enabled, isReady]);

  return isReady;
}
