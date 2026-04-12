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
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

import { GlobalTopSheet } from "@/components/layout/global-top-sheet";
import { ScrollSheetProvider } from "@/components/layout/scroll-sheet-provider";
import { TAB_TRANSITION_VEIL_OPACITY } from "@/components/layout/top-sheet-constants";
import {
  GlobalTopSheetProvider,
  type TopSheetDescriptorConfig,
} from "@/components/layout/top-sheet-registry";
import { useAnimatedThemeColors } from "@/hooks/use-animated-theme-colors";
import { useThemePreference } from "@/hooks/use-theme-preference";
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
  backgroundColor?: string;
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
    // Use cancelAnimation + withTiming for a clean, non-bouncy fade.
    cancelAnimation(focusProgress);
    focusProgress.value = 0;
    focusProgress.value = withTiming(1, {
      duration: 260,
      easing: Easing.inOut(Easing.ease),
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
  const { resolvedScheme } = useThemePreference();
  const { color } = useTheme();

  // Animated theme colors — transitions smoothly on theme change via native driver
  const animatedColors = useAnimatedThemeColors(resolvedScheme);

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
        existing.backgroundColor === descriptor.backgroundColor &&
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

  // ── Animated background styles ─────────────────────────────────────────────
  // These animate on the UI thread when the theme changes, giving a smooth
  // cross-fade even though the scheme update is deferred for Unistyles sync.
  // eslint-disable-next-line react-hooks/rules-of-hooks -- animated style derived from shared values, called every render
  const animatedShellBgStyle = useAnimatedStyle(() => ({
    backgroundColor: animatedColors.appBg.value,
  }));

  // ── Memoized layout shell ──────────────────────────────────────────────────
  // Wrapping the tab content in useMemo breaks the re-render cascade:
  // when pathname changes, RoleTabsLayout re-renders BUT the JSX tree
  // below is returned as the SAME object reference, so React skips
  // re-evaluating NativeTabs and the tab content.
  //
  // GlobalTopSheet is rendered OUTSIDE this memo so it CAN re-render on
  // tab switch and can animate its content.
  // TabTransitionContext.Provider exposes focusProgress (SharedValue) and
  // activeTabId to GlobalTopSheet without it calling usePathname().
  //
  // Dependencies must ALL be stable across pathname changes:
  //   - animatedShellBgStyle: SharedValue-based, always new object but animated values drive UI thread
  //   - tabs: useMemo([appRole]) — stable reference
  //   - badgeCountByRoute: stable (memoized in parent InstructorTabsLayout)
  //   - descriptorContext: stable (useMemo with stable callback deps)
  //
  // TabTransitionVeil is rendered outside the memo (like GlobalTopSheet)
  // because it needs activeTabId which changes on tab switch.
  //
  // For NativeTabs props that need animated values, we pass the
  // SharedValue-derived animated style directly. Non-animated props still
  // use the current resolved theme values from useTheme().
  const layoutShell = useMemo(
    () => (
      <ScrollSheetProvider>
        {/* Animated.View drives the smooth background cross-fade on theme change */}
        <Animated.View style={[{ flex: 1 }, animatedShellBgStyle]}>
          <View
            style={{
              flex: 1,
              minHeight: 0,
              zIndex: 2,
            }}
          >
            {/* NativeTabs uses plain styles (not animated) — its internal colors
                update when Unistyles syncs after the 300ms animation completes.
                The Animated.View above still gives a smooth cross-fade on the
                shell background during the transition. */}
            <NativeTabs
              tintColor={color.onPrimary}
              iconColor={{
                default: color.textMicro,
                selected: color.onPrimary,
              }}
              backgroundColor={color.surface}
              badgeBackgroundColor={color.primary}
              badgeTextColor={color.onPrimary}
              indicatorColor={color.primary}
              shadowColor={color.surface}
              labelVisibilityMode="unlabeled"
              disableTransparentOnScrollEdge
            >
              {tabs.map((tab) => (
                <NativeTabs.Trigger
                  key={tab.id}
                  name={tab.routeName}
                  contentStyle={{ backgroundColor: color.appBg }}
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
        </Animated.View>
      </ScrollSheetProvider>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabs, badgeCountByRoute, color, animatedShellBgStyle],
  );

  // TabTransitionVeil uses the current scene background (not animated during theme
  // transitions — it only animates on tab switch, not theme switch).
  const activeDescriptor = sceneDescriptorsRef.current.get(activeTabId);
  const activeSceneBackgroundColor = activeDescriptor?.backgroundColor ?? color.appBg;

  return (
    <TabSceneDescriptorContext.Provider value={descriptorContext}>
      <TabTransitionContext.Provider value={{ focusProgress, activeTabId }}>
        <GlobalTopSheetProvider>
          <ScrollSheetProvider>
            <GlobalTopSheet />
          </ScrollSheetProvider>
          {layoutShell}
          <TabTransitionVeil
            tintColor={activeSceneBackgroundColor}
            focusProgress={focusProgress}
            transitionKey={activeTabId}
          />
        </GlobalTopSheetProvider>
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
