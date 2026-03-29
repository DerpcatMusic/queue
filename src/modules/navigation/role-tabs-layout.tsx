import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { usePathname } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { GlobalTopSheet } from "@/components/layout/global-top-sheet";
import { ScrollSheetProvider } from "@/components/layout/scroll-sheet-provider";
import {
  ANIMATION_DURATION_TAB_TRANSITION_VEIL,
  TAB_TRANSITION_VEIL_OPACITY,
} from "@/components/layout/top-sheet-constants";
import { GlobalTopSheetProvider } from "@/components/layout/top-sheet-registry";
import { useTheme } from "@/hooks/use-theme";
import { TabSceneLifecycleProvider } from "@/modules/navigation/tab-scene-lifecycle";
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

function TabTransitionVeil({ tintColor }: { tintColor: string }) {
  const pathname = usePathname();
  const previousPathnameRef = useRef(pathname);
  const veilProgress = useSharedValue(0);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) {
      return;
    }

    previousPathnameRef.current = pathname;
    veilProgress.value = 1;
    veilProgress.value = withTiming(0, {
      duration: ANIMATION_DURATION_TAB_TRANSITION_VEIL,
    });
  }, [pathname, veilProgress]);

  const veilStyle = useAnimatedStyle(() => ({
    opacity: veilProgress.value * TAB_TRANSITION_VEIL_OPACITY,
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

  return (
    <ScrollSheetProvider>
      <TabSceneLifecycleProvider>
        <GlobalTopSheetProvider>
          <View style={{ flex: 1, backgroundColor: color.appBg }}>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 144,
                backgroundColor: color.surfaceElevated,
                zIndex: 0,
              }}
            />
            <GlobalTopSheet />
            <View style={{ flex: 1, zIndex: 2 }}>
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
                      src={{
                        default: (
                          <NativeTabs.Trigger.VectorIcon
                            family={MaterialCommunityIcons}
                            name={tab.icon.mdDefaultVector as any}
                          />
                        ),
                        selected: (
                          <NativeTabs.Trigger.VectorIcon
                            family={MaterialCommunityIcons}
                            name={tab.icon.mdSelectedVector as any}
                          />
                        ),
                      }}
                    />
                    <NativeTabBadge count={badgeCountByRoute[tab.routeName] ?? 0} />
                  </NativeTabs.Trigger>
                ))}
              </NativeTabs>
            </View>
            <TabTransitionVeil tintColor={color.surface} />
          </View>
        </GlobalTopSheetProvider>
      </TabSceneLifecycleProvider>
    </ScrollSheetProvider>
  );
}

const styles = StyleSheet.create({
  veil: {
    zIndex: 8,
  },
});
