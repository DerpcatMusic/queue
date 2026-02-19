import { useCallback, useState } from "react";

import {
  isLocationResolveError,
  normalizeLocationResolveError,
  resolveAddressToZone,
  resolveCoordinatesToZone,
  resolveCurrentLocationToZone,
  type LocationResolveErrorCode,
  type ResolvedLocation,
} from "@/lib/location-zone";

type ResolveAction = "address" | "gps" | "coordinates";
type LocationResolveFailure = {
  action: ResolveAction;
  code: LocationResolveErrorCode;
  message: string;
};

type LocationResolveSuccess = {
  action: ResolveAction;
  value: ResolvedLocation;
};

export type LocationResolveResult =
  | { ok: true; data: LocationResolveSuccess }
  | { ok: false; error: LocationResolveFailure };

export function useLocationResolution() {
  const [isResolving, setIsResolving] = useState(false);
  const [lastErrorCode, setLastErrorCode] = useState<LocationResolveErrorCode | null>(
    null,
  );
  const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<ResolveAction | null>(null);

  const reset = useCallback(() => {
    setLastErrorCode(null);
    setLastErrorMessage(null);
    setLastAction(null);
  }, []);

  const executeResolution = useCallback(
    async (
      action: ResolveAction,
      resolver: () => Promise<ResolvedLocation>,
    ): Promise<LocationResolveResult> => {
      setIsResolving(true);
      reset();
      try {
        const value = await resolver();
        return {
          ok: true,
          data: {
            action,
            value,
          },
        };
      } catch (error) {
        const normalized = isLocationResolveError(error)
          ? error
          : normalizeLocationResolveError(error);
        setLastErrorCode(normalized.code);
        setLastErrorMessage(normalized.message);
        setLastAction(action);
        return {
          ok: false,
          error: {
            action,
            code: normalized.code,
            message: normalized.message,
          },
        };
      } finally {
        setIsResolving(false);
      }
    },
    [reset],
  );

  const resolveFromAddress = useCallback(
    async (address: string): Promise<LocationResolveResult> =>
      executeResolution("address", () => resolveAddressToZone(address)),
    [executeResolution],
  );

  const resolveFromGps = useCallback(
    async (): Promise<LocationResolveResult> =>
      executeResolution("gps", () => resolveCurrentLocationToZone()),
    [executeResolution],
  );

  const resolveFromCoordinates = useCallback(
    async (input: {
      latitude: number;
      longitude: number;
    }): Promise<LocationResolveResult> =>
      executeResolution("coordinates", () => resolveCoordinatesToZone(input)),
    [executeResolution],
  );

  return {
    isResolving,
    lastAction,
    lastErrorCode,
    lastErrorMessage,
    reset,
    resolveFromAddress,
    resolveFromGps,
    resolveFromCoordinates,
  };
}
