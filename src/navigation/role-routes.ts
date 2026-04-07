import type { AppRole } from "./types";

export const ROLE_TAB_GROUP_BY_ROLE = {
  instructor: "(instructor-tabs)",
  studio: "(studio-tabs)",
} as const;

export const ROLE_TAB_ROUTE_NAMES = {
  home: "index",
  jobs: "jobs",
  calendar: "calendar",
  map: "map",
  profile: "profile",
} as const;

export type RoleTabRouteName = (typeof ROLE_TAB_ROUTE_NAMES)[keyof typeof ROLE_TAB_ROUTE_NAMES];
export type RoleTabGroup = (typeof ROLE_TAB_GROUP_BY_ROLE)[AppRole];
type RoleTabBasePathByRole = {
  instructor: "/instructor";
  studio: "/studio";
};
type RoleTabRouteFor<R extends AppRole, N extends RoleTabRouteName> = N extends "index"
  ? RoleTabBasePathByRole[R]
  : `${RoleTabBasePathByRole[R]}/${N}`;

export function getRoleTabGroup(role: AppRole): RoleTabGroup {
  return ROLE_TAB_GROUP_BY_ROLE[role];
}

export function getRoleTabBasePath<R extends AppRole>(role: R): RoleTabBasePathByRole[R] {
  if (role === "instructor") {
    return "/instructor" as RoleTabBasePathByRole[R];
  }
  return "/studio" as RoleTabBasePathByRole[R];
}

export function buildRoleTabRoute<R extends AppRole, N extends RoleTabRouteName>(
  role: R,
  routeName: N,
): RoleTabRouteFor<R, N> {
  const basePath = getRoleTabBasePath(role);
  if (routeName === ROLE_TAB_ROUTE_NAMES.home) {
    return basePath as RoleTabRouteFor<R, N>;
  }
  return `${basePath}/${routeName}` as RoleTabRouteFor<R, N>;
}

/**
 * Resolve the owning tab for any nested route inside a role tab tree.
 * Examples:
 * - /instructor -> index
 * - /instructor/map -> map
 * - /instructor/map/studios/123 -> map
 * - /studio/jobs/instructors/abc -> jobs
 */
export function resolveRoleTabRouteName(pathname: string | null, role: AppRole): RoleTabRouteName {
  if (!pathname) {
    return ROLE_TAB_ROUTE_NAMES.home;
  }

  const pathParts = pathname.split("/").filter(Boolean);
  if (pathParts.length === 0) {
    return ROLE_TAB_ROUTE_NAMES.home;
  }

  const roleSegmentIndex = pathParts.indexOf(role);
  if (roleSegmentIndex === -1) {
    return ROLE_TAB_ROUTE_NAMES.home;
  }

  const tabSegment = pathParts[roleSegmentIndex + 1];
  if (!tabSegment || tabSegment === ROLE_TAB_ROUTE_NAMES.home) {
    return ROLE_TAB_ROUTE_NAMES.home;
  }

  const routeNames = Object.values(ROLE_TAB_ROUTE_NAMES) as RoleTabRouteName[];
  return routeNames.includes(tabSegment as RoleTabRouteName)
    ? (tabSegment as RoleTabRouteName)
    : ROLE_TAB_ROUTE_NAMES.home;
}

export function isRolePath(pathname: string, role: AppRole): boolean {
  const roleRootPath = `/${role}`;
  const roleTabPath = getRoleTabBasePath(role);
  return (
    pathname === roleRootPath ||
    pathname.startsWith(`${roleRootPath}/`) ||
    pathname === roleTabPath ||
    pathname.startsWith(`${roleTabPath}/`)
  );
}

export function buildRoleTabFilePath(role: AppRole, routeName: RoleTabRouteName): string {
  const joinPath = (...parts: string[]) => parts.filter(Boolean).join("/").replace(/\/+/g, "/");

  const root =
    typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : "";
  const roleGroup = getRoleTabGroup(role);
  if (routeName === ROLE_TAB_ROUTE_NAMES.profile) {
    return joinPath(root, "src", "app", "(app)", roleGroup, role, "profile", "index.tsx");
  }
  if (routeName === ROLE_TAB_ROUTE_NAMES.home) {
    return joinPath(root, "src", "app", "(app)", roleGroup, role, "index.tsx");
  }
  return joinPath(root, "src", "app", "(app)", roleGroup, role, routeName, "index.tsx");
}
