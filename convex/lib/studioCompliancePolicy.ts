import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { buildStudioComplianceSummary } from "./studioComplianceReads";

export async function assertStudioCanPublishJobs(ctx: any, studio: Doc<"studioProfiles">) {
  const summary = await buildStudioComplianceSummary(ctx, { studio });
  if (summary.canPublishJobs) {
    return summary;
  }

  throw new ConvexError(
    `Studio compliance required: ${summary.blockingReasons.join(", ") || "unknown_blocker"}`,
  );
}
