import { describe, expect, it } from "bun:test";
import { resolveSessionGateDecision } from "@/modules/session/session-gate";
import { resolveSessionState } from "./session-guard";

describe("resolveSessionState edge cases", () => {
  it("treats undefined currentUser as loading even when auth loading flag is false", () => {
    expect(
      resolveSessionState({
        isAuthLoading: false,
        isAuthenticated: true,
        currentUser: undefined,
      }),
    ).toEqual({ status: "loading" });
  });

  it("prioritizes loading when both auth is loading and an unauthenticated shape is present", () => {
    expect(
      resolveSessionState({
        isAuthLoading: true,
        isAuthenticated: false,
        currentUser: null,
      }),
    ).toEqual({ status: "loading" });
  });

  it("returns signed_out when authentication flag is false even if a user object is present", () => {
    expect(
      resolveSessionState({
        isAuthLoading: false,
        isAuthenticated: false,
        currentUser: { role: "instructor", onboardingComplete: true },
      }),
    ).toEqual({ status: "signed_out" });
  });

  it("returns loading when currentUser is null while authenticated is true", () => {
    expect(
      resolveSessionState({
        isAuthLoading: false,
        isAuthenticated: true,
        currentUser: null,
      }),
    ).toEqual({ status: "loading" });
  });

  it("routes unsupported and missing roles to onboarding", () => {
    const samples = [
      { role: "pending" as const, onboardingComplete: true },
      { role: "admin" as const, onboardingComplete: true },
      { role: null, onboardingComplete: true },
      { onboardingComplete: true },
    ];

    for (const currentUser of samples) {
      expect(
        resolveSessionState({
          isAuthLoading: false,
          isAuthenticated: true,
          currentUser,
        }),
      ).toEqual({ status: "onboarding" });
    }
  });

  it("keeps valid roles in onboarding when onboardingComplete is falsy", () => {
    const samples = [
      { role: "instructor" as const, onboardingComplete: false },
      { role: "studio" as const, onboardingComplete: null },
      { role: "instructor" as const },
    ];

    for (const currentUser of samples) {
      expect(
        resolveSessionState({
          isAuthLoading: false,
          isAuthenticated: true,
          currentUser,
        }),
      ).toEqual({ status: "onboarding" });
    }
  });

  it("returns ready only for instructor/studio users with onboardingComplete true", () => {
    expect(
      resolveSessionState({
        isAuthLoading: false,
        isAuthenticated: true,
        currentUser: { role: "instructor", onboardingComplete: true },
      }),
    ).toEqual({ status: "ready", role: "instructor" });

    expect(
      resolveSessionState({
        isAuthLoading: false,
        isAuthenticated: true,
        currentUser: { role: "studio", onboardingComplete: true },
      }),
    ).toEqual({ status: "ready", role: "studio" });
  });
});

describe("resolveSessionState auth transition flow", () => {
  it("progresses from loading to signed_out to onboarding to ready", () => {
    const states = [
      resolveSessionState({
        isAuthLoading: true,
        isAuthenticated: false,
        currentUser: undefined,
      }),
      resolveSessionState({
        isAuthLoading: false,
        isAuthenticated: false,
        currentUser: null,
      }),
      resolveSessionState({
        isAuthLoading: false,
        isAuthenticated: true,
        currentUser: null,
      }),
      resolveSessionState({
        isAuthLoading: false,
        isAuthenticated: true,
        currentUser: { role: "pending", onboardingComplete: false },
      }),
      resolveSessionState({
        isAuthLoading: false,
        isAuthenticated: true,
        currentUser: { role: "studio", onboardingComplete: false },
      }),
      resolveSessionState({
        isAuthLoading: false,
        isAuthenticated: true,
        currentUser: { role: "studio", onboardingComplete: true },
      }),
    ];

    expect(states).toEqual([
      { status: "loading" },
      { status: "signed_out" },
      { status: "loading" },
      { status: "onboarding" },
      { status: "onboarding" },
      { status: "ready", role: "studio" },
    ]);
  });

  it("moves back to signed_out when auth is revoked from a ready session", () => {
    const ready = resolveSessionState({
      isAuthLoading: false,
      isAuthenticated: true,
      currentUser: { role: "instructor", onboardingComplete: true },
    });

    const revoked = resolveSessionState({
      isAuthLoading: false,
      isAuthenticated: false,
      currentUser: { role: "instructor", onboardingComplete: true },
    });

    expect(ready).toEqual({ status: "ready", role: "instructor" });
    expect(revoked).toEqual({ status: "signed_out" });
  });
});

describe("resolveSessionState role/onboarding matrix", () => {
  it("keeps authenticated non-loading user outcomes stable across role/onboarding combinations", () => {
    const cases = [
      {
        role: "instructor",
        onboardingComplete: true,
        expected: { status: "ready", role: "instructor" },
      },
      {
        role: "studio",
        onboardingComplete: true,
        expected: { status: "ready", role: "studio" },
      },
      {
        role: "instructor",
        onboardingComplete: false,
        expected: { status: "onboarding" },
      },
      {
        role: "studio",
        onboardingComplete: false,
        expected: { status: "onboarding" },
      },
      {
        role: "pending",
        onboardingComplete: true,
        expected: { status: "onboarding" },
      },
      {
        role: "pending",
        onboardingComplete: false,
        expected: { status: "onboarding" },
      },
      {
        role: "admin",
        onboardingComplete: true,
        expected: { status: "onboarding" },
      },
      {
        role: "admin",
        onboardingComplete: false,
        expected: { status: "onboarding" },
      },
      {
        role: null,
        onboardingComplete: true,
        expected: { status: "onboarding" },
      },
      { onboardingComplete: true, expected: { status: "onboarding" } },
      {
        role: "instructor",
        onboardingComplete: null,
        expected: { status: "onboarding" },
      },
      { role: "studio", expected: { status: "onboarding" } },
    ] as const;

    for (const entry of cases) {
      const { expected, ...currentUser } = entry;
      expect(
        resolveSessionState({
          isAuthLoading: false,
          isAuthenticated: true,
          currentUser,
        }),
      ).toEqual(expected);
    }
  });
});

describe("resolveSessionGateDecision", () => {
  it("redirects index entry point to role home for ready sessions", () => {
    expect(
      resolveSessionGateDecision({
        entryPoint: "index",
        session: { status: "ready", role: "instructor" },
      }),
    ).toEqual({
      status: "redirect",
      href: "/instructor",
    });
  });

  it("allows app layout when already inside current role routes", () => {
    expect(
      resolveSessionGateDecision({
        entryPoint: "app_layout",
        pathname: "/studio/jobs",
        session: { status: "ready", role: "studio" },
      }),
    ).toEqual({ status: "allow" });
  });

  it("redirects app layout to role home when path does not match current role", () => {
    expect(
      resolveSessionGateDecision({
        entryPoint: "app_layout",
        pathname: "/instructor/jobs",
        session: { status: "ready", role: "studio" },
      }),
    ).toEqual({ status: "redirect", href: "/studio" });
  });

  it("keeps loading and auth redirects consistent across entry points", () => {
    expect(
      resolveSessionGateDecision({
        entryPoint: "index",
        session: { status: "loading" },
      }),
    ).toEqual({ status: "loading" });

    expect(
      resolveSessionGateDecision({
        entryPoint: "app_layout",
        session: { status: "signed_out" },
      }),
    ).toEqual({ status: "redirect", href: "/sign-in" });

    expect(
      resolveSessionGateDecision({
        entryPoint: "app_layout",
        session: { status: "onboarding" },
      }),
    ).toEqual({ status: "redirect", href: "/onboarding" });
  });
});
