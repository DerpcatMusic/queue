import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform, View } from "react-native";

import { GlobalTopSheet } from "@/components/layout/global-top-sheet";
import { ScrollSheetProvider } from "@/components/layout/scroll-sheet-provider";
import { GlobalTopSheetProvider } from "@/components/layout/top-sheet-registry";
import { useBrand } from "@/hooks/use-brand";
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
  const palette = useBrand();
  const tabs = getTabsForRole(appRole);
  const sceneBackgroundColor = palette.appBg as string;
  const tabBarBackgroundColor = palette.surfaceElevated as string;
  const defaultIconColor = palette.textMicro as string;
  const selectedIconColor = palette.primary as string;

  return (
    <ScrollSheetProvider>
      <GlobalTopSheetProvider>
        <View style={{ flex: 1, backgroundColor: sceneBackgroundColor }}>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 144,
              backgroundColor: tabBarBackgroundColor,
              zIndex: 0,
            }}
          />
          <GlobalTopSheet />
          <View style={{ flex: 1, zIndex: 2 }}>
            <NativeTabs
              tintColor={selectedIconColor}
              iconColor={{
                default: defaultIconColor,
                selected: selectedIconColor,
              }}
              backgroundColor={tabBarBackgroundColor}
              badgeBackgroundColor={palette.primary as string}
              badgeTextColor={palette.onPrimary as string}
              indicatorColor={palette.primarySubtle as string}
              shadowColor={palette.surface as string}
              labelVisibilityMode="unlabeled"
              disableTransparentOnScrollEdge
            >
              {tabs.map((tab) => (
                <NativeTabs.Trigger
                  key={tab.id}
                  name={tab.routeName}
                  contentStyle={{ backgroundColor: sceneBackgroundColor }}
                >
                  <NativeTabs.Trigger.Icon
                    md={tab.icon.md}
                    sf={{
                      default: tab.icon.sfDefault as never,
                      selected: tab.icon.sfSelected as never,
                    }}
                    src={
                      Platform.OS === "android"
                        ? undefined
                        : {
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
                          }
                    }
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
