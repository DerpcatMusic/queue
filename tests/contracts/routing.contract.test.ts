import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";

import {
  getTabsForRole,
  isFeatureEnabled,
  ROLE_FEATURE_FLAGS,
  TAB_SPECS,
} from "../../src/navigation/tab-registry";
import {
  buildRoleTabFilePath,
  buildRoleTabRoute,
  getRoleTabBasePath,
  getRoleTabGroup,
  ROLE_TAB_ROUTE_NAMES,
} from "../../src/navigation/role-routes";
import type { AppRole } from "../../src/navigation/types";

const APP_ROLES: readonly AppRole[] = ["instructor", "studio"];
const PROJECT_ROOT = process.cwd();

function listTopLevelTabRoutesFromFilesystem(role: AppRole): string[] {
  const roleDir = join(
    PROJECT_ROOT,
    "src",
    "app",
    "(app)",
    getRoleTabGroup(role),
    role,
  );
  const tabRoutes = new Set<string>();

  for (const entry of readdirSync(roleDir, { withFileTypes: true })) {
    if (entry.name === "_layout.tsx") continue;
    if (entry.isFile() && extname(entry.name) === ".tsx") {
      tabRoutes.add(basename(entry.name, ".tsx"));
      continue;
    }
    if (
      entry.isDirectory() &&
      existsSync(join(roleDir, entry.name, "index.tsx"))
    ) {
      tabRoutes.add(entry.name);
    }
  }

  return [...tabRoutes].sort();
}

describe("routing contracts", () => {
  it("keeps tab ids and route names unique in the registry", () => {
    const tabIds = TAB_SPECS.map((tab) => tab.id);
    const routeNames = TAB_SPECS.map((tab) => tab.routeName);

    expect(new Set(tabIds).size).toBe(tabIds.length);
    expect(new Set(routeNames).size).toBe(routeNames.length);
  });

  it("keeps role-based tab visibility in sync with feature gates", () => {
    for (const role of APP_ROLES) {
      const expectedVisibleTabIds = TAB_SPECS.filter((tab) => {
        if (!tab.visibleFor.includes(role)) return false;
        if (tab.id !== "map") return true;
        return isFeatureEnabled(role, "map.zoneEditor");
      }).map((tab) => tab.id);

      const actualVisibleTabIds = getTabsForRole(role).map((tab) => tab.id);
      expect(actualVisibleTabIds).toEqual(expectedVisibleTabIds);
    }
  });

  it("keeps role feature matrices complete and map-gate expectations correct", () => {
    const instructorFlags = Object.keys(ROLE_FEATURE_FLAGS.instructor).sort();
    const studioFlags = Object.keys(ROLE_FEATURE_FLAGS.studio).sort();

    expect(studioFlags).toEqual(instructorFlags);
    expect(isFeatureEnabled("instructor", "map.zoneEditor")).toBe(true);
    expect(isFeatureEnabled("studio", "map.zoneEditor")).toBe(false);
  });

  it("keeps registry tab route names in parity with role tab filesystem entries", () => {
    for (const role of APP_ROLES) {
      const registryRoutes = TAB_SPECS.filter((tab) =>
        tab.visibleFor.includes(role),
      )
        .map((tab) => tab.routeName)
        .sort();
      const filesystemRoutes = listTopLevelTabRoutesFromFilesystem(role);

      expect(filesystemRoutes).toEqual(registryRoutes);
    }
  });

  it("ensures role-visible tabs resolve to existing files and hidden tabs stay absent", () => {
    for (const role of APP_ROLES) {
      for (const routeName of Object.values(ROLE_TAB_ROUTE_NAMES)) {
        const filePath = buildRoleTabFilePath(role, routeName);
        const isVisibleForRole = TAB_SPECS.some(
          (tab) => tab.routeName === routeName && tab.visibleFor.includes(role),
        );
        expect(existsSync(filePath)).toBe(isVisibleForRole);
      }
    }
  });
});

describe("role route builders contracts", () => {
  it("keeps route constants in lockstep with tab-registry route names", () => {
    const registryRouteNames = [
      ...new Set(TAB_SPECS.map((tab) => tab.routeName)),
    ].sort();
    const routeConstantNames = Object.values(ROLE_TAB_ROUTE_NAMES).sort();
    expect(routeConstantNames).toEqual(registryRouteNames);
  });

  it("builds stable role base paths and role tab routes", () => {
    expect(getRoleTabBasePath("instructor")).toBe("/instructor");
    expect(getRoleTabBasePath("studio")).toBe("/studio");

    for (const role of APP_ROLES) {
      const basePath = getRoleTabBasePath(role);
      expect(String(buildRoleTabRoute(role, ROLE_TAB_ROUTE_NAMES.home))).toBe(
        String(basePath),
      );

      for (const routeName of Object.values(ROLE_TAB_ROUTE_NAMES).filter(
        (name) => name !== "index",
      )) {
        expect(String(buildRoleTabRoute(role, routeName))).toBe(
          `${basePath}/${routeName}`,
        );
      }
    }
  });

  it("builds file paths that match registry-visible tabs", () => {
    for (const role of APP_ROLES) {
      for (const tab of getTabsForRole(role)) {
        expect(existsSync(buildRoleTabFilePath(role, tab.routeName))).toBe(
          true,
        );
      }
    }
  });
});
