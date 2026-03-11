import * as ExpoLinking from "expo-linking";
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  parseRapydReturnUrl,
  type RapydReturnKind,
  type RapydReturnPayload,
} from "@/lib/rapyd-hosted-flow";

type RapydReturnMap = Partial<Record<RapydReturnKind, RapydReturnPayload>>;

type RapydReturnContextValue = {
  clearReturn: (kind: RapydReturnKind) => void;
  consumeReturn: (kind: RapydReturnKind) => RapydReturnPayload | null;
  latestReturns: RapydReturnMap;
  recordReturnUrl: (url: string) => RapydReturnPayload | null;
};

const RapydReturnContext = createContext<RapydReturnContextValue | null>(null);

const cloneReturnMap = (value: RapydReturnMap): RapydReturnMap => ({ ...value });

export function RapydReturnProvider({ children }: React.PropsWithChildren) {
  const latestReturnsRef = useRef<RapydReturnMap>({});
  const [latestReturns, setLatestReturns] = useState<RapydReturnMap>({});

  const setLatestReturnsSnapshot = useCallback((next: RapydReturnMap) => {
    latestReturnsRef.current = next;
    setLatestReturns(next);
  }, []);

  const recordReturnUrl = useCallback(
    (url: string) => {
      const payload = parseRapydReturnUrl(url);
      if (!payload) {
        return null;
      }

      const existing = latestReturnsRef.current[payload.kind];
      if (existing?.url === payload.url) {
        return existing;
      }

      setLatestReturnsSnapshot({
        ...latestReturnsRef.current,
        [payload.kind]: payload,
      });
      return payload;
    },
    [setLatestReturnsSnapshot],
  );

  const clearReturn = useCallback(
    (kind: RapydReturnKind) => {
      if (!latestReturnsRef.current[kind]) {
        return;
      }
      const next = cloneReturnMap(latestReturnsRef.current);
      delete next[kind];
      setLatestReturnsSnapshot(next);
    },
    [setLatestReturnsSnapshot],
  );

  const consumeReturn = useCallback(
    (kind: RapydReturnKind) => {
      const payload = latestReturnsRef.current[kind] ?? null;
      if (!payload) {
        return null;
      }
      clearReturn(kind);
      return payload;
    },
    [clearReturn],
  );

  useEffect(() => {
    void ExpoLinking.getInitialURL().then((url) => {
      if (url) {
        recordReturnUrl(url);
      }
    });

    const subscription = ExpoLinking.addEventListener("url", ({ url }) => {
      recordReturnUrl(url);
    });
    return () => {
      subscription.remove();
    };
  }, [recordReturnUrl]);

  const value = useMemo<RapydReturnContextValue>(
    () => ({
      clearReturn,
      consumeReturn,
      latestReturns,
      recordReturnUrl,
    }),
    [clearReturn, consumeReturn, latestReturns, recordReturnUrl],
  );

  return <RapydReturnContext value={value}>{children}</RapydReturnContext>;
}

export function useRapydReturn(kind: RapydReturnKind) {
  const context = React.use(RapydReturnContext);
  if (!context) {
    throw new Error("useRapydReturn must be used inside RapydReturnProvider");
  }

  return {
    clearReturn: () => context.clearReturn(kind),
    consumeReturn: () => context.consumeReturn(kind),
    latestReturn: context.latestReturns[kind] ?? null,
    recordReturnUrl: context.recordReturnUrl,
  };
}
