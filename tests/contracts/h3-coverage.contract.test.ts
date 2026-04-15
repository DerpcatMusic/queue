import { describe, expect, it } from "bun:test";
import { cellToParent } from "h3-js";

import {
  getCompactedCoverageCells,
  getCoveragePreviewPolygons,
  getCoverageResolution,
  getExactCoverageCells,
  getWatchZoneCells,
  H3_JOB_MATCH_MIN_RESOLUTION,
  H3_RESOLUTION,
} from "../../convex/lib/h3";

const TEST_CENTER = {
  latitude: 31.973001,
  longitude: 34.792501,
};

describe("h3 coverage contracts", () => {
  it("chooses a finer resolution for small radii and coarser ones for larger radii", () => {
    expect(getCoverageResolution(0.5)).toBe(9);
    expect(getCoverageResolution(2)).toBe(9);
    expect(getCoverageResolution(8)).toBe(7);
    expect(getCoverageResolution(18)).toBe(6);
    expect(getCoverageResolution(40)).toBe(5);
  });

  it("compacted coverage has no logical gaps versus the dense res9 watch ring", () => {
    const radiusKm = 40;
    const denseCells = getWatchZoneCells(
      TEST_CENTER.latitude,
      TEST_CENTER.longitude,
      radiusKm,
      9,
    );
    const compactedCoverage = getCompactedCoverageCells(
      TEST_CENTER.latitude,
      TEST_CENTER.longitude,
      radiusKm,
    );

    expect(compactedCoverage.length).toBeLessThan(denseCells.length);

    const compactedByResolution = new Map<number, Set<string>>();
    for (const coverage of compactedCoverage) {
      const cellsAtResolution = compactedByResolution.get(coverage.resolution) ?? new Set<string>();
      cellsAtResolution.add(coverage.cell);
      compactedByResolution.set(coverage.resolution, cellsAtResolution);
    }

    for (const denseCell of denseCells) {
      let matched = false;
      for (let resolution = H3_RESOLUTION; resolution >= H3_JOB_MATCH_MIN_RESOLUTION; resolution -= 1) {
        const candidate =
          resolution === H3_RESOLUTION ? denseCell : cellToParent(denseCell, resolution);
        if (compactedByResolution.get(resolution)?.has(candidate)) {
          matched = true;
          break;
        }
      }
      expect(matched).toBe(true);
    }
  });

  it("preview polygons stay aligned with the exact preview cells", () => {
    const radiusKm = 15;
    const exactCoverage = getExactCoverageCells(
      TEST_CENTER.latitude,
      TEST_CENTER.longitude,
      radiusKm,
    );
    const previewPolygons = getCoveragePreviewPolygons(
      TEST_CENTER.latitude,
      TEST_CENTER.longitude,
      radiusKm,
    );

    expect(previewPolygons).toHaveLength(exactCoverage.length);
    expect(previewPolygons.map((polygon) => polygon.cell)).toEqual(
      exactCoverage.map((coverage) => coverage.cell),
    );
    expect(previewPolygons.map((polygon) => polygon.resolution)).toEqual(
      exactCoverage.map((coverage) => coverage.resolution),
    );
  });
});
