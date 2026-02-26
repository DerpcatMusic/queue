/**
 * User Context - Shared user state to avoid duplicate queries.
 *
 * This context provides user data to the entire app, eliminating the need
 * for multiple getCurrentUser queries across different components.
 *
 * Performance optimization: Single source of truth for user state,
 * reducing query subscriptions and render cascades on cold start.
 */
import { createContext, useContext, useMemo, useEffect, useState, useCallback, type ReactNode } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

type KnownRole = "pending" | "instructor" | "studio" | "admin";

const ROLE_CACHE_KEY = "queue.lastKnownRole";

function isKnownRole(value: string): value is KnownRole {
  return value === "pending" || value === "instructor" || value === "studio" || value === "admin";
}

interface UserContextValue {
  /** Current user document from Convex, undefined while loading, null if not found */
  currentUser: ReturnType<typeof useQuery<typeof api.users.getCurrentUser>>;
  /** Role from cache (immediately available) or from currentUser */
  effectiveRole: KnownRole | null;
  /** Is auth state still loading? */
  isAuthLoading: boolean;
  /** Is user authenticated? */
  isAuthenticated: boolean;
  /** Is user sync in progress? */
  isSyncing: boolean;
  /** Sync error message if any */
  syncError: string | null;
  /** Has sync been attempted? */
  hasAttemptedSync: boolean;
  /** Retry sync after failure */
  retrySync: () => void;
}

const DEFAULT_USER_CONTEXT: UserContextValue = {
  currentUser: undefined,
  effectiveRole: null,
  isAuthLoading: true,
  isAuthenticated: false,
  isSyncing: false,
  syncError: null,
  hasAttemptedSync: false,
  retrySync: () => undefined,
};

const UserContext = createContext<UserContextValue>(DEFAULT_USER_CONTEXT);

export function UserProvider({ children }: { children: ReactNode }) {
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(api.users.getCurrentUser);
  const syncCurrentUser = useMutation(api.users.syncCurrentUser);

  // Role cache state
  const [cachedRole, setCachedRole] = useState<KnownRole | null>(null);
  const [hasAttemptedSync, setHasAttemptedSync] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Load cached role on mount (non-blocking)
  useEffect(() => {
    let cancelled = false;
    const loadCachedRole = async () => {
      try {
        const storedRole = await AsyncStorage.getItem(ROLE_CACHE_KEY);
        if (cancelled || !storedRole || !isKnownRole(storedRole)) return;
        setCachedRole(storedRole);
      } catch {
        // Ignore role cache read failures.
      }
    };

    void loadCachedRole();
    return () => {
      cancelled = true;
    };
  }, []);

  // Update cache when role changes
  useEffect(() => {
    const role = currentUser?.role;
    if (!role || !isKnownRole(role)) return;

    setCachedRole(role);
    void AsyncStorage.setItem(ROLE_CACHE_KEY, role).catch(() => {
      // Ignore role cache write failures.
    });
  }, [currentUser?.role]);

  // Clear optimistic role cache after auth settles to signed-out.
  useEffect(() => {
    if (isConvexAuthLoading || isAuthenticated) return;

    setCachedRole(null);
    void AsyncStorage.removeItem(ROLE_CACHE_KEY).catch(() => {
      // Ignore role cache clear failures.
    });
  }, [isConvexAuthLoading, isAuthenticated]);

  // Sync user on first load (only if currentUser is null and authenticated)
  useEffect(() => {
    if (
      !isAuthenticated ||
      currentUser !== null ||
      isSyncing ||
      hasAttemptedSync
    ) {
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    void syncCurrentUser({})
      .then(() => setHasAttemptedSync(true))
      .catch((error) => {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Failed to sync user account";
        setSyncError(message);
        setHasAttemptedSync(true);
      })
      .finally(() => setIsSyncing(false));
  }, [
    currentUser,
    hasAttemptedSync,
    isAuthenticated,
    isSyncing,
    syncCurrentUser,
  ]);

  const retrySync = useCallback(() => {
    setHasAttemptedSync(false);
    setSyncError(null);
  }, []);

  const value = useMemo<UserContextValue>(() => ({
    currentUser,
    effectiveRole: currentUser?.role ?? cachedRole,
    isAuthLoading: isConvexAuthLoading,
    isAuthenticated,
    isSyncing,
    syncError,
    hasAttemptedSync,
    retrySync,
  }), [
    currentUser,
    cachedRole,
    isConvexAuthLoading,
    isAuthenticated,
    isSyncing,
    syncError,
    hasAttemptedSync,
    retrySync,
  ]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  return useContext(UserContext);
}

export { isKnownRole, type KnownRole };
