#!/usr/bin/env bash
#
# Builds vector tiles from England locality GeoJSON.
# Produces two layers via tippecanoe named-layers:
#   - coarse:  z0-8  (county/district level)
#   - fine:    z9-14 (locality level)
#
# If source GeoJSON is missing, prints instructions to run the download script first.
#
# Usage:
#   ./scripts/data/build-england-boundary-tiles.sh
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INPUT_JSON="${ROOT_DIR}/assets/data/europe/england-localities.json"
OUTPUT_DIR="${ROOT_DIR}/tmp/england-boundary-tiles"
MBTILES_PATH="${OUTPUT_DIR}/england-boundaries.mbtiles"
PMTILES_PATH="${OUTPUT_DIR}/england-boundaries.pmtiles"
COARSE_GEOJSON="${OUTPUT_DIR}/england-coarse.geojson"
FINE_GEOJSON="${OUTPUT_DIR}/england-fine.geojson"

if [ ! -f "${INPUT_JSON}" ]; then
    echo "Error: Source file not found: ${INPUT_JSON}"
    echo "Run the download script first:"
    echo "  python3 scripts/data/download-england-boundaries.py"
    exit 1
fi

if ! command -v tippecanoe >/dev/null 2>&1; then
    echo "Error: tippecanoe is required but not installed"
    echo "Install: brew install tippecanoe  (macOS) or apt install tippecanoe (linux)"
    exit 1
fi

if ! command -v pmtiles >/dev/null 2>&1; then
    echo "Error: pmtiles CLI is required but not installed"
    echo "Install: go install github.com/mapbox/pmtiles@latest"
    exit 1
fi

mkdir -p "${OUTPUT_DIR}"

OUTPUT_DIR="${OUTPUT_DIR}" INPUT_JSON="${INPUT_JSON}" COARSE_GEOJSON="${COARSE_GEOJSON}" FINE_GEOJSON="${FINE_GEOJSON}" python3 - <<'PY'
import json, os, pathlib

root = pathlib.Path(os.environ["OUTPUT_DIR"])
input_path = pathlib.Path(os.environ["INPUT_JSON"])
coarse_path = pathlib.Path(os.environ["COARSE_GEOJSON"])
fine_path = pathlib.Path(os.environ["FINE_GEOJSON"])

with input_path.open() as handle:
    data = json.load(handle)

features = data.get("features", [])
coarse = [f for f in features if (f.get("properties") or {}).get("subtype") in {"county", "metropolitan_area", "district", "localadmin"}]
fine = [f for f in features if (f.get("properties") or {}).get("subtype") in {"locality", "borough"}]

coarse_path.write_text(json.dumps({"type": "FeatureCollection", "features": coarse}))
fine_path.write_text(json.dumps({"type": "FeatureCollection", "features": fine}))
print(f"split features: coarse={len(coarse)} fine={len(fine)}")
PY

echo "Building coarse layer (z0-8)..."
tippecanoe \
    --output="${OUTPUT_DIR}/coarse.mbtiles" \
    --force \
    --layer=coarse \
    --minimum-zoom=0 \
    --maximum-zoom=8 \
    --extend-zooms-if-still-dropping \
    --drop-densest-as-needed \
    "${COARSE_GEOJSON}"

echo "Building fine layer (z9-14)..."
tippecanoe \
    --output="${OUTPUT_DIR}/fine.mbtiles" \
    --force \
    --layer=fine \
    --minimum-zoom=9 \
    --maximum-zoom=14 \
    --extend-zooms-if-still-dropping \
    --drop-densest-as-needed \
    "${FINE_GEOJSON}"

echo "Merging layers..."
if command -v tile-join >/dev/null 2>&1; then
    tile-join -o "${MBTILES_PATH}" "${OUTPUT_DIR}/coarse.mbtiles" "${OUTPUT_DIR}/fine.mbtiles"
else
    echo "Warning: tile-join not found, using fine layer only"
    cp "${OUTPUT_DIR}/fine.mbtiles" "${MBTILES_PATH}"
fi

pmtiles convert "${MBTILES_PATH}" "${PMTILES_PATH}"

echo ""
echo "Built tiles:"
echo "  MBTILES: ${MBTILES_PATH}"
echo "  PMTILES: ${PMTILES_PATH}"
echo ""
echo "To serve locally with a tile server, point EXPO_PUBLIC_ENGLAND_BOUNDARY_TILES_URL_TEMPLATE to:"
echo "  e.g. http://localhost:8080/{z}/{x}/{y}.mvt  (if using tileserver-gl)"
echo ""
echo "Zoom tier mapping:"
echo "  coarse (z0-8):  county/district boundaries"
echo "  fine   (z9-14): locality/neighbourhood boundaries"
