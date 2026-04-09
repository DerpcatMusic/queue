#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INPUT_JSON="${ROOT_DIR}/assets/data/europe/london-boroughs.json"
OUTPUT_DIR="${ROOT_DIR}/tmp/london-boundary-tiles"
MBTILES_PATH="${OUTPUT_DIR}/london-boroughs.mbtiles"
PMTILES_PATH="${OUTPUT_DIR}/london-boroughs.pmtiles"

if ! command -v tippecanoe >/dev/null 2>&1; then
  echo "tippecanoe is required but not installed"
  exit 1
fi

if ! command -v pmtiles >/dev/null 2>&1; then
  echo "pmtiles CLI is required but not installed"
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"

tippecanoe \
  --output="${MBTILES_PATH}" \
  --force \
  --named-layer=boundaries \
  --minimum-zoom=5 \
  --maximum-zoom=11 \
  --extend-zooms-if-still-dropping \
  --drop-densest-as-needed \
  "${INPUT_JSON}"

pmtiles convert "${MBTILES_PATH}" "${PMTILES_PATH}"

echo "Built:"
echo "  ${MBTILES_PATH}"
echo "  ${PMTILES_PATH}"
