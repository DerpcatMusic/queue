import { type Href, Link, Slot, usePathname } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { GlobalTopSheet } from "@/components/layout/global-top-sheet";
import { ScrollSheetProvider } from "@/components/layout/scroll-sheet-provider";
import { GlobalTopSheetProvider } from "@/components/layout/top-sheet-registry";
import { useTheme } from "@/hooks/use-theme";
import { buildRoleTabRoute, type RoleTabRouteName } from "@/navigation/role-routes";
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

export function RoleTabsLayout({ appRole, badgeCountByRoute }: RoleTabsLayoutProps) {
  const pathname = usePathname();
  const { t, i18n } = useTranslation();
  const { color: palette } = useTheme();
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

  return (
    <ScrollSheetProvider>
      <GlobalTopSheetProvider>
        <View style={{ flex: 1, backgroundColor: palette.appBg }}>
            <GlobalTopSheet />
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                gap: 16,
                paddingHorizontal: 16,
                paddingVertical: 16,
              }}
            >
              <View
                style={{
                  width: 236,
                  borderRadius: 30,
                  borderCurve: "continuous",
                  backgroundColor: palette.surface,
                  paddingHorizontal: 16,
                  paddingVertical: 18,
                  gap: 18,
                }}
              >
                <View style={{ gap: 4 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      letterSpacing: 1.4,
                      textTransform: "uppercase",
                      color: palette.primary,
                    }}
                  >
                    Queue
                  </Text>
                  <Text
                    style={{
                      fontFamily: "BarlowCondensed_800ExtraBold",
                      fontSize: 32,
                      lineHeight: 30,
                      letterSpacing: -0.8,
                      color: palette.text,
                    }}
                  >
                    {appRole === "studio" ? "Studio" : "Instructor"}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      lineHeight: 17,
                      color: palette.textMuted,
                    }}
                  >
                    Fast lanes. Less shell.
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
                            borderRadius: 22,
                            borderCurve: "continuous",
                            backgroundColor: selected ? palette.primaryPressed : palette.surfaceAlt,
                            paddingHorizontal: 14,
                            paddingVertical: 12,
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
                                  fontSize: 14,
                                  fontWeight: "700",
                                  letterSpacing: 0.2,
                                  color: selected ? palette.surface : palette.text,
                                }}
                              >
                                {t(tab.titleKey)}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: selected ? palette.surfaceAlt : palette.textMuted,
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
                                  backgroundColor: selected ? palette.surfaceAlt : palette.primary,
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                  alignItems: "center",
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontWeight: "700",
                                    color: selected ? palette.primaryPressed : palette.onPrimary,
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
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    borderRadius: 28,
                    borderCurve: "continuous",
                    backgroundColor: palette.surface,
                    paddingHorizontal: 18,
                    paddingVertical: 16,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        letterSpacing: 1.2,
                        textTransform: "uppercase",
                        color: palette.textMuted,
                      }}
                    >
                      Workspace
                    </Text>
                    <Text
                      style={{
                        fontFamily: "BarlowCondensed_800ExtraBold",
                        fontSize: 34,
                        lineHeight: 32,
                        letterSpacing: -0.8,
                        color: palette.text,
                      }}
                    >
                      {t(activeTab?.titleKey ?? "tabs.home")}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        letterSpacing: 1.2,
                        textTransform: "uppercase",
                        color: palette.textMuted,
                      }}
                    >
                      Today
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        lineHeight: 18,
                        color: palette.text,
                      }}
                    >
                      {formatDashboardDate(locale)}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    flex: 1,
                    minHeight: 0,
                    borderRadius: 30,
                    borderCurve: "continuous",
                    backgroundColor: palette.surface,
                    overflow: "hidden",
                  }}
                >
                  <Slot />
                </View>
              </View>
            </View>
          </View>
      </GlobalTopSheetProvider>
    </ScrollSheetProvider>
  );
}
