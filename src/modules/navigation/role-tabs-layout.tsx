import { usePathname } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { GlobalTopSheet } from "@/components/layout/global-top-sheet";
import { ScrollSheetProvider } from "@/components/layout/scroll-sheet-provider";
import { TAB_TRANSITION_VEIL_OPACITY } from "@/components/layout/top-sheet-constants";
import { GlobalTopSheetProvider } from "@/components/layout/top-sheet-registry";
import { useTheme } from "@/hooks/use-theme";
import type { RoleTabRouteName } from "@/navigation/role-routes";
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

// Tab-specific sheet config (subset of TopSheetTabConfig without tabId)
type TabSheetOverride = {
  content?: React.ReactNode;
  collapsedContent?: React.ReactNode;
  expandedContent?: React.ReactNode;
  render?: (props: { scrollY: SharedValue<number> }) => { children?: React.ReactNode };
  overlay?: React.ReactNode;
  contentPaddingTop?: number;
  draggable?: boolean;
  expandable?: boolean;
  steps?: readonly number[];
  initialStep?: number;
  activeStep?: number;
  minHeight?: number;
  collapsedHeightMode?: unknown;
  expandMode?: unknown;
  padding?: unknown;
  backgroundColor?: unknown;
  topInsetColor?: unknown;
  style?: unknown;
  stickyHeader?: React.ReactNode;
  stickyFooter?: React.ReactNode;
  revealOnExpand?: React.ReactNode;
  onStepChange?: (step: number) => void;
};

type SceneDescriptor = {
  tabId: RoleTabRouteName;
  body: ReactNode;
  sheetConfig?: TabSheetOverride | null;
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
  const tabs = getTabsForRole(appRole);
  const { color } = useTheme();
  const pathname = usePathname();
  const sceneDescriptorsRef = useRef<Map<RoleTabRouteName, SceneDescriptor>>(new Map());
  const activeTabIdRef = useRef<RoleTabRouteName>("index" as RoleTabRouteName);

  // Extract active tab ID from pathname
  const activeTabId = useMemo<RoleTabRouteName>(() => {
    const pathParts = pathname.split("/").filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];
    // Map pathname to RoleTabRouteName
    if (lastPart === "index" || pathname.endsWith("/instructor") || pathname.endsWith("/studio")) {
      return "index" as RoleTabRouteName;
    }
    return lastPart as RoleTabRouteName;
  }, [pathname]);

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
        body: null,
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

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  // Context value for child descriptor registration
  const descriptorContext = useMemo<TabSceneDescriptorContextValue>(
    () => ({
      registerDescriptor,
      unregisterDescriptor,
      getDescriptor,
    }),
    [registerDescriptor, unregisterDescriptor, getDescriptor],
  );

  return (
    <ScrollSheetProvider>
      <GlobalTopSheetProvider>
        <TabSceneDescriptorContext.Provider value={descriptorContext}>
          <View style={{ flex: 1, backgroundColor: color.appBg }}>
            <GlobalTopSheet />
            <View style={{ flex: 1, minHeight: 0, zIndex: 2 }}>
              <NativeTabs
                tintColor={color.primary}
                iconColor={{
                  default: color.textMicro,
                  selected: color.primary,
                }}
                backgroundColor={color.surfaceElevated}
                badgeBackgroundColor={color.primary}
                badgeTextColor={color.onPrimary}
                indicatorColor={color.primarySubtle}
                shadowColor={color.surface}
                labelVisibilityMode="unlabeled"
                disableTransparentOnScrollEdge
              >
                {tabs.map((tab) => (
                  <NativeTabs.Trigger
                    key={tab.id}
                    name={tab.routeName}
                    contentStyle={{ backgroundColor: color.surfaceElevated }}
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
            <TabTransitionVeil
              tintColor={color.surface}
              focusProgress={focusProgress}
              transitionKey={activeTabId}
            />
          </View>
        </TabSceneDescriptorContext.Provider>
      </GlobalTopSheetProvider>
    </ScrollSheetProvider>
  );
}

// Export context for child screens to use
export { TabSceneDescriptorContext };

// Hook for child screens to register their scene descriptors
function useTabSceneDescriptorScene(
  tabId: RoleTabRouteName,
  descriptor: Omit<SceneDescriptor, "tabId">,
): void {
  const { registerDescriptor, unregisterDescriptor } = useContext(TabSceneDescriptorContext) ?? {};

  useEffect(() => {
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
