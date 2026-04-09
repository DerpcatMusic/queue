#!/bin/bash
set -e

# EU country codes
EU_COUNTRIES="GB FR DE ES IT NL PT BE AT CH IE SE DK NO FI PL CZ GR HU RO BG HR SK SI LT LV EE LU MT CY"

# Usage
usage() {
    echo "Usage: $0 <country-code|all>"
    echo "  Country codes: $EU_COUNTRIES"
    exit 1
}

# Check arguments
if [ $# -eq 0 ]; then
    usage
fi

INPUT="$1"
INPUT_DIR="assets/data/europe"
OUTPUT_DIR="$INPUT_DIR/pmtiles"

# Check if tippecanoe is installed
if ! command -v tippecanoe &> /dev/null; then
    echo "Warning: tippecanoe is not installed. Skipping PMTiles generation."
    echo "Install with: brew install tippecanoe (macOS) or apt install tippecanoe (Linux)"
    exit 0
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Get list of countries to process
if [ "$INPUT" = "all" ]; then
    COUNTRIES="$EU_COUNTRIES"
else
    COUNTRIES="$INPUT"
fi

# Process each country
for COUNTRY in $COUNTRIES; do
    INPUT_FILE="$INPUT_DIR/${COUNTRY,,}-boundaries.geojson"
    OUTPUT_FILE="$OUTPUT_DIR/${COUNTRY,,}-boundaries.pmtiles"

    if [ ! -f "$INPUT_FILE" ]; then
        echo "Warning: $INPUT_FILE not found, skipping $COUNTRY"
        continue
    fi

    echo "Building PMTiles for $COUNTRY..."

    tippecanoe \
        --layer=boundaries \
        --output="$OUTPUT_FILE" \
        --minimum-zoom=6 \
        --maximum-zoom=14 \
        --simplification=10 \
        --drop-fraction-as-needed \
        --extend-zooms-if-still-dropping \
        "$INPUT_FILE"

    if [ -f "$OUTPUT_FILE" ]; then
        FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
        echo "  ✓ $OUTPUT_FILE ($FILE_SIZE)"
    else
        echo "  ✗ Failed to create PMTiles for $COUNTRY"
    fi
done

echo "Done!"
