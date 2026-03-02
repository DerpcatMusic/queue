import type { AppRole, FeatureFlagKey, RoleFeatureMatrix, SharedTabId, TabSpec } from "./types";

export const TAB_SPECS: readonly TabSpec[] = [
  {
    id: "home",
    titleKey: "tabs.home",
    icon: { material: "home", sfDefault: "house", sfSelected: "house.fill" },
    routeName: "index",
    visibleFor: ["instructor", "studio"],
  },
  {
    id: "jobs",
    titleKey: "tabs.jobs",
    icon: { material: "work", sfDefault: "briefcase", sfSelected: "briefcase.fill" },
    routeName: "jobs",
    visibleFor: ["instructor", "studio"],
  },
  {
    id: "calendar",
    titleKey: "tabs.calendar",
    icon: {
      material: "calendar-month",
      sfDefault: "calendar",
      sfSelected: "calendar.circle.fill",
    },
    routeName: "calendar",
    visibleFor: ["instructor", "studio"],
  },
  {
    id: "map",
    titleKey: "tabs.map",
    icon: { material: "map", sfDefault: "map", sfSelected: "map.fill" },
    routeName: "map",
    visibleFor: ["instructor"],
  },
  {
    id: "profile",
    titleKey: "tabs.profile",
    icon: {
      material: "account-circle",
      sfDefault: "person.crop.circle",
      sfSelected: "person.crop.circle.fill",
    },
    routeName: "profile",
    visibleFor: ["instructor", "studio"],
  },
] as const;

export const ROLE_FEATURE_FLAGS: RoleFeatureMatrix = {
  instructor: {
    "home.performanceCard": true,
    "jobs.realtimeBadges": true,
    "calendar.monthExpand": true,
    "profile.heroSheet": true,
    "map.zoneEditor": true,
  },
  studio: {
    "home.performanceCard": true,
    "jobs.realtimeBadges": true,
    "calendar.monthExpand": true,
    "profile.heroSheet": true,
    "map.zoneEditor": false,
  },
};

const TAB_FEATURE_GATES: Partial<Record<SharedTabId, FeatureFlagKey>> = {
  map: "map.zoneEditor",
};

export function isFeatureEnabled(role: AppRole, flag: FeatureFlagKey): boolean {
  return ROLE_FEATURE_FLAGS[role][flag];
}

export function getTabsForRole(role: AppRole): TabSpec[] {
  return TAB_SPECS.filter((spec) => {
    if (!spec.visibleFor.includes(role)) return false;
    const gatedBy = TAB_FEATURE_GATES[spec.id];
    if (!gatedBy) return true;
    return isFeatureEnabled(role, gatedBy);
  });
}
