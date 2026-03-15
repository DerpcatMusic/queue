import { useUser } from "@/contexts/user-context";
import type { getRoleTabBasePath } from "@/navigation/role-routes";
import { buildRoleTabRoute, isRolePath, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";
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

export type SessionGateEntryPoint = "index" | "app_layout";
export type SessionGateRedirectHref =
  | "/sign-in"
  | "/onboarding"
  | ReturnType<typeof getRoleTabBasePath>;

type SessionGateDecisionMap = {
  index: { status: "loading" } | { status: "redirect"; href: SessionGateRedirectHref };
  app_layout:
    | { status: "loading" }
    | { status: "allow" }
    | { status: "redirect"; href: SessionGateRedirectHref };
};

export function resolveSessionState(input: {
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  currentUser: UserLike | null | undefined;
}): SessionState {
  if (input.isAuthLoading) {
    return { status: "loading" };
  }

  if (!input.isAuthenticated) {
    return { status: "signed_out" };
  }

  // Auth session is ready, but user document may still be provisioning.
  if (input.currentUser === undefined || input.currentUser === null) {
    return { status: "loading" };
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

export function resolveSessionGateDecision<T extends SessionGateEntryPoint>(input: {
  entryPoint: T;
  pathname?: string;
  session: SessionState;
}): SessionGateDecisionMap[T] {
  const { session } = input;
  if (session.status === "loading") {
    return { status: "loading" } as SessionGateDecisionMap[T];
  }

  if (session.status === "signed_out") {
    return {
      status: "redirect",
      href: "/sign-in",
    } as SessionGateDecisionMap[T];
  }

  if (session.status === "onboarding") {
    return {
      status: "redirect",
      href: "/onboarding",
    } as SessionGateDecisionMap[T];
  }

  if (input.entryPoint === "app_layout" && isRolePath(input.pathname ?? "", session.role)) {
    return { status: "allow" } as SessionGateDecisionMap[T];
  }

  return {
    status: "redirect",
    href: buildRoleTabRoute(session.role, ROLE_TAB_ROUTE_NAMES.home),
  } as SessionGateDecisionMap[T];
}

export function useSessionGate<T extends SessionGateEntryPoint>(
  entryPoint: T,
  pathname?: string,
): SessionGateDecisionMap[T] {
  const { currentUser, isAuthLoading, isAuthenticated } = useUser();

  // Handle undefined user context - return loading state
  if (!currentUser && !isAuthenticated) {
    return { status: "loading" } as SessionGateDecisionMap[T];
  }

  const session = resolveSessionState({
    isAuthLoading,
    isAuthenticated,
    currentUser,
  });

  return resolveSessionGateDecision({
    entryPoint,
    session,
    ...(pathname === undefined ? {} : { pathname }),
  });
}
