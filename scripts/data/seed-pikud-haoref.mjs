#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PAKARLIB_SOURCE_BASE_URL =
  "https://raw.githubusercontent.com/yuvadm/pakarlib/main/pakarlib/data/build";
const OREF_DISTRICTS_BASE_URL = "https://www.oref.org.il/districts";

const SOURCE_FILES = {
  geojson: "all.geojson",
  districts: "districts.json",
  cities: "cities.json",
};

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const outputDataDir = path.join(rootDir, "assets", "data", "pikud-haoref");
const outputMetaPath = path.join(outputDataDir, "meta.json");
const outputZoneIndexPath = path.join(outputDataDir, "zone-index.json");
const outputZonesPath = path.join(rootDir, "constants", "zones.generated.ts");
const outputConvexZoneIdsPath = path.join(
  rootDir,
  "convex",
  "pikud-zones.generated.ts",
);
const outputAllJsonPath = path.join(outputDataDir, "all.json");
const outputCityPolygonsPath = path.join(outputDataDir, "city-polygons.json");

function asNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

async function fetchJson(url, description) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "queue-seed-script",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${description}: ${response.status} ${response.statusText}`,
    );
  }

  return await response.json();
}

function buildEmptyBounds() {
  return {
    minLng: Number.POSITIVE_INFINITY,
    minLat: Number.POSITIVE_INFINITY,
    maxLng: Number.NEGATIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY,
  };
}

function updateBoundsFromPosition(bounds, maybePosition) {
  if (!Array.isArray(maybePosition) || maybePosition.length < 2) return;

  const lng = Number(maybePosition[0]);
  const lat = Number(maybePosition[1]);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

  bounds.minLng = Math.min(bounds.minLng, lng);
  bounds.minLat = Math.min(bounds.minLat, lat);
  bounds.maxLng = Math.max(bounds.maxLng, lng);
  bounds.maxLat = Math.max(bounds.maxLat, lat);
}

function walkCoordinates(bounds, coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return;

  if (typeof coordinates[0] === "number") {
    updateBoundsFromPosition(bounds, coordinates);
    return;
  }

  for (const part of coordinates) {
    walkCoordinates(bounds, part);
  }
}

function getGeometryBounds(geometry) {
  if (!geometry || typeof geometry !== "object") return null;

  const bounds = buildEmptyBounds();

  if (
    geometry.type === "GeometryCollection" &&
    Array.isArray(geometry.geometries)
  ) {
    for (const subGeometry of geometry.geometries) {
      const subBounds = getGeometryBounds(subGeometry);
      if (!subBounds) continue;

      updateBoundsFromPosition(bounds, [subBounds[0], subBounds[1]]);
      updateBoundsFromPosition(bounds, [subBounds[2], subBounds[3]]);
    }
  } else {
    walkCoordinates(bounds, geometry.coordinates);
  }

  if (
    !Number.isFinite(bounds.minLng) ||
    !Number.isFinite(bounds.minLat) ||
    !Number.isFinite(bounds.maxLng) ||
    !Number.isFinite(bounds.maxLat)
  ) {
    return null;
  }

  return [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat];
}

function buildZoneIndex(geojson) {
  if (
    !geojson ||
    geojson.type !== "FeatureCollection" ||
    !Array.isArray(geojson.features)
  ) {
    throw new Error("Invalid GeoJSON payload from zone source");
  }

  const zones = [];
  const globalBounds = buildEmptyBounds();

  geojson.features.forEach((feature, featureIndex) => {
    const properties = feature?.properties ?? {};
    const id = String(properties.id ?? "").trim();
    if (!id) return;

    const bbox = getGeometryBounds(feature.geometry);
    if (!bbox) return;

    const center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];

    zones.push({
      id,
      featureIndex,
      bbox,
      center,
      seconds: asNumber(properties.seconds, 0),
    });

    updateBoundsFromPosition(globalBounds, [bbox[0], bbox[1]]);
    updateBoundsFromPosition(globalBounds, [bbox[2], bbox[3]]);
  });

  zones.sort((a, b) => a.id.localeCompare(b.id, "en", { sensitivity: "base" }));

  if (
    !Number.isFinite(globalBounds.minLng) ||
    !Number.isFinite(globalBounds.minLat) ||
    !Number.isFinite(globalBounds.maxLng) ||
    !Number.isFinite(globalBounds.maxLat)
  ) {
    throw new Error("Failed to compute global bounds for zones");
  }

  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    bounds: {
      sw: [globalBounds.minLng, globalBounds.minLat],
      ne: [globalBounds.maxLng, globalBounds.maxLat],
    },
    zones,
  };
}

function toGeneratedTs(options) {
  return `// Auto-generated by scripts/data/seed-pikud-haoref.mjs\n// Do not edit manually.\n\nexport type ZoneOption = {\n  id: string;\n  label: {\n    en: string;\n    he: string;\n  };\n  seconds: number;\n};\n\nexport const ZONE_OPTIONS: ZoneOption[] = ${JSON.stringify(options, null, 2)};\n`;
}

function toConvexZoneIdsTs(zoneIds) {
  return `// Auto-generated by scripts/data/seed-pikud-haoref.mjs\n// Do not edit manually.\n\nexport const PIKUD_HAOREF_ZONE_IDS = ${JSON.stringify(zoneIds, null, 2)} as const;\n\nexport type PikudHaorefZoneId = (typeof PIKUD_HAOREF_ZONE_IDS)[number];\n`;
}

function buildCityNameMap(citiesHeb, citiesEng) {
  const enById = new Map();
  const map = new Map();

  for (const city of citiesEng ?? []) {
    enById.set(String(city?.id ?? ""), String(city?.label ?? "").trim());
  }

  for (const city of citiesHeb ?? []) {
    const id = String(city?.id ?? "");
    const heLabelRaw = String(city?.label ?? "").trim();
    const enLabelRaw = enById.get(id) ?? "";

    const heCity = heLabelRaw.split("|")[0]?.trim();
    const enCity = enLabelRaw.split("|")[0]?.trim();
    if (!heCity) continue;

    if (!map.has(heCity)) {
      map.set(heCity, enCity || heCity);
    }
  }

  return map;
}

function normalizeAreasGeoJson(allGeoJson, districtsHeb, districtsEng, cityNameMap) {
  const districtHebById = new Map();
  const districtEngById = new Map();

  for (const item of districtsHeb ?? []) {
    districtHebById.set(String(item?.id ?? ""), item);
  }
  for (const item of districtsEng ?? []) {
    districtEngById.set(String(item?.id ?? ""), item);
  }

  const features = (allGeoJson.features ?? [])
    .map((feature) => {
      const p = feature?.properties ?? {};
      const id = String(p.id ?? "").trim();
      const hebNameRaw = String(p.hebName ?? "").trim();
      const engNameRaw = String(p.engName ?? "").trim();
      if (!id || !hebNameRaw) return null;

      const districtHe = districtHebById.get(id);
      const districtEn = districtEngById.get(id);

      const hebName = String(
        districtHe?.label_he ?? districtHe?.label ?? hebNameRaw,
      ).trim();
      const engName = String(districtEn?.label ?? (engNameRaw || hebName)).trim();
      const seconds = asNumber(districtHe?.migun_time ?? p.seconds, 0);

      const cityHeb = hebName.includes(" - ")
        ? hebName.split(" - ")[0].trim()
        : hebName;
      const cityEng = cityNameMap.get(cityHeb) ??
        (engName.includes(" - ") ? engName.split(" - ")[0].trim() : engName);

      return {
        ...feature,
        properties: {
          id,
          hebName,
          engName,
          seconds,
          type: String(p.type ?? "listed"),
          cityHeb,
          cityEng,
        },
      };
    })
    .filter(Boolean);

  features.sort((a, b) =>
    String(a.properties.engName).localeCompare(String(b.properties.engName), "en", {
      sensitivity: "base",
    }),
  );

  return {
    type: "FeatureCollection",
    features,
  };
}

async function dissolveCitiesByName(areaGeoJson) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "queue-cities-"));
  const inputPath = path.join(tempDir, "areas.geojson");
  const outputPath = path.join(tempDir, "cities.geojson");

  try {
    await writeFile(inputPath, JSON.stringify(areaGeoJson));

    await execFileAsync(
      "npx",
      [
        "-y",
        "mapshaper",
        inputPath,
        "-dissolve",
        "cityHeb",
        "copy-fields=cityHeb,cityEng",
        "-o",
        "format=geojson",
        outputPath,
      ],
      { maxBuffer: 32 * 1024 * 1024 },
    );

    const raw = await readFile(outputPath, "utf8");
    const dissolved = JSON.parse(raw);

    const features = (dissolved.features ?? [])
      .map((feature) => {
        const cityHeb = String(feature?.properties?.cityHeb ?? "").trim();
        const cityEng = String(feature?.properties?.cityEng ?? cityHeb).trim();
        if (!cityHeb) return null;

        return {
          type: "Feature",
          properties: {
            id: cityHeb,
            cityHeb,
            cityEng,
          },
          geometry: feature.geometry,
        };
      })
      .filter(Boolean)
      .sort((a, b) =>
        String(a.properties.cityEng).localeCompare(String(b.properties.cityEng), "en", {
          sensitivity: "base",
        }),
      );

    return {
      type: "FeatureCollection",
      features,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function buildZoneOptions(geojson) {
  const options = (geojson.features ?? []).map((feature) => ({
    id: String(feature.properties.id),
    label: {
      en: String(feature.properties.engName || feature.properties.hebName),
      he: String(feature.properties.hebName || feature.properties.engName),
    },
    seconds: asNumber(feature.properties.seconds, 0),
  }));

  options.sort((a, b) =>
    a.label.en.localeCompare(b.label.en, "en", { sensitivity: "base" }),
  );

  return options;
}

async function run() {
  console.log("Fetching high-resolution Pikud HaOref area polygons...");

  const [allGeoJsonRaw, districts, cities, districtsHeb, districtsEng, citiesHeb, citiesEng] =
    await Promise.all([
      fetchJson(
        `${PAKARLIB_SOURCE_BASE_URL}/${SOURCE_FILES.geojson}`,
        "pakarlib all.geojson",
      ),
      fetchJson(
        `${PAKARLIB_SOURCE_BASE_URL}/${SOURCE_FILES.districts}`,
        "pakarlib districts",
      ),
      fetchJson(
        `${PAKARLIB_SOURCE_BASE_URL}/${SOURCE_FILES.cities}`,
        "pakarlib cities",
      ),
      fetchJson(`${OREF_DISTRICTS_BASE_URL}/districts_heb.json`, "Oref districts_heb"),
      fetchJson(`${OREF_DISTRICTS_BASE_URL}/districts_eng.json`, "Oref districts_eng"),
      fetchJson(`${OREF_DISTRICTS_BASE_URL}/cities_heb.json`, "Oref cities_heb"),
      fetchJson(`${OREF_DISTRICTS_BASE_URL}/cities_eng.json`, "Oref cities_eng"),
    ]);

  const cityNameMap = buildCityNameMap(citiesHeb, citiesEng);
  const allGeoJson = normalizeAreasGeoJson(
    allGeoJsonRaw,
    districtsHeb,
    districtsEng,
    cityNameMap,
  );

  const cityPolygons = await dissolveCitiesByName(allGeoJson);
  const zoneOptions = buildZoneOptions(allGeoJson);
  const zoneIds = zoneOptions.map((option) => option.id);
  const zoneIndex = buildZoneIndex(allGeoJson);

  if (zoneOptions.length < 1000) {
    throw new Error(
      `Unexpectedly low zone count (${zoneOptions.length}). Aborting to avoid bad seed data.`,
    );
  }

  await mkdir(outputDataDir, { recursive: true });

  await Promise.all([
    writeFile(path.join(outputDataDir, SOURCE_FILES.geojson), JSON.stringify(allGeoJson)),
    writeFile(outputAllJsonPath, JSON.stringify(allGeoJson)),
    writeFile(path.join(outputDataDir, SOURCE_FILES.districts), JSON.stringify(districts)),
    writeFile(path.join(outputDataDir, SOURCE_FILES.cities), JSON.stringify(cities)),
    writeFile(outputZoneIndexPath, JSON.stringify(zoneIndex)),
    writeFile(outputCityPolygonsPath, JSON.stringify(cityPolygons)),
    writeFile(
      outputMetaPath,
      JSON.stringify(
        {
          source: {
            polygons: `${PAKARLIB_SOURCE_BASE_URL}/${SOURCE_FILES.geojson}`,
            names: `${OREF_DISTRICTS_BASE_URL}/districts_heb.json + districts_eng.json`,
            cityNames: `${OREF_DISTRICTS_BASE_URL}/cities_heb.json + cities_eng.json`,
            cityDissolveTool: "mapshaper dissolve by cityHeb",
          },
          generatedAt: new Date().toISOString(),
          areaZoneCount: zoneOptions.length,
          cityPolygonCount: cityPolygons.features.length,
          zoneIndexCount: zoneIndex.zones.length,
          notes:
            "all.json stores high-resolution alert areas; city-polygons.json stores dissolved city boundaries for zoomed-out labeling.",
        },
        null,
        2,
      ),
    ),
    writeFile(outputZonesPath, toGeneratedTs(zoneOptions)),
    writeFile(outputConvexZoneIdsPath, toConvexZoneIdsTs(zoneIds)),
  ]);

  console.log(
    `Seed complete. Wrote ${zoneOptions.length} high-resolution zones and ${cityPolygons.features.length} city polygons.`,
  );
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
