import type { ZoneOption } from "@/constants/zones";

export function hasZoneSelectionChanges(persistedZoneIds: string[], selectedZoneIds: string[]) {
  if (persistedZoneIds.length !== selectedZoneIds.length) return true;
  const currentSet = new Set(selectedZoneIds);
  return persistedZoneIds.some((id) => !currentSet.has(id));
}

export function countPendingZoneSelectionChanges(
  persistedZoneIds: string[],
  selectedZoneIds: string[],
) {
  const persistedSet = new Set(persistedZoneIds);
  const selectedSet = new Set(selectedZoneIds);
  let delta = 0;

  for (const zoneId of selectedSet) {
    if (!persistedSet.has(zoneId)) delta += 1;
  }
  for (const zoneId of persistedSet) {
    if (!selectedSet.has(zoneId)) delta += 1;
  }

  return delta;
}

export function buildFilteredZones(
  zones: readonly ZoneOption[],
  zoneSearch: string,
  zoneLanguage: "en" | "he",
) {
  const q = zoneSearch.trim().toLowerCase();
  if (!q) return [...zones];
  return zones.filter((zone) => {
    const label = zone.label[zoneLanguage].toLowerCase();
    const fallback = zone.label.en.toLowerCase();
    const id = zone.id.toLowerCase();
    return label.includes(q) || fallback.includes(q) || id.includes(q);
  });
}
