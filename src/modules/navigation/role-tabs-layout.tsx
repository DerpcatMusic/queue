import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

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
  const { t } = useTranslation();
  const tabs = getTabsForRole(appRole);

  return (
    <View style={{ flex: 1 }}>
      <NativeTabs
        tintColor={palette.primary}
        backgroundColor={palette.surface as string}
        disableTransparentOnScrollEdge
        minimizeBehavior="onScrollDown"
      >
        {tabs.map((tab) => (
          <NativeTabs.Trigger key={tab.id} name={tab.routeName}>
            <NativeTabs.Trigger.Label>{t(tab.titleKey)}</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{
                default: tab.icon.sfDefault as never,
                selected: tab.icon.sfSelected as never,
              }}
              md={tab.icon.md}
            />
            <NativeTabBadge count={badgeCountByRoute[tab.routeName] ?? 0} />
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    </View>
  );
}
