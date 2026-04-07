import { usePathname } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

import { GlobalTopSheet } from "@/components/layout/global-top-sheet";
import { ScrollSheetProvider } from "@/components/layout/scroll-sheet-provider";
import { TAB_TRANSITION_VEIL_OPACITY } from "@/components/layout/top-sheet-constants";
import {
  GlobalTopSheetProvider,
  type TopSheetDescriptorConfig,
} from "@/components/layout/top-sheet-registry";
import { useTheme } from "@/hooks/use-theme";
import { type RoleTabRouteName, resolveRoleTabRouteName } from "@/navigation/role-routes";
import { getTabsForRole } from "@/navigation/tab-registry";
import type { AppRole } from "@/navigation/types";

function NativeTabBadge({ count }: { count: number }) {
  return (
    <NativeTabs.Trigger.Badge hidden={count <= 0}>
      {count > 99 ? "99+" : String(count)}
    </NativeTabs.Trigger.Badge>
  );
}

type RoleTabsLayoutProps = {
  appRole: AppRole;
  badgeCountByRoute: Partial<Record<RoleTabRouteName, number>>;
};

// New types for owned scene state
type InsetTone = "app" | "sheet" | "card" | "primary";

type SceneDescriptor = {
  tabId: RoleTabRouteName;
  body?: ReactNode;
  sheetConfig?: TopSheetDescriptorConfig | null;
  insetTone?: InsetTone;
  isLoading?: boolean;
};

// Context for child screens to register their descriptors
type TabSceneDescriptorContextValue = {
  registerDescriptor: (tabId: RoleTabRouteName, descriptor: Partial<SceneDescriptor>) => void;
  unregisterDescriptor: (tabId: RoleTabRouteName) => void;
  getDescriptor: (tabId: RoleTabRouteName) => SceneDescriptor | undefined;
};

const TabSceneDescriptorContext = createContext<TabSceneDescriptorContextValue | null>(null);

// Context that exposes tab transition state (focusProgress, activeTabId).
// GlobalTopSheet reads this from OUTSIDE the memoized layoutShell so it
// re-renders on tab switch and can animate its content.
const TabTransitionContext = createContext<{
  focusProgress: SharedValue<number>;
  activeTabId: RoleTabRouteName;
} | null>(null);

function TabTransitionVeil({
  tintColor,
  focusProgress,
  transitionKey,
}: {
  tintColor: string;
  focusProgress: SharedValue<number>;
  transitionKey: string;
}) {
  const previousTransitionKeyRef = useRef(transitionKey);

  useEffect(() => {
    if (previousTransitionKeyRef.current === transitionKey) {
      return;
    }

    previousTransitionKeyRef.current = transitionKey;
    // Trigger the veil animation only when the primary tab changes.
    focusProgress.value = 0;
    focusProgress.value = withSpring(1, {
      damping: 20,
      stiffness: 200,
    });
  }, [focusProgress, transitionKey]);

  const veilStyle = useAnimatedStyle(() => ({
    opacity: (1 - focusProgress.value) * TAB_TRANSITION_VEIL_OPACITY,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, styles.veil, veilStyle]}
    >
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: tintColor }]} />
      {Platform.OS === "ios" ? (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: "rgba(255,255,255,0.04)",
            },
          ]}
        />
      ) : null}
    </Animated.View>
  );
}

export function RoleTabsLayout({ appRole, badgeCountByRoute }: RoleTabsLayoutProps) {
  const pathname = usePathname();
  const { color } = useTheme();

  // Stable: getTabsForRole() returns a new array each call, so memoize by appRole
  const tabs = useMemo(() => getTabsForRole(appRole), [appRole]);

  const sceneDescriptorsRef = useRef<Map<RoleTabRouteName, SceneDescriptor>>(new Map());

  // Extract active tab ID from pathname
  const activeTabId = useMemo<RoleTabRouteName>(() => {
    return resolveRoleTabRouteName(pathname, appRole);
  }, [appRole, pathname]);

  // Keep ref in sync for consumers that read it
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  // Bump the shell only when the active tab descriptor changes.
  const [, setActiveDescriptorVersion] = useState(0);

  // Focus progress shared value for transition animations
  const focusProgress = useSharedValue<number>(1);

  // Register a scene descriptor from a child screen
  const registerDescriptor = useCallback(
    (tabId: RoleTabRouteName, descriptor: Partial<SceneDescriptor>) => {
      const current = sceneDescriptorsRef.current;
      const existing = current.get(tabId);
      if (
        existing &&
        existing.sheetConfig === descriptor.sheetConfig &&
        existing.insetTone === descriptor.insetTone &&
        existing.isLoading === descriptor.isLoading
      ) {
        return;
      }

      const next = new Map(current);
      next.set(tabId, {
        tabId,
        ...existing,
        ...descriptor,
      });
      sceneDescriptorsRef.current = next;

      if (activeTabIdRef.current === tabId) {
        setActiveDescriptorVersion((version) => version + 1);
      }
    },
    [],
  );

  // Unregister a scene descriptor
  const unregisterDescriptor = useCallback((tabId: RoleTabRouteName) => {
    const current = sceneDescriptorsRef.current;
    if (!current.has(tabId)) {
      return;
    }

    const next = new Map(current);
    next.delete(tabId);
    sceneDescriptorsRef.current = next;

    if (activeTabIdRef.current === tabId) {
      setActiveDescriptorVersion((version) => version + 1);
    }
  }, []);

  // Get a descriptor for a specific tab
  const getDescriptor = useCallback((tabId: RoleTabRouteName): SceneDescriptor | undefined => {
    return sceneDescriptorsRef.current.get(tabId);
  }, []);

  // Context value for child descriptor registration
  const descriptorContext = useMemo<TabSceneDescriptorContextValue>(
    () => ({
      registerDescriptor,
      unregisterDescriptor,
      getDescriptor,
    }),
    [registerDescriptor, unregisterDescriptor, getDescriptor],
  );

  // ── Memoized layout shell ──────────────────────────────────────────────────
  // Wrapping the tab content in useMemo breaks the re-render cascade:
  // when pathname changes, RoleTabsLayout re-renders BUT the JSX tree
  // below is returned as the SAME object reference, so React skips
  // re-evaluating NativeTabs and the tab content.
  //
  // GlobalTopSheet is rendered OUTSIDE this memo so it CAN re-render on
  // tab switch — it needs to fire useEffect hooks for the sheet animation.
  // TabTransitionContext.Provider exposes focusProgress (SharedValue) and
  // activeTabId to GlobalTopSheet without it calling usePathname().
  //
  // Dependencies must ALL be stable across pathname changes:
  //   - color strings: primitives (destructured below), stable when theme scheme is stable
  //   - tabs: useMemo([appRole]) — stable reference
  //   - badgeCountByRoute: stable (memoized in parent InstructorTabsLayout)
  //   - descriptorContext: stable (useMemo with stable callback deps)
  //
  // TabTransitionVeil is rendered outside the memo (like GlobalTopSheet)
  // because it needs activeTabId which changes on tab switch.
  //
  // Destructuring ensures deps are primitive strings, not the color object reference.
  const { appBg, onPrimaryContainer, textMicro, primary, onPrimary, primaryContainer, surface } =
    color;

  const layoutShell = useMemo(
    () => (
      <ScrollSheetProvider>
        <View style={{ flex: 1, backgroundColor: appBg }}>
          <View style={{ flex: 1, minHeight: 0, zIndex: 2, backgroundColor: appBg }}>
            <NativeTabs
              tintColor={onPrimaryContainer}
              iconColor={{
                default: textMicro,
                selected: onPrimaryContainer,
              }}
              backgroundColor={appBg}
              badgeBackgroundColor={primary}
              badgeTextColor={onPrimary}
              indicatorColor={primaryContainer}
              shadowColor={surface}
              labelVisibilityMode="unlabeled"
              disableTransparentOnScrollEdge
            >
              {tabs.map((tab) => (
                <NativeTabs.Trigger
                  key={tab.id}
                  name={tab.routeName}
                  contentStyle={{ backgroundColor: appBg }}
                >
                  <NativeTabs.Trigger.Icon
                    md={tab.icon.md}
                    sf={{
                      default: tab.icon.sfDefault as never,
                      selected: tab.icon.sfSelected as never,
                    }}
                  />
                  <NativeTabBadge count={badgeCountByRoute[tab.routeName] ?? 0} />
                </NativeTabs.Trigger>
              ))}
            </NativeTabs>
          </View>
        </View>
      </ScrollSheetProvider>
    ),
    [
      appBg,
      onPrimaryContainer,
      textMicro,
      primary,
      onPrimary,
      primaryContainer,
      surface,
      tabs,
      badgeCountByRoute,
    ],
  );

  return (
    <TabSceneDescriptorContext.Provider value={descriptorContext}>
      <TabTransitionContext.Provider value={{ focusProgress, activeTabId }}>
        <ScrollSheetProvider>
          <GlobalTopSheetProvider>
            <GlobalTopSheet />
          </GlobalTopSheetProvider>
        </ScrollSheetProvider>
        {layoutShell}
        <TabTransitionVeil
          tintColor={color.surface}
          focusProgress={focusProgress}
          transitionKey={activeTabId}
        />
      </TabTransitionContext.Provider>
    </TabSceneDescriptorContext.Provider>
  );
}

// Export context for child screens to use
export { TabSceneDescriptorContext, TabTransitionContext };

// Hook for child screens to register their scene descriptors
function useTabSceneDescriptorScene(
  tabId: RoleTabRouteName,
  descriptor: Omit<SceneDescriptor, "tabId">,
): void {
  const { registerDescriptor, unregisterDescriptor } = useContext(TabSceneDescriptorContext) ?? {};

  useLayoutEffect(() => {
    if (!registerDescriptor) return;
    registerDescriptor(tabId, descriptor);
    return () => {
      if (unregisterDescriptor) {
        unregisterDescriptor(tabId);
      }
    };
  }, [tabId, descriptor, registerDescriptor, unregisterDescriptor]);
}

export function useTabSceneDescriptor(
  descriptor: Omit<SceneDescriptor, "tabId"> & { tabId: RoleTabRouteName },
): void {
  useTabSceneDescriptorScene(descriptor.tabId, descriptor);
}

const styles = StyleSheet.create({
  veil: {
    zIndex: 8,
  },
});
