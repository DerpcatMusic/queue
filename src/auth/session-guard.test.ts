import { describe, expect, it } from "bun:test";

import { resolveSessionState } from "./session-guard";

describe("resolveSessionState", () => {
  it("returns loading when auth is loading", () => {
    expect(
      resolveSessionState({
        isAuthLoading: true,
        isAuthenticated: false,
        currentUser: undefined,
      }),
    ).toEqual({ status: "loading" });
  });

  it("returns signed_out for unauthenticated users", () => {
    expect(
      resolveSessionState({
        isAuthLoading: false,
        isAuthenticated: false,
        currentUser: null,
      }),
    ).toEqual({ status: "signed_out" });
  });

  it("returns loading when authenticated but current user is null", () => {
    expect(
      resolveSessionState({
        isAuthLoading: false,
        isAuthenticated: true,
        currentUser: null,
      }),
    ).toEqual({ status: "loading" });
  });

  it("returns onboarding for pending role", () => {
    expect(
      resolveSessionState({
        isAuthLoading: false,
        isAuthenticated: true,
        currentUser: { role: "pending", onboardingComplete: false },
      }),
    ).toEqual({ status: "onboarding" });
  });

  it("returns onboarding when role exists but onboarding is incomplete", () => {
    expect(
      resolveSessionState({
        isAuthLoading: false,
        isAuthenticated: true,
        currentUser: { role: "instructor", onboardingComplete: false },
      }),
    ).toEqual({ status: "onboarding" });
  });

  it("returns ready with role when user is fully onboarded", () => {
    expect(
      resolveSessionState({
        isAuthLoading: false,
        isAuthenticated: true,
        currentUser: { role: "studio", onboardingComplete: true },
      }),
    ).toEqual({ status: "ready", role: "studio" });
  });
});
