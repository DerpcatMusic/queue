import { describe, expect, it } from "bun:test";

import { buildRoleTabRoute, ROLE_TAB_ROUTE_NAMES } from "./role-routes";
import { getTabsForRole, isFeatureEnabled, ROLE_FEATURE_FLAGS } from "./tab-registry";

describe("tab-registry", () => {
  it("shows map tab only for instructor", () => {
    const instructorTabs = getTabsForRole("instructor").map((tab) => tab.id);
    const studioTabs = getTabsForRole("studio").map((tab) => tab.id);

    expect(instructorTabs).toContain("map");
    expect(studioTabs).not.toContain("map");
  });

  it("keeps role feature matrix in sync with visible tabs", () => {
    expect(isFeatureEnabled("instructor", "map.zoneEditor")).toBe(true);
    expect(isFeatureEnabled("studio", "map.zoneEditor")).toBe(false);
    expect(ROLE_FEATURE_FLAGS.instructor["home.performanceCard"]).toBe(true);
    expect(ROLE_FEATURE_FLAGS.studio["home.performanceCard"]).toBe(true);
  });

  it("keeps tab routes aligned with route constants", () => {
    const instructorRoutes = getTabsForRole("instructor").map((tab) => tab.routeName);
    const studioRoutes = getTabsForRole("studio").map((tab) => tab.routeName);

    expect(instructorRoutes).toContain(ROLE_TAB_ROUTE_NAMES.map);
    expect(studioRoutes).not.toContain(ROLE_TAB_ROUTE_NAMES.map);
    expect(buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.home)).toBe("/studio");
  });
});
