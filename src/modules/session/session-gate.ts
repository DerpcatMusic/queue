import { useAuthSession } from "@/contexts/auth-session-context";
import { useUser } from "@/contexts/user-context";
import { peekPendingPostSignOutAuthHandoff } from "@/modules/session/post-signout-auth-intent";
import type { getRoleTabBasePath } from "@/navigation/role-routes";
import { buildRoleTabRoute, isRolePath, ROLE_TAB_ROUTE_NAMES } from "@/navigation/role-routes";
import type { AppRole } from "@/navigation/types";

type UserLike = {
  role?: "pending" | "instructor" | "studio" | null;
  roles?: AppRole[] | null;
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
  isSessionTransitioning?: boolean;
  currentUser: UserLike | null | undefined;
}): SessionState {
  if (input.isAuthLoading) {
    return { status: "loading" };
  }

  if (input.isSessionTransitioning) {
    return { status: "loading" };
  }

  if (!input.isAuthenticated) {
    return { status: "signed_out" };
  }

  // Auth session is ready, but user document may still be provisioning.
  if (input.currentUser === undefined || input.currentUser === null) {
    return { status: "loading" };
  }

  const directRole = input.currentUser.role;
  const availableRoles = input.currentUser.roles ?? [];
  const resolvedRole =
    directRole === "instructor" || directRole === "studio"
      ? directRole
      : availableRoles[0];

  if (!resolvedRole) {
    return { status: "onboarding" };
  }

  if (!input.currentUser.onboardingComplete && availableRoles.length === 0) {
    return { status: "onboarding" };
  }

  return { status: "ready", role: resolvedRole };
}

export function resolveSessionGateDecision<T extends SessionGateEntryPoint>(input: {
  entryPoint: T;
  pathname?: string;
  pendingSignedOutPath?: string;
  session: SessionState;
}): SessionGateDecisionMap[T] {
  const { session } = input;
  if (session.status === "loading") {
    return { status: "loading" } as SessionGateDecisionMap[T];
  }

  if (session.status === "signed_out") {
    if (
      input.entryPoint === "app_layout" &&
      input.pendingSignedOutPath &&
      input.pathname === input.pendingSignedOutPath
    ) {
      return { status: "allow" } as SessionGateDecisionMap[T];
    }

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
  const { isSessionTransitioning } = useAuthSession();
  const pendingAuthHandoff = peekPendingPostSignOutAuthHandoff();

  // Only auth initialization itself should block routing.
  // A null/undefined user doc after auth settles must flow through the
  // session resolver so signed-out and onboarding redirects can happen.
  if (isAuthLoading) {
    return { status: "loading" } as SessionGateDecisionMap[T];
  }

  const session = resolveSessionState({
    isAuthLoading,
    isAuthenticated,
    isSessionTransitioning,
    currentUser,
  });

  return resolveSessionGateDecision({
    entryPoint,
    ...(pendingAuthHandoff?.allowPath
      ? { pendingSignedOutPath: pendingAuthHandoff.allowPath }
      : {}),
    session,
    ...(pathname === undefined ? {} : { pathname }),
  });
}
