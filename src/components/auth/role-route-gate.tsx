import type { Href } from "expo-router";
import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { LoadingScreen } from "@/components/loading-screen";
import { useUser } from "@/contexts/user-context";

type Role = "instructor" | "studio";

type RoleRouteGateProps = {
  requiredRole: Role;
  redirectHref: Href;
  children: ReactNode;
  loadingLabel?: string;
};

export function RoleRouteGate({
  requiredRole,
  redirectHref,
  children,
  loadingLabel,
}: RoleRouteGateProps) {
  const { currentUser, effectiveRole, isAuthLoading, isAuthenticated } = useUser();

  if (currentUser === undefined) {
    if (isAuthLoading) {
      return <LoadingScreen {...(loadingLabel ? { label: loadingLabel } : {})} />;
    }

    if (!isAuthenticated) {
      return <Redirect href="/sign-in" />;
    }

    if (effectiveRole === requiredRole) {
      return <>{children}</>;
    }

    if (effectiveRole && effectiveRole !== requiredRole) {
      return <Redirect href={redirectHref} />;
    }

    return <LoadingScreen {...(loadingLabel ? { label: loadingLabel } : {})} />;
  }

  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser.role !== requiredRole) {
    return <Redirect href={redirectHref} />;
  }

  return <>{children}</>;
}
