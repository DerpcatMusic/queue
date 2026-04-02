import { isSportType, type SportType, toSportLabel } from "@/convex/constants";

/**
 * Returns a translated sport label using i18n.
 * Falls back to the English label from convex/constants if no translation exists.
 */
export function toSportLabelI18n(
  sport: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string | string[], options?: any) => any,
): string {
  // Try i18n translation first
  const translated = t(`sports.${sport}`, { defaultValue: sport });
  if (typeof translated === "string" && translated) {
    return translated;
  }
  // Fallback to English label from constants
  if (isSportType(sport)) {
    return toSportLabel(sport as SportType);
  }
  return sport;
}

/**
 * Returns a translated capability tag label using i18n.
 * Falls back to the capitalized slug if no translation exists.
 */
export function toCapabilityTagLabelI18n(
  tag: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string | string[], options?: any) => any,
): string {
  const translated = t(`sports.${tag}`, { defaultValue: tag });
  if (typeof translated === "string" && translated) {
    return translated;
  }
  // Fallback to capitalized slug
  return tag
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
