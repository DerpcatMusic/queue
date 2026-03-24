import { type Href, Link, Slot, usePathname } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { GlobalTopSheet } from "@/components/layout/global-top-sheet";
import { ScrollSheetProvider } from "@/components/layout/scroll-sheet-provider";
import { GlobalTopSheetProvider } from "@/components/layout/top-sheet-registry";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { TabBarScrollProvider } from "@/contexts/tab-bar-scroll-context";
import { useBrand } from "@/hooks/use-brand";
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

  return (
    <ScrollSheetProvider>
      <GlobalTopSheetProvider>
        <TabBarScrollProvider>
          <View style={{ flex: 1, backgroundColor: palette.appBg as string }}>
            <GlobalTopSheet />
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                gap: BrandSpacing.lg,
                paddingHorizontal: BrandSpacing.lg,
                paddingVertical: BrandSpacing.lg,
              }}
            >
              <View
                style={{
                  width: BrandSpacing.shellRail,
                  borderRadius: BrandRadius.soft,
                  borderCurve: "continuous",
                  backgroundColor: palette.surface as string,
                  paddingHorizontal: BrandSpacing.lg,
                  paddingVertical: BrandSpacing.lg,
                  gap: BrandSpacing.lg,
                }}
              >
                <View style={{ gap: BrandSpacing.xs }}>
                  <Text
                    style={{
                      ...BrandType.micro,
                      color: palette.primary as string,
                      letterSpacing: 1.4,
                      textTransform: "uppercase",
                    }}
                  >
                    Queue
                  </Text>
                  <Text
                    style={{
                      ...BrandType.heroSmall,
                      color: palette.text as string,
                    }}
                  >
                    {appRole === "studio" ? "Studio" : "Instructor"}
                  </Text>
                  <Text
                    style={{
                      ...BrandType.caption,
                      color: palette.textMuted as string,
                    }}
                  >
                    Fast lanes. Less shell.
                  </Text>
                </View>

                <View style={{ gap: BrandSpacing.stackTight }}>
                  {tabs.map((tab) => {
                    const route = buildRoleTabRoute(appRole, tab.routeName) as Href;
                    const selected = activeTab?.id === tab.id;
                    const badgeCount = badgeCountByRoute[tab.routeName] ?? 0;

                    return (
                      <Link key={tab.id} href={route} asChild>
                        <Pressable
                          accessibilityRole="link"
                          style={({ pressed }) => ({
                            borderRadius: BrandRadius.medium,
                            borderCurve: "continuous",
                            backgroundColor: selected
                              ? (palette.text as string)
                              : (palette.surfaceAlt as string),
                            paddingHorizontal: BrandSpacing.componentPadding,
                            paddingVertical: BrandSpacing.md,
                            transform: [{ scale: pressed ? 0.99 : 1 }],
                          })}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: BrandSpacing.md,
                            }}
                          >
                            <View style={{ flex: 1, gap: BrandSpacing.xs }}>
                              <Text
                                style={{
                                  ...BrandType.bodyStrong,
                                  color: selected
                                    ? (palette.surface as string)
                                    : (palette.text as string),
                                }}
                              >
                                {t(tab.titleKey)}
                              </Text>
                              <Text
                                style={{
                                  ...BrandType.micro,
                                  color: selected
                                    ? (palette.surface as string)
                                    : (palette.textMuted as string),
                                  opacity: selected ? 0.72 : 1,
                                }}
                              >
                                {selected ? "Current workspace" : "Open workspace"}
                              </Text>
                            </View>
                            {badgeCount > 0 ? (
                              <View
                                style={{
                                  minWidth: BrandSpacing.controlSm - BrandSpacing.sm,
                                  borderRadius: BrandRadius.pill,
                                  backgroundColor: selected
                                    ? (palette.primaryPressed as string)
                                    : (palette.primary as string),
                                  paddingHorizontal: BrandSpacing.sm,
                                  paddingVertical: BrandSpacing.xs,
                                  alignItems: "center",
                                }}
                              >
                                <Text
                                  style={{
                                    ...BrandType.micro,
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

              <View style={{ flex: 1, gap: BrandSpacing.lg }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: BrandSpacing.md,
                    borderRadius: BrandRadius.soft,
                    borderCurve: "continuous",
                    backgroundColor: palette.surface as string,
                    paddingHorizontal: BrandSpacing.lg,
                    paddingVertical: BrandSpacing.lg,
                  }}
                >
                  <View style={{ flex: 1, gap: BrandSpacing.xs }}>
                    <Text
                      style={{
                        ...BrandType.micro,
                        color: palette.textMuted as string,
                        letterSpacing: 1.2,
                        textTransform: "uppercase",
                      }}
                    >
                      Workspace
                    </Text>
                    <Text
                      style={{
                        ...BrandType.heroSmall,
                        color: palette.text as string,
                      }}
                    >
                      {t(activeTab?.titleKey ?? "tabs.home")}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: BrandSpacing.xs }}>
                    <Text
                      style={{
                        ...BrandType.micro,
                        color: palette.textMuted as string,
                        letterSpacing: 1.2,
                        textTransform: "uppercase",
                      }}
                    >
                      Today
                    </Text>
                    <Text
                      style={{
                        ...BrandType.bodyMedium,
                        color: palette.text as string,
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
                    borderRadius: BrandRadius.soft,
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
      </GlobalTopSheetProvider>
    </ScrollSheetProvider>
  );
}
