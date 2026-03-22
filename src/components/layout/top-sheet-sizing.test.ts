import { describe, expect, it } from "bun:test";

import {
  computeAvailableHeight,
  computeIntrinsicMinHeight,
  computeStepHeights,
  resolveOverflowMode,
} from "./top-sheet-sizing";

describe("top-sheet helpers", () => {
  describe("computeStepHeights", () => {
    it("returns empty array for empty steps", () => {
      const result = computeStepHeights([], 800);
      expect(result).toEqual([]);
    });

    it("maps single step fraction to correct pixel value", () => {
      const result = computeStepHeights([0.5], 800);
      expect(result).toEqual([400]);
    });

    it("maps multiple fractional steps to pixel heights", () => {
      const result = computeStepHeights([0.16, 0.4, 0.65, 0.95], 800);
      expect(result).toEqual([128, 320, 520, 760]);
    });

    it("rounds fractional pixel values", () => {
      const result = computeStepHeights([0.333], 1000);
      expect(result).toEqual([333]);
    });

    it("handles zero available height", () => {
      const result = computeStepHeights([0.5, 0.9], 0);
      expect(result).toEqual([0, 0]);
    });

    it("handles step fraction of 0", () => {
      const result = computeStepHeights([0], 800);
      expect(result).toEqual([0]);
    });

    it("handles step fraction of 1", () => {
      const result = computeStepHeights([1], 800);
      expect(result).toEqual([800]);
    });
  });

  describe("computeAvailableHeight", () => {
    it("subtracts safe top and explicit bottom chrome from screen height", () => {
      const result = computeAvailableHeight(800, 50, 100, 150);
      expect(result).toBe(600);
    });

    it("uses default bottom chrome when safeBottom+64 exceeds MIN_BOTTOM_CHROME_ESTIMATE", () => {
      const result = computeAvailableHeight(800, 50, 30);
      expect(result).toBe(656);
    });

    it("uses provided bottom chrome estimate when explicit", () => {
      const result = computeAvailableHeight(800, 50, 100, 200);
      expect(result).toBe(550);
    });

    it("handles zero safe top with explicit bottom chrome", () => {
      const result = computeAvailableHeight(800, 0, 100, 150);
      expect(result).toBe(650);
    });

    it("handles zero safe bottom using default chrome", () => {
      const result = computeAvailableHeight(800, 50, 0);
      expect(result).toBe(670);
    });

    it("handles zero safe areas using default bottom chrome minimum", () => {
      const result = computeAvailableHeight(800, 0, 0);
      expect(result).toBe(720);
    });

    it("handles large explicit bottom chrome", () => {
      const result = computeAvailableHeight(800, 100, 150, 200);
      expect(result).toBe(500);
    });
  });

  describe("computeIntrinsicMinHeight", () => {
    it("returns zero when all inputs are zero", () => {
      const result = computeIntrinsicMinHeight(0, 0, 0);
      expect(result).toBe(0);
    });

    it("sums sticky header, footer, and content heights", () => {
      const result = computeIntrinsicMinHeight(100, 50, 200);
      expect(result).toBe(350);
    });

    it("handles zero header height", () => {
      const result = computeIntrinsicMinHeight(0, 50, 200);
      expect(result).toBe(250);
    });

    it("handles zero footer height", () => {
      const result = computeIntrinsicMinHeight(100, 0, 200);
      expect(result).toBe(300);
    });

    it("handles zero content minimum height", () => {
      const result = computeIntrinsicMinHeight(100, 50, 0);
      expect(result).toBe(150);
    });

    it("handles single step (no sticky elements)", () => {
      const result = computeIntrinsicMinHeight(0, 0, 300);
      expect(result).toBe(300);
    });
  });

  describe("resolveOverflowMode", () => {
    it("returns fit for content-min mode regardless of height", () => {
      expect(resolveOverflowMode("content-min", 1000, 500)).toBe("fit");
      expect(resolveOverflowMode("content-min", 0, 500)).toBe("fit");
    });

    it("returns fit when measured equals max in content-min-overflow mode", () => {
      const result = resolveOverflowMode("content-min-overflow", 500, 500);
      expect(result).toBe("fit");
    });

    it("returns fit when measured is less than max in content-min-overflow mode", () => {
      const result = resolveOverflowMode("content-min-overflow", 300, 500);
      expect(result).toBe("fit");
    });

    it("returns overflow when measured exceeds max in content-min-overflow mode", () => {
      const result = resolveOverflowMode("content-min-overflow", 600, 500);
      expect(result).toBe("overflow");
    });

    it("returns overflow when measured is just barely over max", () => {
      const result = resolveOverflowMode("content-min-overflow", 501, 500);
      expect(result).toBe("overflow");
    });

    it("handles zero max height (always overflows)", () => {
      const result = resolveOverflowMode("content-min-overflow", 1, 0);
      expect(result).toBe("overflow");
    });

    it("handles zero measured height", () => {
      const result = resolveOverflowMode("content-min-overflow", 0, 500);
      expect(result).toBe("fit");
    });

    it("handles both heights at zero boundary", () => {
      const result = resolveOverflowMode("content-min-overflow", 0, 0);
      expect(result).toBe("fit");
    });
  });
});
