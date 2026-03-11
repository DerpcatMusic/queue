import type { ZoneOption } from "@/constants/zones";
import { getZoneCityMeta } from "@/constants/zones-map";

export type ZoneLanguage = "en" | "he";

export type ZoneCityGroupZone = ZoneOption & {
  variantLabel: {
    en: string;
    he: string;
  };
};

export type ZoneCityGroup = {
  cityKey: string;
  cityLabel: {
    en: string;
    he: string;
  };
  zones: ZoneCityGroupZone[];
};

export type ZoneCityListItem =
  | {
      kind: "city";
      key: string;
      group: ZoneCityGroup;
      expanded: boolean;
      selectedCount: number;
      showChevron: boolean;
    }
  | {
      kind: "zone";
      key: string;
      cityKey: string;
      zone: ZoneCityGroupZone;
      selected: boolean;
    };

function normalizeLabel(value: string) {
  return value.toLowerCase().replace(/[’']/g, "").replace(/\s+/g, " ").trim();
}

function stripCityPrefix(label: string, cityLabel: string) {
  const separators = [" - ", " – ", " — ", ", "];

  for (const separator of separators) {
    const prefix = `${cityLabel}${separator}`;
    if (normalizeLabel(label).startsWith(normalizeLabel(prefix))) {
      return label.slice(prefix.length).trim();
    }
  }

  return label;
}

function getCommonPrefix(values: string[]) {
  if (values.length === 0) return "";
  let prefix = values[0] ?? "";

  for (const value of values.slice(1)) {
    while (prefix && !normalizeLabel(value).startsWith(normalizeLabel(prefix))) {
      prefix = prefix.slice(0, -1);
    }
    if (!prefix) {
      return "";
    }
  }

  return prefix.replace(/[\s,–—-]+$/g, "").trim();
}

function buildVariantLabel(
  label: { en: string; he: string },
  cityLabel: { en: string; he: string },
) {
  return {
    en: stripCityPrefix(label.en, cityLabel.en),
    he: stripCityPrefix(label.he, cityLabel.he),
  };
}

function matchesQuery(query: string, values: string[]) {
  if (!query) return true;
  return values.some((value) => normalizeLabel(value).includes(query));
}

export function buildZoneCityGroups(zones: ZoneOption[]): ZoneCityGroup[] {
  const groupsByCityKey = new Map<string, ZoneCityGroup>();

  for (const zone of zones) {
    const cityMeta = getZoneCityMeta(zone.id);
    const cityKey = cityMeta?.cityKey ?? zone.id;
    const cityLabel = {
      en: cityMeta?.cityEng ?? zone.label.en,
      he: cityMeta?.cityHeb ?? zone.label.he,
    };

    const existing = groupsByCityKey.get(cityKey);
    const nextZone: ZoneCityGroupZone = {
      ...zone,
      variantLabel: buildVariantLabel(zone.label, cityLabel),
    };

    if (existing) {
      existing.zones.push(nextZone);
      continue;
    }

    groupsByCityKey.set(cityKey, {
      cityKey,
      cityLabel,
      zones: [nextZone],
    });
  }

  return [...groupsByCityKey.values()].map((group) => {
    const sortedZones = [...group.zones].sort((a, b) => a.label.en.localeCompare(b.label.en));
    const resolvedCityLabel =
      sortedZones.length > 1
        ? {
            en: getCommonPrefix(sortedZones.map((zone) => zone.label.en)) || group.cityLabel.en,
            he: getCommonPrefix(sortedZones.map((zone) => zone.label.he)) || group.cityLabel.he,
          }
        : group.cityLabel;

    return {
      ...group,
      cityLabel: resolvedCityLabel,
      zones: sortedZones.map((zone) => ({
        ...zone,
        variantLabel: buildVariantLabel(zone.label, resolvedCityLabel),
      })),
    };
  });
}

export function buildZoneCityListItems({
  groups,
  language,
  query,
  expandedCityKeys,
  selectedZoneIds,
}: {
  groups: ZoneCityGroup[];
  language: ZoneLanguage;
  query: string;
  expandedCityKeys: ReadonlySet<string>;
  selectedZoneIds: ReadonlySet<string>;
}): ZoneCityListItem[] {
  const normalizedQuery = normalizeLabel(query);
  const hasQuery = normalizedQuery.length > 0;
  const items: ZoneCityListItem[] = [];

  const sortedGroups = [...groups].sort((a, b) =>
    a.cityLabel[language].localeCompare(b.cityLabel[language]),
  );

  for (const group of sortedGroups) {
    const cityMatches = matchesQuery(normalizedQuery, [
      group.cityLabel.en,
      group.cityLabel.he,
      group.cityKey,
    ]);
    const matchingZones = group.zones.filter((zone) =>
      matchesQuery(normalizedQuery, [
        zone.label.en,
        zone.label.he,
        zone.variantLabel.en,
        zone.variantLabel.he,
        zone.id,
      ]),
    );

    if (hasQuery && !cityMatches && matchingZones.length === 0) {
      continue;
    }

    const selectedCount = group.zones.filter((zone) => selectedZoneIds.has(zone.id)).length;
    const expanded = group.zones.length > 1 && (hasQuery || expandedCityKeys.has(group.cityKey));

    items.push({
      kind: "city",
      key: `city:${group.cityKey}`,
      group,
      expanded,
      selectedCount,
      showChevron: group.zones.length > 1,
    });

    if (!expanded || group.zones.length <= 1) {
      continue;
    }

    const visibleZones = hasQuery && !cityMatches ? matchingZones : group.zones;
    for (const zone of visibleZones) {
      items.push({
        kind: "zone",
        key: `zone:${zone.id}`,
        cityKey: group.cityKey,
        zone,
        selected: selectedZoneIds.has(zone.id),
      });
    }
  }

  return items;
}
