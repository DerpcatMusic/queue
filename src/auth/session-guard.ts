import type { AppRole } from "@/navigation/types";

type UserLike = {
  role?: "pending" | "instructor" | "studio" | "admin" | null;
  onboardingComplete?: boolean | null;
};

export type SessionState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "onboarding" }
  | { status: "ready"; role: AppRole };

export function resolveSessionState(input: {
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  currentUser: UserLike | null | undefined;
}): SessionState {
  if (input.isAuthLoading || input.currentUser === undefined) {
    return { status: "loading" };
  }

  if (!input.isAuthenticated || input.currentUser === null) {
    return { status: "signed_out" };
  }

  const role = input.currentUser.role;
  if (role !== "instructor" && role !== "studio") {
    return { status: "onboarding" };
  }

  if (!input.currentUser.onboardingComplete) {
    return { status: "onboarding" };
  }

  return { status: "ready", role };
}
