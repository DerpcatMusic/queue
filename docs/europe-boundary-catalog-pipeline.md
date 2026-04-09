# Europe Boundary Catalog Pipeline

Current strategy:

1. Use generic `boundaryId` + `boundaryProvider` across app state.
2. Keep Israel `zone` compatibility during migration.
3. Ingest Europe boundary metadata into Convex `boundaries`.
4. Let the client send `boundaryProvider` + `boundaryId` when a studio/branch selects a polygon.

## Current provider recommendation

- Free/open pilot provider: `overture-admin`
- Boundary kinds for MVP:
  - `city`
  - `district`
  - `locality`
  - `neighborhood`

Avoid postcode-first launch unless you have a verified licensed dataset for the target country.

## Import format

The importer expects a JSON array or `{ "entries": [...] }`.

Each entry:

```json
{
  "provider": "overture-admin",
  "boundaryId": "de-berlin-mitte",
  "kind": "district",
  "countryCode": "DE",
  "name": "Mitte",
  "parentBoundaryId": "de-berlin",
  "cityKey": "berlin",
  "postcode": "10115",
  "centroidLatitude": 52.532,
  "centroidLongitude": 13.384,
  "bbox": {
    "swLng": 13.36,
    "swLat": 52.51,
    "neLng": 13.41,
    "neLat": 52.55
  },
  "metadata": {
    "source": "overture",
    "divisionType": "locality"
  }
}
```

## Import command

```bash
bun run seed:boundaries -- --input ./data/europe/berlin-boundaries.json
```

Optional:

```bash
bun run seed:boundaries -- --input ./data/europe/berlin-boundaries.json --batch-size 150
```

## What exists already

- Convex catalog API in `convex/boundaries.ts`
- Batch import mutation: `boundaries:upsertBoundaryCatalogBatch`
- Script importer: `scripts/data/import-boundary-catalog.mjs`
- Studio/branch writes accept explicit `boundaryProvider` / `boundaryId`

## Next implementation step

1. Produce a normalized Berlin boundary catalog from Overture.
2. Import it with the batch script.
3. Update map selection UI to submit `boundaryProvider` + `boundaryId`.
4. Replace Israel-only location copy and assumptions in the studio flow.
