import type { Href } from "expo-router";

type StudioProfileOwner = "map" | "jobs" | "global";
type InstructorProfileOwner = "jobs" | "global";

/**
 * Canonical route builders for public-profile surfaces.
 *
 * Rule of thumb:
 * - Use tab-owned routes (`map` / `jobs`) when a profile is opened from a tab that already owns
 *   navigation transitions and sheet state.
 * - Use `global` routes for fallback/generic entry points where there is no tab-owned subroute yet.
 */
export function buildStudioProfileRoute(args: {
  owner: StudioProfileOwner;
  studioId: string;
  jobId?: string | null;
}): Href {
  const encodedStudioId = encodeURIComponent(args.studioId);
  const basePath =
    args.owner === "map"
      ? `/instructor/map/studios/${encodedStudioId}`
      : args.owner === "jobs"
        ? `/instructor/jobs/studios/${encodedStudioId}`
        : `/profiles/studios/${encodedStudioId}`;

  if (!args.jobId) {
    return basePath as Href;
  }

  return `${basePath}?jobId=${encodeURIComponent(args.jobId)}` as Href;
}

export function buildStudioBranchRoute(args: {
  owner: StudioProfileOwner;
  studioId: string;
  branchId: string;
}): Href {
  const encodedStudioId = encodeURIComponent(args.studioId);
  const encodedBranchId = encodeURIComponent(args.branchId);

  if (args.owner === "map") {
    return `/instructor/map/studios/${encodedStudioId}/branches/${encodedBranchId}` as Href;
  }
  if (args.owner === "jobs") {
    return `/instructor/jobs/studios/${encodedStudioId}/branches/${encodedBranchId}` as Href;
  }
  return `/profiles/studios/${encodedStudioId}/branches/${encodedBranchId}` as Href;
}

export function resolveStudioProfileOwner(pathname: string | null): StudioProfileOwner {
  if (!pathname) {
    return "global";
  }
  if (pathname.startsWith("/instructor/map/studios/")) {
    return "map";
  }
  if (pathname.startsWith("/instructor/jobs/studios/")) {
    return "jobs";
  }
  return "global";
}

export function buildInstructorProfileRoute(args: {
  owner: InstructorProfileOwner;
  instructorId: string;
}): Href {
  const encodedInstructorId = encodeURIComponent(args.instructorId);
  if (args.owner === "jobs") {
    return `/studio/jobs/instructors/${encodedInstructorId}` as Href;
  }
  return `/profiles/instructors/${encodedInstructorId}` as Href;
}
