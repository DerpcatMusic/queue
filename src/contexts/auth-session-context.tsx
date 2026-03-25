import { createContext, useContext } from "react";

type AuthSessionContextValue = {
  reloadAuthSession: () => void;
};

const DEFAULT_AUTH_SESSION_CONTEXT: AuthSessionContextValue = {
  reloadAuthSession: () => undefined,
};

const AuthSessionContext = createContext<AuthSessionContextValue>(DEFAULT_AUTH_SESSION_CONTEXT);
export const AuthSessionControllerProvider = AuthSessionContext.Provider;

export function useAuthSession(): AuthSessionContextValue {
  return useContext(AuthSessionContext);
}

export function useAuthSessionController(): AuthSessionContextValue {
  return useAuthSession();
}
