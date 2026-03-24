import { describe, expect, it } from "bun:test";
import { ConvexError } from "convex/values";

import { assertRoleCanCompleteOnboarding } from "./onboarding";

function makeUser(role: "pending" | "instructor" | "studio", onboardingComplete: boolean) {
  return {
    role,
    onboardingComplete,
  } as any;
}

describe("assertRoleCanCompleteOnboarding", () => {
  it("allows onboarding for a pending account", () => {
    expect(() =>
      assertRoleCanCompleteOnboarding(makeUser("pending", false), "instructor"),
    ).not.toThrow();
    expect(() =>
      assertRoleCanCompleteOnboarding(makeUser("pending", false), "studio"),
    ).not.toThrow();
  });

  it("allows onboarding when the active role matches the target role", () => {
    expect(() =>
      assertRoleCanCompleteOnboarding(makeUser("instructor", true), "instructor"),
    ).not.toThrow();
    expect(() =>
      assertRoleCanCompleteOnboarding(makeUser("studio", true), "studio"),
    ).not.toThrow();
  });

  it("blocks attaching a second role to an already onboarded account", () => {
    expect(() =>
      assertRoleCanCompleteOnboarding(makeUser("instructor", true), "studio"),
    ).toThrow(ConvexError);
    expect(() =>
      assertRoleCanCompleteOnboarding(makeUser("studio", true), "instructor"),
    ).toThrow(ConvexError);
  });
});
