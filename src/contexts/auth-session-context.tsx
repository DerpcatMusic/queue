import { createContext, useContext } from "react";

type AuthSessionContextValue = {
  isSessionTransitioning: boolean;
  restartAppSession: (options?: {
    immediate?: boolean;
    reloadAuth?: boolean;
    transitionMs?: number;
  }) => void;
  reloadAuthSession: (immediate?: boolean) => void;
  startSessionTransition: (durationMs?: number) => void;
};

const DEFAULT_AUTH_SESSION_CONTEXT: AuthSessionContextValue = {
  isSessionTransitioning: false,
  restartAppSession: () => undefined,
  reloadAuthSession: () => undefined,
  startSessionTransition: () => undefined,
};

const AuthSessionContext = createContext<AuthSessionContextValue>(DEFAULT_AUTH_SESSION_CONTEXT);
export const AuthSessionControllerProvider = AuthSessionContext.Provider;

export function useAuthSession(): AuthSessionContextValue {
  return useContext(AuthSessionContext);
}

export function useAuthSessionController(): AuthSessionContextValue {
  return useAuthSession();
}
