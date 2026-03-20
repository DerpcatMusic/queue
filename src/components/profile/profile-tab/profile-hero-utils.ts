import type { useTranslation } from "react-i18next";
import type { ProfileSocialLinks } from "@/components/profile/profile-social-links";
import { isSportType, type SPORT_TYPES, toSportLabel } from "@/convex/constants";

const PROFILE_HEADER_CONTENT_HEIGHT = 128;

export type ProfileHeroStatus = "ready" | "pending" | "unverified";

export type ProfileHeroAction = {
  label: string;
  onPress: () => void;
  icon?:
    | "sparkles"
    | "slider.horizontal.3"
    | "checkmark.circle.fill"
    | "calendar.badge.clock"
    | "mappin.and.ellipse";
};

export function getProfileHeaderExpandedHeight(safeTop: number) {
  return safeTop + PROFILE_HEADER_CONTENT_HEIGHT;
}

export function getSportsLabel(sports: string[], t: ReturnType<typeof useTranslation>["t"]) {
  return sports.length === 0
    ? t("profile.settings.sports.none")
    : sports.length <= 2
      ? sports.map((sport) => (isSportType(sport) ? toSportLabel(sport) : sport)).join(", ")
      : `${isSportType(sports[0] ?? "") ? toSportLabel(sports[0] as (typeof SPORT_TYPES)[number]) : sports[0]} +${String(
          sports.length - 1,
        )}`;
}

export function getProfileSummary(
  bio: string | null | undefined,
  activeSocialCount: number,
  t: ReturnType<typeof useTranslation>["t"],
) {
  const trimmed = bio?.trim();
  if (trimmed) {
    return trimmed;
  }
  return activeSocialCount > 0 ? t("profile.hero.linksReady", { count: activeSocialCount }) : "";
}

export function getActiveSocialCount(socialLinks?: ProfileSocialLinks | undefined) {
  return Object.values(socialLinks ?? {}).filter((value) => Boolean(value?.trim())).length;
}
