import type MaterialIcons from "@expo/vector-icons/MaterialIcons";

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
    material: keyof typeof MaterialIcons.glyphMap;
    sfDefault: string;
    sfSelected: string;
  };
  routeName: string;
  visibleFor: AppRole[];
};
