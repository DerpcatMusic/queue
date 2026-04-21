// Stub implementation — pikud-haoref data was removed.
// Onboarding now uses H3 for global geolocation.

export type ZoneCityMeta = {
  cityKey: string;
  cityHeb: string;
  cityEng: string;
};

export function getZoneCityMeta(_zoneId: string): ZoneCityMeta | undefined {
  return undefined;
}

export function getZoneIdsForCity(_cityKey: string): string[] {
  return [];
}