import { type Href, Link, Slot, usePathname } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { TabBarScrollProvider } from "@/contexts/tab-bar-scroll-context";
import { useBrand } from "@/hooks/use-brand";
import {
  buildRoleTabRoute,
  type RoleTabRouteName,
} from "@/navigation/role-routes";
import { getTabsForRole } from "@/navigation/tab-registry";
import type { AppRole } from "@/navigation/types";

type RoleTabsLayoutProps = {
  appRole: AppRole;
  badgeCountByRoute: Partial<Record<RoleTabRouteName, number>>;
};

function formatDashboardDate(locale: string) {
  return new Date().toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function RoleTabsLayout({
  appRole,
  badgeCountByRoute,
}: RoleTabsLayoutProps) {
  const palette = useBrand();
  const pathname = usePathname();
  const { t, i18n } = useTranslation();
  const tabs = useMemo(() => getTabsForRole(appRole), [appRole]);
  const locale = i18n.resolvedLanguage ?? "en";

  const activeTab = useMemo(() => {
    return (
      tabs.find((tab) => {
        const route = buildRoleTabRoute(appRole, tab.routeName);
        return pathname === route || pathname.startsWith(`${route}/`);
      }) ?? tabs[0]
    );
  }, [appRole, pathname, tabs]);

  const totalAttention = useMemo(
    () =>
      Object.values(badgeCountByRoute).reduce(
        (sum, count) => sum + (count && count > 0 ? count : 0),
        0,
      ),
    [badgeCountByRoute],
  );

  return (
    <TabBarScrollProvider>
      <View style={{ flex: 1, backgroundColor: palette.appBg as string }}>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            gap: 20,
            paddingHorizontal: 20,
            paddingVertical: 20,
          }}
        >
          <View
            style={{
              width: 272,
              borderRadius: 36,
              borderCurve: "continuous",
              backgroundColor: palette.surface as string,
              paddingHorizontal: 20,
              paddingVertical: 22,
              gap: 24,
            }}
          >
            <View style={{ gap: 10 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                  color: palette.primary as string,
                }}
              >
                Queue Control
              </Text>
              <Text
                style={{
                  fontFamily: "BarlowCondensed_800ExtraBold",
                  fontSize: 42,
                  lineHeight: 40,
                  letterSpacing: -1,
                  color: palette.text as string,
                }}
              >
                {appRole === "studio"
                  ? "Studio dashboard"
                  : "Instructor dashboard"}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 20,
                  color: palette.textMuted as string,
                }}
              >
                Clean lanes, live priority, and less chrome.
              </Text>
            </View>

            <View
              style={{
                borderRadius: 28,
                borderCurve: "continuous",
                backgroundColor: palette.primary as string,
                paddingHorizontal: 18,
                paddingVertical: 16,
                gap: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 1.1,
                  textTransform: "uppercase",
                  color: palette.onPrimary as string,
                  opacity: 0.78,
                }}
              >
                Active alerts
              </Text>
              <Text
                style={{
                  fontFamily: "BarlowCondensed_800ExtraBold",
                  fontSize: 34,
                  lineHeight: 32,
                  color: palette.onPrimary as string,
                }}
              >
                {String(totalAttention)}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  lineHeight: 18,
                  color: palette.onPrimary as string,
                  opacity: 0.86,
                }}
              >
                Routed into one workspace instead of five repeated counters.
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              {tabs.map((tab) => {
                const route = buildRoleTabRoute(appRole, tab.routeName) as Href;
                const selected = activeTab?.id === tab.id;
                const badgeCount = badgeCountByRoute[tab.routeName] ?? 0;

                return (
                  <Link key={tab.id} href={route} asChild>
                    <Pressable
                      accessibilityRole="link"
                      style={({ pressed }) => ({
                        borderRadius: 26,
                        borderCurve: "continuous",
                        backgroundColor: selected
                          ? (palette.text as string)
                          : (palette.surfaceAlt as string),
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        transform: [{ scale: pressed ? 0.99 : 1 }],
                      })}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "700",
                              letterSpacing: 0.2,
                              color: selected
                                ? (palette.surface as string)
                                : (palette.text as string),
                            }}
                          >
                            {t(tab.titleKey)}
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              color: selected
                                ? "rgba(255,255,255,0.72)"
                                : (palette.textMuted as string),
                            }}
                          >
                            {selected ? "Current workspace" : "Open workspace"}
                          </Text>
                        </View>
                        {badgeCount > 0 ? (
                          <View
                            style={{
                              minWidth: 28,
                              borderRadius: 999,
                              backgroundColor: selected
                                ? "rgba(255,255,255,0.14)"
                                : (palette.primary as string),
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "700",
                                color: selected
                                  ? (palette.surface as string)
                                  : (palette.onPrimary as string),
                              }}
                            >
                              {badgeCount > 99 ? "99+" : String(badgeCount)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  </Link>
                );
              })}
            </View>
          </View>

          <View style={{ flex: 1, gap: 18 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "stretch",
                gap: 16,
              }}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: 32,
                  borderCurve: "continuous",
                  backgroundColor: palette.surface as string,
                  paddingHorizontal: 20,
                  paddingVertical: 18,
                  gap: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    color: palette.textMuted as string,
                  }}
                >
                  Workspace
                </Text>
                <Text
                  style={{
                    fontFamily: "BarlowCondensed_800ExtraBold",
                    fontSize: 38,
                    lineHeight: 36,
                    letterSpacing: -0.9,
                    color: palette.text as string,
                  }}
                >
                  {t(activeTab?.titleKey ?? "tabs.home")}
                </Text>
              </View>

              <View
                style={{
                  width: 260,
                  borderRadius: 32,
                  borderCurve: "continuous",
                  backgroundColor: palette.surfaceAlt as string,
                  paddingHorizontal: 18,
                  paddingVertical: 18,
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    color: palette.textMuted as string,
                  }}
                >
                  Today
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    lineHeight: 20,
                    color: palette.text as string,
                  }}
                >
                  {formatDashboardDate(locale)}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    lineHeight: 17,
                    color: palette.textMuted as string,
                  }}
                >
                  Desktop mode is tuned for scanning, routing, and staying in
                  flow.
                </Text>
              </View>
            </View>

            <View
              style={{
                flex: 1,
                minHeight: 0,
                borderRadius: 36,
                borderCurve: "continuous",
                backgroundColor: palette.surface as string,
                overflow: "hidden",
              }}
            >
              <Slot />
            </View>
          </View>
        </View>
      </View>
    </TabBarScrollProvider>
  );
}
