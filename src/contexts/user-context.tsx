import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef } from "react";

import { api } from "@/convex/_generated/api";
import {
  rememberCurrentDeviceAccount,
  toDeviceAccountIdentity,
} from "@/modules/session/device-account-store";

type KnownRole = "pending" | "instructor" | "studio" | "admin";
type AppRole = "instructor" | "studio";

function isKnownRole(value: string): value is KnownRole {
  return value === "pending" || value === "instructor" || value === "studio" || value === "admin";
}

interface UserContextValue {
  /** Current user document from Convex, undefined while loading, null if not found */
  currentUser: ReturnType<typeof useQuery<typeof api.users.getCurrentUser>>;
  /** Role from currentUser; kept for backward compatibility with existing consumers */
  effectiveRole: KnownRole | null;
  /** All profile roles currently available on this account */
  availableRoles: AppRole[];
  /** Is auth state still loading? */
  isAuthLoading: boolean;
  /** Is user authenticated? */
  isAuthenticated: boolean;
  /** Deprecated: retained only for compatibility with existing consumers */
  isSyncing: boolean;
  /** Deprecated: retained only for compatibility with existing consumers */
  syncError: string | null;
  /** Deprecated: retained only for compatibility with existing consumers */
  hasAttemptedSync: boolean;
  /** Deprecated: retained only for compatibility with existing consumers */
  retrySync: () => void;
}

const DEFAULT_USER_CONTEXT: UserContextValue = {
  currentUser: undefined,
  effectiveRole: null,
  availableRoles: [],
  isAuthLoading: true,
  isAuthenticated: false,
  isSyncing: false,
  syncError: null,
  hasAttemptedSync: false,
  retrySync: () => undefined,
};

const UserContext = createContext<UserContextValue>(DEFAULT_USER_CONTEXT);

export function UserProvider({ children }: { children: ReactNode }) {
  const { signOut } = useAuthActions();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(api.users.getCurrentUser);
  const forcedSignOutForMissingUserRef = useRef(false);

  useEffect(() => {
    if (isConvexAuthLoading || currentUser === undefined) {
      return;
    }

    if (!isAuthenticated || currentUser) {
      forcedSignOutForMissingUserRef.current = false;
      return;
    }

    if (forcedSignOutForMissingUserRef.current) {
      return;
    }

    forcedSignOutForMissingUserRef.current = true;
    void signOut();
  }, [currentUser, isAuthenticated, isConvexAuthLoading, signOut]);

  useEffect(() => {
    if (isConvexAuthLoading || !isAuthenticated || !currentUser) {
      return;
    }

    void rememberCurrentDeviceAccount(toDeviceAccountIdentity(currentUser));
  }, [currentUser, isAuthenticated, isConvexAuthLoading]);

  const value = useMemo<UserContextValue>(
    () => ({
      currentUser,
      effectiveRole: isKnownRole(currentUser?.role ?? "") ? (currentUser?.role ?? null) : null,
      availableRoles: currentUser?.roles ?? [],
      isAuthLoading: isConvexAuthLoading,
      isAuthenticated,
      isSyncing: false,
      syncError: null,
      hasAttemptedSync: true,
      retrySync: () => undefined,
    }),
    [currentUser, isConvexAuthLoading, isAuthenticated],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  return useContext(UserContext);
}

export { isKnownRole, type KnownRole };
