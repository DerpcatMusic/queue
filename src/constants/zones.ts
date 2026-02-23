import { ZONE_OPTIONS, type ZoneOption } from "@/constants/zones.generated";

export { ZONE_OPTIONS, type ZoneOption };

function findZoneById(zoneId: string): ZoneOption | undefined {
  return ZONE_OPTIONS.find((zone) => zone.id === zoneId);
}

export function getZoneLabel(zoneId: string, language: "en" | "he" = "en"): string {
  const zone = findZoneById(zoneId);
  if (!zone) return zoneId;

  return language === "he" ? zone.label.he : zone.label.en;
}
