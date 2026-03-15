import { describe, expect, it } from "bun:test";
import { ConvexError } from "convex/values";

import { resolveLinkedUserId } from "./auth";

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
