"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { geminiReviewRateLimiter } from "../components";
import { toCapabilityTagLabel, toSportLabel } from "../constants";
import {
  buildCertificatePrompt,
  buildCertificateReviewSchema,
  type CertificateReviewResult,
  deleteGeminiFile,
  fetchAndVerifyDocumentBytes,
  generateStructuredGeminiReview,
  getGeminiApiKey,
  normalizeOptionalText,
  normalizeSpecialties,
  normalizeStringArray,
  parseIsoDateToExpiryMs,
  uploadFileToGemini,
} from "./instructorReviewShared";

export const reviewInstructorCertificate = internalAction({
  args: {
    certificateId: v.id("instructorCertificates"),
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
        internal.compliance.instructor.getInstructorCertificateReviewContext,
        {
          certificateId: args.certificateId,
        },
      );
      if (!reviewContext) {
        return { ok: false, status: "missing" };
      }

      await geminiReviewRateLimiter.limit(ctx, "instructorReview", {
        key: String(reviewContext.instructorId),
        throws: true,
      });

      await ctx.runMutation(
        internal.compliance.instructor.markInstructorCertificateReviewProgress,
        {
          certificateId: args.certificateId,
          reviewStatus: "ai_reviewing",
          reviewProvider: "gemini",
          reviewSummary: "Automatic review started.",
        },
      );

      const bytes = await fetchAndVerifyDocumentBytes(reviewContext.storageUrl);
      const uploadedFile = await uploadFileToGemini({
        apiKey,
        bytes,
        mimeType: reviewContext.mimeType ?? "application/pdf",
        displayName: reviewContext.fileName ?? `certificate-${String(reviewContext.certificateId)}`,
      });
      geminiFileName = uploadedFile.name;

      const parsed = await generateStructuredGeminiReview<CertificateReviewResult>({
        apiKey,
        file: uploadedFile,
        prompt: buildCertificatePrompt({
          instructorDisplayName: reviewContext.instructorDisplayName,
          nowIsoDate: new Date().toISOString().slice(0, 10),
          ...(reviewContext.declaredSport ? { declaredSport: reviewContext.declaredSport } : {}),
          ...(reviewContext.diditLegalName ? { diditLegalName: reviewContext.diditLegalName } : {}),
        }),
        responseSchema: buildCertificateReviewSchema(),
      });

      const rejectionReasons = normalizeStringArray(parsed.rejectionReasons);
      const specialties = normalizeSpecialties(parsed.specialties);
      const approved: boolean = parsed.approved === true && specialties.length > 0;
      const issuerName = normalizeOptionalText(parsed.issuerName);
      const certificateTitle = normalizeOptionalText(parsed.certificateTitle);
      const reviewSummary = normalizeOptionalText(parsed.summary);
      const completedAt = parseIsoDateToExpiryMs(parsed.completedOn);

      await ctx.runMutation(
        internal.compliance.instructor.applyInstructorCertificateReviewDecision,
        {
          certificateId: args.certificateId,
          reviewStatus: approved ? "approved" : "rejected",
          reviewProvider: "gemini",
          rejectionReasons,
          reviewJson: JSON.stringify(parsed),
          specialties,
          ...(issuerName ? { issuerName } : {}),
          ...(certificateTitle ? { certificateTitle } : {}),
          ...(completedAt !== undefined ? { completedAt } : {}),
          ...(reviewSummary ? { reviewSummary } : {}),
        },
      );

      await ctx.runMutation(internal.compliance.instructor.createInstructorComplianceNotification, {
        recipientUserId: reviewContext.recipientUserId,
        kind: approved ? "compliance_certificate_approved" : "compliance_certificate_rejected",
        title: approved ? "Certificate approved" : "Certificate needs attention",
        body: approved
          ? `Certificate approved for ${specialties
              .map((specialty) =>
                specialty.capabilityTags && specialty.capabilityTags.length > 0
                  ? `${toSportLabel(specialty.sport)} (${specialty.capabilityTags
                      .map((tag) => toCapabilityTagLabel(tag))
                      .join(", ")})`
                  : toSportLabel(specialty.sport),
              )
              .join(", ")}.`
          : "Your certificate was not approved yet. Upload a clearer or corrected document to continue.",
      });

      return { ok: true, status: approved ? "approved" : "rejected" };
    } catch (error) {
      await ctx.runMutation(
        internal.compliance.instructor.markInstructorCertificateReviewProgress,
        {
          certificateId: args.certificateId,
          reviewStatus: "ai_pending",
          reviewProvider: "gemini",
          reviewSummary:
            error instanceof Error && error.message
              ? `Automatic review retry needed: ${error.message}`
              : "Automatic review retry needed.",
        },
      );
      return { ok: false, status: "retry_pending" };
    } finally {
      if (apiKey) {
        await deleteGeminiFile(apiKey, geminiFileName).catch(() => undefined);
      }
    }
  },
});
