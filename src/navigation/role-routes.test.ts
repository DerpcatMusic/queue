import { describe, expect, it } from "bun:test";

import {
  buildRoleTabFilePath,
  buildRoleTabRoute,
  getRoleTabBasePath,
  getRoleTabGroup,
  ROLE_TAB_GROUP_BY_ROLE,
  ROLE_TAB_ROUTE_NAMES,
} from "./role-routes";

describe("role-routes", () => {
  it("maps each role to the expected tab group", () => {
    expect(getRoleTabGroup("instructor")).toBe(
      ROLE_TAB_GROUP_BY_ROLE.instructor,
    );
    expect(getRoleTabGroup("studio")).toBe(ROLE_TAB_GROUP_BY_ROLE.studio);
  });

  it("builds stable role tab routes", () => {
    expect(getRoleTabBasePath("instructor")).toBe("/instructor");
    expect(buildRoleTabRoute("instructor", ROLE_TAB_ROUTE_NAMES.home)).toBe(
      "/instructor",
    );
    expect(buildRoleTabRoute("instructor", ROLE_TAB_ROUTE_NAMES.profile)).toBe(
      "/instructor/profile",
    );
    expect(buildRoleTabRoute("studio", ROLE_TAB_ROUTE_NAMES.calendar)).toBe(
      "/studio/calendar",
    );
  });

  it("builds role tab file paths including profile index route", () => {
    expect(buildRoleTabFilePath("instructor", ROLE_TAB_ROUTE_NAMES.jobs)).toBe(
      `${process.cwd()}/src/app/(app)/(instructor-tabs)/instructor/jobs/index.tsx`,
    );
    expect(buildRoleTabFilePath("studio", ROLE_TAB_ROUTE_NAMES.profile)).toBe(
      `${process.cwd()}/src/app/(app)/(studio-tabs)/studio/profile/index.tsx`,
    );
  });
});
