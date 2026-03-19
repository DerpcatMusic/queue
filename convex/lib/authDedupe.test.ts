import { describe, expect, it } from "bun:test";

import type { Id } from "../_generated/dataModel";
import {
  canProceedWithEmailDedupe,
  dedupeUsersByEmail,
  resolveCanonicalUserByEmail,
} from "./authDedupe";

describe("canProceedWithEmailDedupe", () => {
  it("allows dedupe when verification is not required", () => {
    expect(
      canProceedWithEmailDedupe({
        requireVerifiedUser: false,
        users: [{}, {}],
      }),
    ).toBe(true);
  });

  it("allows dedupe when the current sign-in already proved email ownership", () => {
    expect(
      canProceedWithEmailDedupe({
        requireVerifiedUser: true,
        emailOwnershipVerified: true,
        users: [{}, {}],
      }),
    ).toBe(true);
  });

  it("allows dedupe when an existing duplicate already has a verified email", () => {
    expect(
      canProceedWithEmailDedupe({
        requireVerifiedUser: true,
        users: [{}, { emailVerificationTime: Date.now() }],
      }),
    ).toBe(true);
  });

  it("blocks dedupe when verification is required but no email ownership is verified", () => {
    expect(
      canProceedWithEmailDedupe({
        requireVerifiedUser: true,
        users: [{}, {}],
      }),
    ).toBe(false);
  });
});

describe("dedupeUsersByEmail", () => {
  it("dedupes verified sign-ins even when neither duplicate had previously verified the email", async () => {
    const canonicalUserId = "users:canonical" as Id<"users">;
    const duplicateUserId = "users:duplicate" as Id<"users">;
    const canonicalUser = {
      _id: canonicalUserId,
      _creationTime: 1,
      role: "studio" as const,
      onboardingComplete: true,
      email: "djderpcat@gmail.com",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    };
    const duplicateUser = {
      _id: duplicateUserId,
      _creationTime: 2,
      role: "pending" as const,
      onboardingComplete: false,
      email: "djderpcat@gmail.com",
      isActive: true,
      createdAt: 2,
      updatedAt: 2,
    };
    const ctx = {
      db: {
        query(table: string) {
          const collect = async () => {
            if (table === "users") {
              return [canonicalUser, duplicateUser];
            }
            return [];
          };
          return {
            withIndex() {
              return { collect };
            },
            collect,
          };
        },
        patch: async () => undefined,
        delete: async () => undefined,
      },
    } as any;

    await expect(
      dedupeUsersByEmail({
        ctx,
        normalizedEmail: "djderpcat@gmail.com",
        requireVerifiedUser: true,
        emailOwnershipVerified: true,
      }),
    ).resolves.toBe(canonicalUserId);
  });
});

describe("resolveCanonicalUserByEmail", () => {
  it("selects a canonical account when duplicates cannot be merged", async () => {
    const canonicalUserId = "users:canonical" as Id<"users">;
    const duplicateUserId = "users:duplicate" as Id<"users">;
    const canonicalUser = {
      _id: canonicalUserId,
      _creationTime: 1,
      role: "studio" as const,
      onboardingComplete: true,
      email: "djderpcat@gmail.com",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    };
    const duplicateUser = {
      _id: duplicateUserId,
      _creationTime: 2,
      role: "instructor" as const,
      onboardingComplete: false,
      email: "djderpcat@gmail.com",
      isActive: true,
      createdAt: 2,
      updatedAt: 2,
    };
    const ctx = {
      db: {
        query(table: string) {
          const collect = async () => {
            if (table === "users") {
              return [canonicalUser, duplicateUser];
            }
            return [];
          };
          return {
            withIndex() {
              return { collect };
            },
            collect,
          };
        },
      },
    } as any;

    await expect(
      resolveCanonicalUserByEmail({
        ctx,
        normalizedEmail: "djderpcat@gmail.com",
      }),
    ).resolves.toBe(canonicalUserId);
  });
});
