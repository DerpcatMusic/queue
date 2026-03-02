import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useQuery } from "convex/react";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTranslation } from "react-i18next";
import { Platform, View } from "react-native";

import { TabBarScrollProvider } from "@/contexts/tab-bar-scroll-context";
import { api } from "@/convex/_generated/api";
import { useBrand } from "@/hooks/use-brand";
import { isFeatureEnabled } from "@/navigation/tab-registry";

function NativeTabBadge({ count }: { count: number }) {
  return (
    <NativeTabs.Trigger.Badge hidden={count <= 0}>
      {count > 99 ? "99+" : String(count)}
    </NativeTabs.Trigger.Badge>
  );
}

export default function InstructorTabsLayout() {
  const palette = useBrand();
  const { t } = useTranslation();
  const now = Math.floor(Date.now() / (60 * 1000)) * 60 * 1000;
  const useVectorIcons = Platform.OS !== "web";
  const showMapTab = isFeatureEnabled("instructor", "map.zoneEditor");

  const instructorTabCounts = useQuery(api.jobs.getInstructorTabCounts, { now });
  const unreadNotificationCount = useQuery(api.inbox.getMyUnreadNotificationCount, {});

  const jobsBadgeCount = instructorTabCounts?.jobsBadgeCount ?? 0;
  const calendarBadgeCount = instructorTabCounts?.calendarBadgeCount ?? 0;
  const profileBadgeCount = unreadNotificationCount?.count ?? 0;

  return (
    <TabBarScrollProvider>
      <View style={{ flex: 1 }}>
        <NativeTabs tintColor={palette.primary} disableTransparentOnScrollEdge>
          <NativeTabs.Trigger name="index">
            <NativeTabs.Trigger.Label>{t("tabs.home")}</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: "house", selected: "house.fill" } as never}
              src={
                useVectorIcons ? (
                  <NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="home" />
                ) : undefined
              }
            />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="jobs">
            <NativeTabs.Trigger.Label>{t("tabs.jobs")}</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: "briefcase", selected: "briefcase.fill" } as never}
              src={
                useVectorIcons ? (
                  <NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="work" />
                ) : undefined
              }
            />
            <NativeTabBadge count={jobsBadgeCount} />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="calendar">
            <NativeTabs.Trigger.Label>{t("tabs.calendar")}</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: "calendar", selected: "calendar.circle.fill" } as never}
              src={
                useVectorIcons ? (
                  <NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="calendar-month" />
                ) : undefined
              }
            />
            <NativeTabBadge count={calendarBadgeCount} />
          </NativeTabs.Trigger>
          {showMapTab ? (
            <NativeTabs.Trigger name="map">
              <NativeTabs.Trigger.Label>{t("tabs.map")}</NativeTabs.Trigger.Label>
              <NativeTabs.Trigger.Icon
                sf={{ default: "map", selected: "map.fill" } as never}
                src={
                  useVectorIcons ? (
                    <NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="map" />
                  ) : undefined
                }
              />
            </NativeTabs.Trigger>
          ) : null}
          <NativeTabs.Trigger name="profile">
            <NativeTabs.Trigger.Label>{t("tabs.profile")}</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" } as never}
              src={
                useVectorIcons ? (
                  <NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="account-circle" />
                ) : undefined
              }
            />
            <NativeTabBadge count={profileBadgeCount} />
          </NativeTabs.Trigger>
        </NativeTabs>
      </View>
    </TabBarScrollProvider>
  );
}
