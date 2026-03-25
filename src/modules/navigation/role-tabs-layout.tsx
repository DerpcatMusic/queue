import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { View } from "react-native";

import { GlobalTopSheet } from "@/components/layout/global-top-sheet";
import { ScrollSheetProvider } from "@/components/layout/scroll-sheet-provider";
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

export function RoleTabsLayout({ appRole, badgeCountByRoute }: RoleTabsLayoutProps) {
  const tabs = getTabsForRole(appRole);
  const { color } = useTheme();

  return (
    <ScrollSheetProvider>
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
        </View>
      </GlobalTopSheetProvider>
    </ScrollSheetProvider>
  );
}
