import { Tabs } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { TabBarScrollProvider } from "@/contexts/tab-bar-scroll-context";
import type { RoleTabRouteName } from "@/navigation/role-routes";
import { getTabsForRole } from "@/navigation/tab-registry";
import type { AppRole } from "@/navigation/types";

type RoleTabsLayoutProps = {
  appRole: AppRole;
  badgeCountByRoute: Partial<Record<RoleTabRouteName, number>>;
};

export function RoleTabsLayout({ appRole, badgeCountByRoute }: RoleTabsLayoutProps) {
  const { t } = useTranslation();
  const tabs = useMemo(() => getTabsForRole(appRole), [appRole]);

  return (
    <TabBarScrollProvider>
      <Tabs screenOptions={{ headerShown: false }}>
        {tabs.map((tab) => {
          const badgeCount = badgeCountByRoute[tab.routeName] ?? 0;
          return (
            <Tabs.Screen
              key={tab.id}
              name={tab.routeName}
              options={{
                title: t(tab.titleKey),
                ...(badgeCount > 0
                  ? {
                      tabBarBadge: badgeCount > 99 ? "99+" : String(badgeCount),
                    }
                  : {}),
              }}
            />
          );
        })}
      </Tabs>
    </TabBarScrollProvider>
  );
}
