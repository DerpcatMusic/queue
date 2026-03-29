import { usePathname } from "expo-router";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { RoleTabRouteName } from "@/navigation/role-routes";

function resolveActiveRoleTabRouteName(pathname: string | null): RoleTabRouteName | null {
  if (!pathname) {
    return null;
  }

  const cleanPath = pathname.replace(/^\//, "");
  if (!cleanPath) {
    return null;
  }

  const segments = cleanPath.split("/");
  if (segments.length === 1) {
    return "index";
  }

  const tabSegment = segments[1];
  if (
    tabSegment === "index" ||
    tabSegment === "jobs" ||
    tabSegment === "calendar" ||
    tabSegment === "map" ||
    tabSegment === "profile"
  ) {
    return tabSegment;
  }

  return null;
}

type TabSceneLifecycleContextValue = {
  activeRouteName: RoleTabRouteName | null;
  hasActivated: (routeName: RoleTabRouteName) => boolean;
};

const TabSceneLifecycleContext = createContext<TabSceneLifecycleContextValue | null>(null);

export function TabSceneLifecycleProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const activeRouteName = resolveActiveRoleTabRouteName(pathname);
  const [activatedRouteNames, setActivatedRouteNames] = useState<Set<RoleTabRouteName>>(() =>
    activeRouteName ? new Set([activeRouteName]) : new Set(),
  );

  useEffect(() => {
    if (!activeRouteName) {
      return;
    }

    setActivatedRouteNames((current) => {
      if (current.has(activeRouteName)) {
        return current;
      }

      const next = new Set(current);
      next.add(activeRouteName);
      return next;
    });
  }, [activeRouteName]);

  const value = useMemo<TabSceneLifecycleContextValue>(
    () => ({
      activeRouteName,
      hasActivated: (routeName) => activatedRouteNames.has(routeName),
    }),
    [activatedRouteNames, activeRouteName],
  );

  return (
    <TabSceneLifecycleContext.Provider value={value}>{children}</TabSceneLifecycleContext.Provider>
  );
}

export function useTabSceneLifecycle(routeName: RoleTabRouteName) {
  const context = useContext(TabSceneLifecycleContext);
  if (!context) {
    throw new Error("useTabSceneLifecycle must be used within <TabSceneLifecycleProvider>");
  }

  return {
    isActive: context.activeRouteName === routeName,
    hasActivated: context.hasActivated(routeName),
  };
}
