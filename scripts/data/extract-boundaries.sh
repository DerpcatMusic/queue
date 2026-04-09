#!/bin/bash
set -e

# EU country codes
EU_COUNTRIES="GB FR DE ES IT NL PT BE AT CH IE SE DK NO FI PL CZ GR HU RO BG HR SK SI LT LV EE LU MT CY"

# Country code to name mapping
get_country_name() {
    case "$1" in
        GB) echo "United Kingdom" ;;
        FR) echo "France" ;;
        DE) echo "Germany" ;;
        ES) echo "Spain" ;;
        IT) echo "Italy" ;;
        NL) echo "Netherlands" ;;
        PT) echo "Portugal" ;;
        BE) echo "Belgium" ;;
        AT) echo "Austria" ;;
        CH) echo "Switzerland" ;;
        IE) echo "Ireland" ;;
        SE) echo "Sweden" ;;
        DK) echo "Denmark" ;;
        NO) echo "Norway" ;;
        FI) echo "Finland" ;;
        PL) echo "Poland" ;;
        CZ) echo "Czech Republic" ;;
        GR) echo "Greece" ;;
        HU) echo "Hungary" ;;
        RO) echo "Romania" ;;
        BG) echo "Bulgaria" ;;
        HR) echo "Croatia" ;;
        SK) echo "Slovakia" ;;
        SI) echo "Slovenia" ;;
        LT) echo "Lithuania" ;;
        LV) echo "Latvia" ;;
        EE) echo "Estonia" ;;
        LU) echo "Luxembourg" ;;
        MT) echo "Malta" ;;
        CY) echo "Cyprus" ;;
        *) echo "$1" ;;
    esac
}

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
OUTPUT_DIR="assets/data/europe"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Get list of countries to process
if [ "$INPUT" = "all" ]; then
    COUNTRIES="$EU_COUNTRIES"
else
    COUNTRIES="$INPUT"
fi

# DuckDB query template
run_duckdb_query() {
    local country_code="$1"
    local output_file="$OUTPUT_DIR/${country_code,,}-boundaries.geojson"

    echo "Extracting boundaries for $country_code ($(get_country_name $country_code))..."

    duckdb -c "
        LOAD spatial;
        LOAD httpfs;

        COPY (
            SELECT
                CONCAT('$country_code', '-locality:', id) AS id,
                name,
                '$country_code' AS countryCode,
                subtype,
                'overture-divisions' AS source,
                geometry
            FROM read_parquet('s3://overturemaps-us-west-2/release/2026-03-18.0/theme=divisions/type=division_area/*')
            WHERE
                country_iso_alpha2 = '$country_code'
                AND subtype IN ('locality', 'borough', 'localadmin')
        )
        TO '$output_file'
        (FORMAT GDEL, MENCODE_GEOJSON);
    "

    if [ -f "$output_file" ]; then
        FEATURE_COUNT=$(python3 -c "import json; f=open('$output_file'); g=json.load(f); print(len(g.get('features', [])))" 2>/dev/null || echo "0")
        FILE_SIZE=$(du -h "$output_file" | cut -f1)
        echo "  ✓ $FEATURE_COUNT features, $FILE_SIZE"
    else
        echo "  ✗ Failed to create file"
    fi
}

# Process each country
for COUNTRY in $COUNTRIES; do
    run_duckdb_query "$COUNTRY"
done

echo "Done!"
