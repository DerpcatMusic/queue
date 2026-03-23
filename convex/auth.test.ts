import { describe, expect, it } from "bun:test";
import { ConvexError } from "convex/values";

import { resolveLinkedUserId, resolveProfileEmailVerified } from "./auth";

describe("resolveLinkedUserId", () => {
  it("keeps the existing linked user when duplicate email matches include it", () => {
    const existingUserId = "users:existing" as any;
    const otherUserId = "users:duplicate" as any;

    expect(
      resolveLinkedUserId({
        existingUserId,
        matchedUserIdsByEmail: [existingUserId, otherUserId],
        email: "djderpcat@gmail.com",
      }),
    ).toBe(existingUserId);
  });

  it("throws when duplicate email matches exist without a linked account", () => {
    expect(() =>
      resolveLinkedUserId({
        existingUserId: undefined,
        matchedUserIdsByEmail: ["users:a" as any, "users:b" as any],
        email: "djderpcat@gmail.com",
      }),
    ).toThrow(new ConvexError("Ambiguous account resolution for this email"));
  });

  it("throws when a single email match belongs to a different linked account", () => {
    expect(() =>
      resolveLinkedUserId({
        existingUserId: "users:existing" as any,
        matchedUserIdsByEmail: ["users:other" as any],
        email: "djderpcat@gmail.com",
      }),
    ).toThrow(new ConvexError("Email is already linked to a different account"));
  });
});

describe("resolveProfileEmailVerified", () => {
  it("trusts explicit camelCase emailVerified from the provider profile", () => {
    expect(
      resolveProfileEmailVerified({
        profile: { emailVerified: true },
        provider: { type: "oidc" },
      }),
    ).toBe(true);
  });

  it("trusts raw snake_case email_verified from Google-style OIDC profiles", () => {
    expect(
      resolveProfileEmailVerified({
        profile: { email_verified: true },
        provider: { type: "oidc" },
      }),
    ).toBe(true);
  });

  it("falls back to trusted OAuth/OIDC linking when the provider omits email verification", () => {
    expect(
      resolveProfileEmailVerified({
        profile: { email: "djderpcat@gmail.com" },
        provider: { type: "oidc" },
      }),
    ).toBe(true);
  });

  it("does not trust OAuth/OIDC linking when dangerous email linking is disabled", () => {
    expect(
      resolveProfileEmailVerified({
        profile: { email: "djderpcat@gmail.com" },
        provider: { type: "oidc", allowDangerousEmailAccountLinking: false },
      }),
    ).toBe(false);
  });
});
