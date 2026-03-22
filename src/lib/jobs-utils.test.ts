import { describe, expect, it } from "bun:test";

import {
  APPLICATION_STATUS_TRANSLATION_KEYS,
  clamp,
  formatBoostBadge,
  formatDateTime,
  formatDateWithWeekday,
  formatExpiryText,
  formatRelativeDuration,
  formatTime,
  getApplicationStatusTranslationKey,
  getJobStatusTone,
  getJobStatusToneWithReason,
  getJobStatusTranslationKey,
  getLessonProgress,
  JOB_STATUS_TRANSLATION_KEYS,
  sanitizeDecimalInput,
  trimOptional,
} from "./jobs-utils";

describe("jobs-utils", () => {
  it("sanitizes decimal input", () => {
    expect(sanitizeDecimalInput("12a.3.4")).toBe("12.34");
    expect(sanitizeDecimalInput("abc")).toBe("");
    expect(sanitizeDecimalInput(".1.2")).toBe(".12");
    expect(sanitizeDecimalInput("12..3")).toBe("12.3");
  });

  it("trims optional values", () => {
    expect(trimOptional("  hello  ")).toBe("hello");
    expect(trimOptional("   ")).toBeUndefined();
  });

  it("formats relative durations", () => {
    expect(formatRelativeDuration(-1)).toBe("1m");
    expect(formatRelativeDuration(0)).toBe("1m");
    expect(formatRelativeDuration(30 * 60 * 1000)).toBe("30m");
    expect(formatRelativeDuration(60 * 60 * 1000)).toBe("1h");
    expect(formatRelativeDuration(90 * 60 * 1000)).toBe("1h 30m");
  });

  it("clamps values and computes lesson progress", () => {
    expect(clamp(5, 1, 4)).toBe(4);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(getLessonProgress(150, 100, 200)).toBe(0.5);
    expect(getLessonProgress(50, 100, 200)).toBe(0);
    expect(getLessonProgress(300, 100, 200)).toBe(1);
    expect(getLessonProgress(100, 100, 100)).toBe(0);
    expect(getLessonProgress(100, 200, 100)).toBe(0);
  });

  it("falls back to pending translation key for unknown status", () => {
    expect(getApplicationStatusTranslationKey("accepted")).toBe(
      "jobsTab.status.application.accepted",
    );
    expect(getApplicationStatusTranslationKey("withdrawn")).toBe(
      "jobsTab.status.application.withdrawn",
    );
    expect(getApplicationStatusTranslationKey("bogus")).toBe("jobsTab.status.application.pending");
  });

  it("exports stable status mapping keys and tones", () => {
    expect(JOB_STATUS_TRANSLATION_KEYS.open).toBe("jobsTab.status.job.open");
    expect(JOB_STATUS_TRANSLATION_KEYS.filled).toBe("jobsTab.status.job.filled");
    expect(JOB_STATUS_TRANSLATION_KEYS.completed).toBe("jobsTab.status.job.completed");
    expect(JOB_STATUS_TRANSLATION_KEYS.cancelled).toBe("jobsTab.status.job.cancelled");

    expect(APPLICATION_STATUS_TRANSLATION_KEYS.pending).toBe("jobsTab.status.application.pending");
    expect(APPLICATION_STATUS_TRANSLATION_KEYS.accepted).toBe(
      "jobsTab.status.application.accepted",
    );
    expect(APPLICATION_STATUS_TRANSLATION_KEYS.rejected).toBe(
      "jobsTab.status.application.rejected",
    );
    expect(APPLICATION_STATUS_TRANSLATION_KEYS.withdrawn).toBe(
      "jobsTab.status.application.withdrawn",
    );

    expect(getJobStatusTone("open")).toBe("primary");
    expect(getJobStatusTone("filled")).toBe("success");
    expect(getJobStatusTone("completed")).toBe("success");
    expect(getJobStatusTone("cancelled")).toBe("muted");
    expect(getJobStatusToneWithReason("cancelled", "expired")).toBe("gray");
    expect(getJobStatusToneWithReason("cancelled", "studio_cancelled")).toBe("amber");
    expect(getJobStatusTranslationKey("cancelled", "expired")).toBe("jobsTab.status.job.expired");
  });

  it("formats expiry text for upcoming and expired jobs", () => {
    const now = Date.UTC(2026, 2, 22, 10, 0, 0);

    const result1 = formatExpiryText(now + 15 * 60 * 1000, now);
    expect(result1.key).toBe("jobsTab.form.expiresInMinutes");
    expect(result1.interpolation).toEqual({ count: 15 });
    expect(result1.formatted).toBe("Expires in 15 minutes");

    const result2 = formatExpiryText(now - 1, now);
    expect(result2.key).toBe("jobsTab.form.expiryExpired");
    expect(result2.interpolation).toEqual({});
    expect(result2.formatted).toBe("Expired");
  });

  it("formats boost badges only when boost is active", () => {
    const result1 = formatBoostBadge("medium", 50, true);
    expect(result1?.key).toBe("jobsTab.form.boostBadge");
    expect(result1?.bonus).toBe(50);
    expect(result1?.formatted).toBe("+₪50 boost");

    const result2 = formatBoostBadge("small", 20, true);
    expect(result2?.key).toBe("jobsTab.form.boostBadge");
    expect(result2?.bonus).toBe(20);
    expect(result2?.formatted).toBe("+₪20 boost");

    expect(formatBoostBadge(undefined, undefined, false)).toBeUndefined();
  });

  it("formats date/time values with explicit timezone", () => {
    const instant = Date.UTC(2024, 0, 15, 13, 5, 0);
    expect(formatTime(instant, "en-GB", "UTC")).toContain("13:05");
    expect(formatDateWithWeekday(instant, "en-US", "UTC")).toContain("Jan");
    expect(formatDateTime(instant, "en-US", "UTC")).toContain("Jan");
  });
});
