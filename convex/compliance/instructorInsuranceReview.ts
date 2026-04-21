"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { geminiReviewRateLimiter } from "../components";
import {
  buildInsurancePrompt,
  buildInsuranceReviewSchema,
  deleteGeminiFile,
  fetchAndVerifyDocumentBytes,
  generateStructuredGeminiReview,
  getGeminiApiKey,
  type InsuranceReviewResult,
  normalizeOptionalText,
  normalizeStringArray,
  parseIsoDateToExpiryMs,
  uploadFileToGemini,
} from "./instructorReviewShared";

export const reviewInstructorInsurancePolicy = internalAction({
  args: {
    insurancePolicyId: v.id("instructorInsurancePolicies"),
  },
  returns: v.object({
    ok: v.boolean(),
    status: v.string(),
  }),
  handler: async (ctx, args): Promise<{ ok: boolean; status: string }> => {
    let apiKey: string | undefined;
    let geminiFileName: string | undefined;
    try {
      apiKey = getGeminiApiKey();

      const reviewContext = await ctx.runQuery(
        internal.compliance.instructor.getInstructorInsuranceReviewContext,
        {
          insurancePolicyId: args.insurancePolicyId,
        },
      );
      if (!reviewContext) {
        return { ok: false, status: "missing" };
      }

      await geminiReviewRateLimiter.limit(ctx, "instructorReview", {
        key: String(reviewContext.instructorId),
        throws: true,
      });

      await ctx.runMutation(internal.compliance.instructor.markInstructorInsuranceReviewProgress, {
        insurancePolicyId: args.insurancePolicyId,
        reviewStatus: "ai_reviewing",
        reviewProvider: "gemini",
        reviewSummary: "Automatic review started.",
      });

      const bytes = await fetchAndVerifyDocumentBytes(reviewContext.storageUrl);
      const uploadedFile = await uploadFileToGemini({
        apiKey,
        bytes,
        mimeType: reviewContext.mimeType ?? "application/pdf",
        displayName:
          reviewContext.fileName ?? `insurance-${String(reviewContext.insurancePolicyId)}`,
      });
      geminiFileName = uploadedFile.name;

      const parsed = await generateStructuredGeminiReview<InsuranceReviewResult>({
        apiKey,
        file: uploadedFile,
        prompt: buildInsurancePrompt({
          instructorDisplayName: reviewContext.instructorDisplayName,
          nowIsoDate: new Date().toISOString().slice(0, 10),
          ...(reviewContext.diditLegalName ? { diditLegalName: reviewContext.diditLegalName } : {}),
        }),
        responseSchema: buildInsuranceReviewSchema(),
      });

      const expiresAt = parseIsoDateToExpiryMs(parsed.expiresOn);
      const rejectionReasons = normalizeStringArray(parsed.rejectionReasons);
      const approved: boolean =
        parsed.approved === true && typeof expiresAt === "number" && expiresAt > Date.now();
      const issuerName = normalizeOptionalText(parsed.issuerName);
      const policyNumber = normalizeOptionalText(parsed.policyNumber);
      const expiresOn = normalizeOptionalText(parsed.expiresOn);
      const reviewSummary = normalizeOptionalText(parsed.summary);
      const policyHolderName = normalizeOptionalText(parsed.policyHolderName);

      await ctx.runMutation(internal.compliance.instructor.applyInstructorInsuranceReviewDecision, {
        insurancePolicyId: args.insurancePolicyId,
        reviewStatus: approved ? "approved" : "rejected",
        reviewProvider: "gemini",
        rejectionReasons: approved
          ? rejectionReasons
          : rejectionReasons.length > 0
            ? rejectionReasons
            : ["Insurance proof is missing a valid future expiry date or could not be verified."],
        reviewJson: JSON.stringify(parsed),
        ...(issuerName ? { issuerName } : {}),
        ...(policyHolderName ? { policyHolderName } : {}),
        ...(policyNumber ? { policyNumber } : {}),
        ...(expiresOn ? { expiresOn } : {}),
        ...(typeof expiresAt === "number" ? { expiresAt } : {}),
        ...(reviewSummary ? { reviewSummary } : {}),
      });

      await ctx.runMutation(internal.compliance.instructor.createInstructorComplianceNotification, {
        recipientUserId: reviewContext.recipientUserId,
        kind: approved ? "compliance_insurance_approved" : "compliance_insurance_rejected",
        title: approved ? "Insurance approved" : "Insurance needs attention",
        body: approved
          ? `Insurance approved${parsed.expiresOn ? ` until ${parsed.expiresOn}` : ""}.`
          : "Your insurance document was not approved yet. Upload a valid active policy to continue.",
      });

      return { ok: true, status: approved ? "approved" : "rejected" };
    } catch (error) {
      await ctx.runMutation(internal.compliance.instructor.markInstructorInsuranceReviewProgress, {
        insurancePolicyId: args.insurancePolicyId,
        reviewStatus: "ai_pending",
        reviewProvider: "gemini",
        reviewSummary:
          error instanceof Error && error.message
            ? `Automatic review retry needed: ${error.message}`
            : "Automatic review retry needed.",
      });
      return { ok: false, status: "retry_pending" };
    } finally {
      if (apiKey) {
        await deleteGeminiFile(apiKey, geminiFileName).catch(() => undefined);
      }
    }
  },
});
