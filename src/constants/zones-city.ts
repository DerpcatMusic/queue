import zoneCityIndexRaw from "../../assets/data/pikud-haoref/zone-city-index.json";

export type ZoneCityMeta = {
  cityKey: string;
  cityHeb: string;
  cityEng: string;
};

type ZoneCityIndexEntry = {
  id: string;
  cityKey: string;
  cityHeb: string;
  cityEng: string;
};

type ZoneCityIndexFile = {
  version: number;
  generatedAt: string;
  zoneCount: number;
  cityCount: number;
  zones: ZoneCityIndexEntry[];
  cities: { cityKey: string; zoneIds: string[] }[];
};

const zoneCityIndex = zoneCityIndexRaw as ZoneCityIndexFile;

const zoneCityByZoneId = new Map<string, ZoneCityMeta>();
const zoneIdsByCityKey = new Map<string, string[]>();

for (const zone of zoneCityIndex.zones ?? []) {
  const zoneId = String(zone.id ?? "").trim();
  if (!zoneId) continue;
  zoneCityByZoneId.set(zoneId, {
    cityKey: String(zone.cityKey ?? "").trim(),
    cityHeb: String(zone.cityHeb ?? "").trim(),
    cityEng: String(zone.cityEng ?? "").trim(),
  });
}

for (const city of zoneCityIndex.cities ?? []) {
  const cityKey = String(city.cityKey ?? "").trim();
  if (!cityKey) continue;
  const zoneIds = [...new Set((city.zoneIds ?? []).map((id) => String(id).trim()))].filter(
    (id) => id.length > 0,
  );
  zoneIdsByCityKey.set(cityKey, zoneIds);
}

export function getZoneCityMeta(zoneId: string): ZoneCityMeta | undefined {
  return zoneCityByZoneId.get(zoneId);
}

export function getZoneIdsForCity(cityKey: string): string[] {
  return [...(zoneIdsByCityKey.get(cityKey) ?? [])];
}
