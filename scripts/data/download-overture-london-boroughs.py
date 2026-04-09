#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TMP_DIR = ROOT / "tmp"
ASSET_DIR = ROOT / "assets" / "data" / "europe"
SOURCE_BBOX = "-0.5103,51.2868,0.3340,51.6923"
RAW_PATH = TMP_DIR / "london-overture-division-area.geojson"
OUTPUT_PATH = ASSET_DIR / "london-overture-boroughs.json"
REFERENCE_PATH = ASSET_DIR / "london-boroughs.json"


def load_reference_names() -> set[str]:
    with REFERENCE_PATH.open() as handle:
        data = json.load(handle)

    names: set[str] = set()
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        name = str(props.get("name", "")).strip()
        if name:
          names.add(name)
    return names


def run_download() -> None:
    TMP_DIR.mkdir(parents=True, exist_ok=True)
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
    props = feature.get("properties", {})
    subtype = props.get("subtype")
    if subtype != "county":
        return None

    name = ((props.get("names") or {}).get("primary") if isinstance(props.get("names"), dict) else None) or props.get("name")
    name = str(name or "").strip()
    if not name:
        return None

    return {
        "type": "Feature",
        "properties": {
            "id": f"london-borough:{props.get('id')}",
            "name": name,
            "countryCode": str(props.get("country") or "GB"),
            "city": "London",
            "source": "overture-divisions",
            "overtureId": str(props.get("id") or ""),
            "subtype": "borough",
        },
        "geometry": feature.get("geometry"),
    }


def main() -> int:
    if not REFERENCE_PATH.exists():
        print(f"Missing reference file: {REFERENCE_PATH}", file=sys.stderr)
        return 1

    run_download()

    reference_names = load_reference_names()
    with RAW_PATH.open() as handle:
        data = json.load(handle)

    normalized = []
    for feature in data.get("features", []):
        candidate = normalize_feature(feature)
        if not candidate:
            continue
        if candidate["properties"]["name"] not in reference_names:
            continue
        normalized.append(candidate)

    normalized.sort(key=lambda feature: feature["properties"]["name"])
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w") as handle:
        json.dump({"type": "FeatureCollection", "features": normalized}, handle)

    print(f"Wrote {len(normalized)} borough features to {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
