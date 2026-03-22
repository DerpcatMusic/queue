import { ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";

import { type BrandPalette } from "@/constants/brand";
import type { AppRole } from "@/navigation/types";

import { ProfileSectionCard, ProfileSettingRow } from "./profile-settings-sections";

const ROLE_ORDER: AppRole[] = ["instructor", "studio"];

const ROLE_META: Record<
  AppRole,
  {
    icon: "person.crop.circle.fill" | "building.2.fill";
    titleKey: "profile.roles.instructor" | "profile.roles.studio";
    activeHintKey: "profile.switcher.instructorActiveHint" | "profile.switcher.studioActiveHint";
    switchHintKey: "profile.switcher.instructorSwitchHint" | "profile.switcher.studioSwitchHint";
  }
> = {
  instructor: {
    icon: "person.crop.circle.fill",
    titleKey: "profile.roles.instructor",
    activeHintKey: "profile.switcher.instructorActiveHint",
    switchHintKey: "profile.switcher.instructorSwitchHint",
  },
  studio: {
    icon: "building.2.fill",
    titleKey: "profile.roles.studio",
    activeHintKey: "profile.switcher.studioActiveHint",
    switchHintKey: "profile.switcher.studioSwitchHint",
  },
};

export function ProfileRoleSwitcherCard({
  activeRole,
  availableRoles,
  isSwitching,
  pendingRole,
  onSwitchRole,
  palette,
}: {
  activeRole: AppRole;
  availableRoles: AppRole[];
  isSwitching: boolean;
  pendingRole: AppRole | null;
  onSwitchRole: (role: AppRole) => void;
  palette: BrandPalette;
}) {
  const { t } = useTranslation();
  const visibleRoles = ROLE_ORDER.filter((role) => availableRoles.includes(role));

  return (
    <ProfileSectionCard palette={palette}>
      {visibleRoles.map((role, index) => {
        const meta = ROLE_META[role];
        const isActive = role === activeRole;
        const isBusy = pendingRole === role;
        const canSwitch = !isActive && !isSwitching;

        return (
          <ProfileSettingRow
            key={role}
            title={t(meta.titleKey)}
            subtitle={t(isActive ? meta.activeHintKey : meta.switchHintKey)}
            icon={meta.icon}
            palette={palette}
            tone={isActive ? "accent" : "default"}
            showDivider={index < ROLE_ORDER.length - 1}
            {...(isActive ? { value: t("profile.switcher.activeBadge") } : {})}
            {...(canSwitch ? { onPress: () => onSwitchRole(role) } : {})}
            {...(isBusy
              ? {
                  accessory: <ActivityIndicator size="small" color={palette.primary as string} />,
                }
              : {})}
          />
        );
      })}
    </ProfileSectionCard>
  );
}
