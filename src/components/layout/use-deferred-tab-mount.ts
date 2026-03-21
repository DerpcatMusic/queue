import { useEffect, useState } from "react";

type DeferredTabMountOptions = {
  delayMs?: number;
};

export function useDeferredTabMount(
  enabled: boolean,
  { delayMs = 0 }: DeferredTabMountOptions = {},
) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!enabled || isReady) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const commitReady = () => {
      if (cancelled) return;
      setIsReady(true);
    };

    if (delayMs > 0) {
      timeoutId = setTimeout(commitReady, delayMs);
    } else {
      commitReady();
    }

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [delayMs, enabled, isReady]);

  return isReady;
}
