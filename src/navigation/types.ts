import type { AndroidSymbol } from "expo-symbols";

import type { RoleTabRouteName } from "./role-routes";

export type AppRole = "instructor" | "studio";

export type SharedTabId = "home" | "jobs" | "calendar" | "map" | "profile";

export type FeatureFlagKey =
  | "home.performanceCard"
  | "jobs.realtimeBadges"
  | "calendar.monthExpand"
  | "profile.heroSheet"
  | "map.zoneEditor";

export type RoleFeatureMatrix = Record<AppRole, Record<FeatureFlagKey, boolean>>;

export type TabSpec = {
  id: SharedTabId;
  titleKey: string;
  icon: {
    md: AndroidSymbol;
    sfDefault: string;
    sfSelected: string;
  };
  routeName: RoleTabRouteName;
  visibleFor: AppRole[];
};
