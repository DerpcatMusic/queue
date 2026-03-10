import { describe, expect, it } from "bun:test";

import {
  decryptCalendarToken,
  encryptCalendarToken,
  isEncryptedCalendarToken,
} from "../../convex/lib/calendarCrypto";

describe("calendar token hardening contracts", () => {
  it("keeps plaintext tokens readable when no encryption secret is configured", () => {
    const original = process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET;
    try {
      delete process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET;

      expect(encryptCalendarToken("plain-token")).toBe("plain-token");
      expect(decryptCalendarToken("plain-token")).toBe("plain-token");
      expect(isEncryptedCalendarToken("plain-token")).toBe(false);
    } finally {
      process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET = original;
    }
  });

  it("round-trips encrypted tokens when the secret is configured", () => {
    const original = process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET;
    try {
      process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET = "calendar-secret";

      const encrypted = encryptCalendarToken("refresh-token-123");
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe("refresh-token-123");
      expect(isEncryptedCalendarToken(encrypted)).toBe(true);
      expect(decryptCalendarToken(encrypted)).toBe("refresh-token-123");
    } finally {
      process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET = original;
    }
  });

  it("still returns plaintext values unchanged even when encryption is enabled", () => {
    const original = process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET;
    try {
      process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET = "calendar-secret";
      expect(decryptCalendarToken("legacy-plain-token")).toBe("legacy-plain-token");
    } finally {
      process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET = original;
    }
  });

  it("fails explicitly when encrypted tokens exist but the env secret is missing", () => {
    const original = process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET;
    try {
      process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET = "calendar-secret";
      const encrypted = encryptCalendarToken("access-token-123");

      delete process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET;
      expect(() => decryptCalendarToken(encrypted)).toThrow(
        "Calendar token encryption secret is required",
      );
    } finally {
      process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET = original;
    }
  });
});
