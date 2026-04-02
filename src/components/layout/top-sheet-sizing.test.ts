import { describe, expect, it } from "bun:test";

import {
  computeAvailableHeight,
  computeCollapsedHeight,
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

    it("clamps step heights up to a minimum height floor", () => {
      const result = computeStepHeights([0.1, 0.5], 800, 120);
      expect(result).toEqual([120, 400]);
    });

    it("clamps all steps below the minimum height floor", () => {
      const result = computeStepHeights([0.05, 0.1, 0.2], 800, 100);
      expect(result).toEqual([100, 100, 160]);
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
    it("returns the measured scene viewport height", () => {
      const result = computeAvailableHeight(800);
      expect(result).toBe(800);
    });

    it("clamps negative heights to zero", () => {
      const result = computeAvailableHeight(-20);
      expect(result).toBe(0);
    });

    it("handles zero scene height", () => {
      const result = computeAvailableHeight(0);
      expect(result).toBe(0);
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

  describe("computeCollapsedHeight", () => {
    it("returns intrinsic height when above the minimum floor", () => {
      const result = computeCollapsedHeight(280, 150, 500);
      expect(result).toBe(280);
    });

    it("returns the minimum floor when intrinsic height is smaller", () => {
      const result = computeCollapsedHeight(80, 150, 500);
      expect(result).toBe(150);
    });

    it("caps collapsed height to the maximum height", () => {
      const result = computeCollapsedHeight(600, 150, 500);
      expect(result).toBe(500);
    });

    it("treats negative values as zero before applying floors", () => {
      const result = computeCollapsedHeight(-20, 100, 500);
      expect(result).toBe(100);
    });

    it("rounds intrinsic values upward", () => {
      const result = computeCollapsedHeight(99.2, 0, 500);
      expect(result).toBe(100);
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
