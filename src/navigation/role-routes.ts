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
