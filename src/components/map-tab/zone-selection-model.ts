import { getZoneCityMeta } from "@/constants/zones-city";
import { ZONE_OPTIONS } from "@/constants/zones";

export const MAX_PREVIEW_ZONES = 20;

export type Language = "en" | "he";

export type EnrichedZoneOption = (typeof ZONE_OPTIONS)[number] & {
  cityKey: string;
  cityLabel: {
    en: string;
    he: string;
  };
};

export type ZoneCityGroup = {
  cityKey: string;
  cityLabel: string;
  zones: EnrichedZoneOption[];
  zoneIds: string[];
  selectedCount: number;
  matchingZoneCount: number;
  isFullySelected: boolean;
  hasSplits: boolean;
};

export type ZoneListRow =
  | {
      kind: "city";
      key: string;
      group: ZoneCityGroup;
      isExpanded: boolean;
    }
  | {
      kind: "zone";
      key: string;
      cityKey: string;
      zone: EnrichedZoneOption;
      selected: boolean;
    };

type IndexedCityGroup = {
  cityKey: string;
  cityLabel: {
    en: string;
    he: string;
  };
  zones: EnrichedZoneOption[];
  zoneIds: string[];
  hasSplits: boolean;
  searchText: string;
  zoneSearchTexts: string[];
};

type BuildZoneSelectionViewModelArgs = {
  expandedCityKeys: string[];
  isZoneModeEnabled: boolean;
  language: Language;
  selectedZoneIds: string[];
  zoneSearch: string;
};

type ZoneSelectionViewModel = {
  filteredCityGroups: ZoneCityGroup[];
  zoneListRows: ZoneListRow[];
  previewZoneIds: string[];
};
type QueryFilteredGroup = {
  group: IndexedCityGroup;
  matchingZoneCount: number;
};

const ZONE_OPTIONS_BY_ID = new Map(
  ZONE_OPTIONS.map((zoneOption) => [zoneOption.id, zoneOption] as const),
);

const ENRICHED_ZONES: EnrichedZoneOption[] = ZONE_OPTIONS.map((zone) => {
  const cityMeta = getZoneCityMeta(zone.id);
  if (!cityMeta) {
    return {
      ...zone,
      cityKey: zone.id,
      cityLabel: {
        en: zone.label.en,
        he: zone.label.he,
      },
    };
  }

  return {
    ...zone,
    cityKey: cityMeta.cityKey,
    cityLabel: {
      en: cityMeta.cityEng || zone.label.en,
      he: cityMeta.cityHeb || zone.label.he,
    },
  };
});

const ENRICHED_ZONE_BY_ID = new Map(
  ENRICHED_ZONES.map((zone) => [zone.id, zone] as const),
);

function buildIndexedCityGroups(language: Language): IndexedCityGroup[] {
  const grouped = new Map<string, EnrichedZoneOption[]>();
  for (const zone of ENRICHED_ZONES) {
    const existing = grouped.get(zone.cityKey);
    if (existing) {
      existing.push(zone);
    } else {
      grouped.set(zone.cityKey, [zone]);
    }
  }

  const groups: IndexedCityGroup[] = [];
  for (const [cityKey, zones] of grouped.entries()) {
    const orderedZones = [...zones].sort((a, b) =>
      a.label[language].localeCompare(b.label[language], language, {
        sensitivity: "base",
      }),
    );

    const cityLabelEn = orderedZones[0]?.cityLabel.en ?? orderedZones[0]?.label.en ?? cityKey;
    const cityLabelHe = orderedZones[0]?.cityLabel.he ?? orderedZones[0]?.label.he ?? cityKey;

    groups.push({
      cityKey,
      cityLabel: {
        en: cityLabelEn,
        he: cityLabelHe,
      },
      zones: orderedZones,
      zoneIds: orderedZones.map((zone) => zone.id),
      hasSplits: orderedZones.length > 1,
      searchText: `${cityLabelEn} ${cityLabelHe}`.toLowerCase(),
      zoneSearchTexts: orderedZones.map((zone) =>
        `${zone.label.en} ${zone.label.he} ${zone.id}`.toLowerCase(),
      ),
    });
  }

  groups.sort((a, b) =>
    a.cityLabel[language].localeCompare(b.cityLabel[language], language, {
      sensitivity: "base",
    }),
  );

  return groups;
}

const INDEXED_CITY_GROUPS: Record<Language, readonly IndexedCityGroup[]> = {
  en: buildIndexedCityGroups("en"),
  he: buildIndexedCityGroups("he"),
};
const QUERY_FILTER_CACHE_MAX_ENTRIES = 64;
const QUERY_FILTER_CACHE: Record<Language, Map<string, readonly QueryFilteredGroup[]>> = {
  en: new Map(),
  he: new Map(),
};

function buildSelectedCountByCity(selectedZoneIds: string[]): Map<string, number> {
  const selectedCountByCity = new Map<string, number>();
  for (const zoneId of selectedZoneIds) {
    const zone = ENRICHED_ZONE_BY_ID.get(zoneId);
    if (!zone) continue;

    selectedCountByCity.set(
      zone.cityKey,
      (selectedCountByCity.get(zone.cityKey) ?? 0) + 1,
    );
  }

  return selectedCountByCity;
}

function cacheQueryResult(
  language: Language,
  query: string,
  result: readonly QueryFilteredGroup[],
) {
  const cache = QUERY_FILTER_CACHE[language];
  if (cache.has(query)) {
    cache.set(query, result);
    return;
  }
  if (cache.size >= QUERY_FILTER_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey === "string") {
      cache.delete(oldestKey);
    }
  }
  cache.set(query, result);
}

function getQueryFilteredGroups(language: Language, query: string): readonly QueryFilteredGroup[] {
  const cached = QUERY_FILTER_CACHE[language].get(query);
  if (cached) return cached;

  const filtered: QueryFilteredGroup[] = [];
  for (const group of INDEXED_CITY_GROUPS[language]) {
    if (query.length === 0) {
      filtered.push({
        group,
        matchingZoneCount: group.zones.length,
      });
      continue;
    }

    const cityLabel = group.cityLabel[language] || group.cityKey;
    let zoneMatchCount = 0;
    for (const zoneSearchText of group.zoneSearchTexts) {
      if (zoneSearchText.includes(query)) {
        zoneMatchCount += 1;
      }
    }

    const matchesCityQuery =
      group.searchText.includes(query) ||
      cityLabel.toLowerCase().includes(query);
    const matchesAnyZone = zoneMatchCount > 0;
    if (!matchesCityQuery && !matchesAnyZone) continue;

    filtered.push({
      group,
      matchingZoneCount: Math.max(matchesCityQuery ? 1 : 0, zoneMatchCount),
    });
  }

  cacheQueryResult(language, query, filtered);
  return filtered;
}

export function isKnownZoneId(zoneId: string): boolean {
  return ZONE_OPTIONS_BY_ID.has(zoneId);
}

export function sanitizeZoneIds(zoneIds: string[]): string[] {
  return [...new Set(zoneIds.map((zoneId) => zoneId.trim()))].filter((zoneId) =>
    ZONE_OPTIONS_BY_ID.has(zoneId),
  );
}

export function buildZoneSelectionViewModel({
  expandedCityKeys,
  isZoneModeEnabled,
  language,
  selectedZoneIds,
  zoneSearch,
}: BuildZoneSelectionViewModelArgs): ZoneSelectionViewModel {
  const query = zoneSearch.trim().toLowerCase();
  const queryFilteredGroups = getQueryFilteredGroups(language, query);
  const selectedCountByCity = buildSelectedCountByCity(selectedZoneIds);
  const filteredCityGroups: ZoneCityGroup[] = [];

  for (const queryGroup of queryFilteredGroups) {
    const group = queryGroup.group;
    const cityLabel = group.cityLabel[language] || group.cityKey;
    const selectedCount = selectedCountByCity.get(group.cityKey) ?? 0;
    const nextGroup: ZoneCityGroup = {
      cityKey: group.cityKey,
      cityLabel,
      zones: group.zones,
      zoneIds: group.zoneIds,
      selectedCount,
      matchingZoneCount: queryGroup.matchingZoneCount,
      isFullySelected: selectedCount === group.zones.length,
      hasSplits: group.hasSplits,
    };

    filteredCityGroups.push(nextGroup);
  }
  const expandedCityKeySet = new Set(expandedCityKeys);
  const selectedZoneIdSet = new Set(selectedZoneIds);

  const zoneListRows: ZoneListRow[] = [];
  for (const group of filteredCityGroups) {
    const isExpanded = expandedCityKeySet.has(group.cityKey);
    zoneListRows.push({
      kind: "city",
      key: `city:${group.cityKey}`,
      group,
      isExpanded,
    });

    if (!group.hasSplits || !isExpanded) {
      continue;
    }

    for (const zone of group.zones) {
      zoneListRows.push({
        kind: "zone",
        key: `zone:${group.cityKey}:${zone.id}`,
        cityKey: group.cityKey,
        zone,
        selected: selectedZoneIdSet.has(zone.id),
      });
    }
  }

  const previewZoneIds: string[] = [];
  if (isZoneModeEnabled && query.length > 0) {
    for (const group of filteredCityGroups) {
      for (const zone of group.zones) {
        previewZoneIds.push(zone.id);
        if (previewZoneIds.length >= MAX_PREVIEW_ZONES) {
          break;
        }
      }

      if (previewZoneIds.length >= MAX_PREVIEW_ZONES) {
        break;
      }
    }
  }

  return {
    filteredCityGroups,
    zoneListRows,
    previewZoneIds,
  };
}
