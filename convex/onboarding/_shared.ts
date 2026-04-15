import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";

export type AppRole = "instructor" | "studio";

export function assertRoleCanCompleteOnboarding(user: Doc<"users">, targetRole: AppRole) {
  const activeRole = user.role;
  const oppositeRole: AppRole = targetRole === "instructor" ? "studio" : "instructor";

  if (activeRole === oppositeRole && user.onboardingComplete) {
    throw new ConvexError(
      `This account is already set up as a ${oppositeRole}. Sign out and use another account for a separate ${targetRole} account.`,
    );
  }
}

export function resolveGetOrCreateProfileAction(
  profileCount: number,
  profileType: "instructor" | "studio",
) {
  if (!Number.isInteger(profileCount) || profileCount < 0) {
    throw new ConvexError("Invalid profile count");
  }
  if (profileCount > 1) {
    throw new ConvexError(`Multiple ${profileType} profiles found for this account`);
  }
  return profileCount === 0 ? "create" : "reuse";
}
