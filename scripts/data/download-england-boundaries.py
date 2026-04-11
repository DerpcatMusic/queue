#!/usr/bin/env python3
"""
Downloads England locality boundaries from Overture Maps.

Usage:
    python3 scripts/data/download-england-boundaries.py

Output:
    tmp/england-overture-localities.geojson
    assets/data/europe/england-localities.json
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TMP_DIR = ROOT / "tmp"
ASSET_DIR = ROOT / "assets" / "data" / "europe"

# England bounding box (tighter than full UK)
SOURCE_BBOX = "-5.75,49.86,1.87,55.81"
RAW_PATH = TMP_DIR / "england-overture-localities.geojson"
OUTPUT_PATH = ASSET_DIR / "england-localities.json"


def run_download() -> None:
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    # Use Overture Maps CLI to download division_area features for England
    command = [
        "uvx",
        "--from",
        "overturemaps",
        "overturemaps",
        "download",
        f"--bbox={SOURCE_BBOX}",
        "-f",
        "geojson",
        "--type=division_area",
        "-o",
        str(RAW_PATH),
    ]
    subprocess.run(command, check=True, cwd=ROOT)


def normalize_feature(feature: dict) -> dict | None:
    """
    Normalize an Overture division_area feature to our boundary schema.
    Filters to England locality/district boundaries useful for instructors.
    """
    props = feature.get("properties", {})
    subtype = props.get("subtype")
    if subtype not in (
        "locality",
        "county",
        "metropolitan_area",
        "district",
        "borough",
        "localadmin",
    ):
        return None

    # Extract name from names object or fallback to name property
    names = props.get("names") or {}
    if isinstance(names, dict):
        name = (names.get("primary") or props.get("name") or "").strip()
    else:
        name = str(props.get("name") or "").strip()

    if not name:
        return None

    country = str(props.get("country") or "GB")
    if country != "GB":
        return None

    return {
        "type": "Feature",
        "properties": {
            "id": f"england-locality:{props.get('id', '')}",
            "name": name,
            "countryCode": "GB",
            "subtype": subtype,
            "source": "overture-divisions",
            "overtureId": str(props.get("id") or ""),
            # Parent hierarchy for drill-down
            "parentId": props.get("parentId"),
        },
        "geometry": feature.get("geometry"),
    }


def main() -> int:
    run_download()

    with RAW_PATH.open() as handle:
        data = json.load(handle)

    normalized = []
    for feature in data.get("features", []):
        candidate = normalize_feature(feature)
        if candidate:
            normalized.append(candidate)

    normalized.sort(key=lambda f: f["properties"]["name"])
    ASSET_DIR.mkdir(parents=True, exist_ok=True)

    output = {"type": "FeatureCollection", "features": normalized}
    with OUTPUT_PATH.open("w") as handle:
        json.dump(output, handle)

    print(f"Wrote {len(normalized)} England locality features to {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
