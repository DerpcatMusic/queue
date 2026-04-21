import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { complianceWorkpool } from "../components";
import { requireUserRole } from "../lib/auth";
import { normalizeSportType } from "../lib/domainValidation";
import { omitUndefined } from "../lib/validation";
import {
  assertAllowedComplianceContentType,
  createUploadSessionToken,
  DOCUMENT_UPLOAD_SESSION_TTL_MS,
  normalizeOptionalText,
} from "./instructorShared";

export const createMyComplianceDocumentUploadSession = mutation({
  args: {
    kind: v.union(v.literal("certificate"), v.literal("insurance")),
    sport: v.optional(v.string()),
  },
  returns: v.object({
    uploadUrl: v.string(),
    sessionToken: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const instructor = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();

    if (!instructor) {
      throw new ConvexError("Instructor profile not found");
    }

    const sport =
      args.kind === "certificate" && args.sport ? normalizeSportType(args.sport) : undefined;
    const now = Date.now();
    const expiresAt = now + DOCUMENT_UPLOAD_SESSION_TTL_MS;
    const sessionToken = createUploadSessionToken(String(user._id), now);
    const uploadUrl = await ctx.storage.generateUploadUrl();

    await ctx.db.insert("instructorDocumentUploadSessions", {
      userId: user._id,
      instructorId: instructor._id,
      kind: args.kind,
      createdAt: now,
      expiresAt,
      token: sessionToken,
      ...omitUndefined({ sport }),
    });

    return {
      uploadUrl,
      sessionToken,
      expiresAt,
    };
  },
});

export const completeMyComplianceDocumentUpload = mutation({
  args: {
    sessionToken: v.string(),
    storageId: v.id("_storage"),
    fileName: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    documentKind: v.union(v.literal("certificate"), v.literal("insurance")),
    documentId: v.union(v.id("instructorCertificates"), v.id("instructorInsurancePolicies")),
  }),
  handler: async (ctx, args) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const session = await ctx.db
      .query("instructorDocumentUploadSessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .unique();

    const now = Date.now();
    if (!session || session.userId !== user._id) {
      throw new ConvexError("Invalid upload session");
    }
    if (session.consumedAt !== undefined) {
      throw new ConvexError("Upload session has already been used");
    }
    if (session.expiresAt < now) {
      throw new ConvexError("Upload session has expired");
    }

    const uploadedFile = await ctx.storage.getMetadata(args.storageId);
    if (!uploadedFile) {
      throw new ConvexError("Uploaded file was not found");
    }

    const mimeType = assertAllowedComplianceContentType(uploadedFile.contentType ?? undefined);
    const fileName = normalizeOptionalText(args.fileName);

    if (session.kind === "certificate") {
      const documentId = await ctx.db.insert("instructorCertificates", {
        instructorId: session.instructorId,
        storageId: args.storageId,
        reviewStatus: "uploaded",
        uploadedAt: now,
        createdAt: now,
        updatedAt: now,
        ...omitUndefined({
          sport: session.sport,
          fileName,
          mimeType,
        }),
      });

      await ctx.db.patch("instructorDocumentUploadSessions", session._id, {
        consumedAt: now,
        storageId: args.storageId,
      });

      await complianceWorkpool.enqueueAction(
        ctx,
        internal.compliance.instructorReview.reviewInstructorCertificate,
        { certificateId: documentId },
      );

      return {
        ok: true,
        documentKind: session.kind,
        documentId,
      };
    }

    const documentId = await ctx.db.insert("instructorInsurancePolicies", {
      instructorId: session.instructorId,
      storageId: args.storageId,
      reviewStatus: "uploaded",
      uploadedAt: now,
      createdAt: now,
      updatedAt: now,
      ...omitUndefined({
        fileName,
        mimeType,
      }),
    });

    await ctx.db.patch("instructorDocumentUploadSessions", session._id, {
      consumedAt: now,
      storageId: args.storageId,
    });

    await complianceWorkpool.enqueueAction(
      ctx,
      internal.compliance.instructorReview.reviewInstructorInsurancePolicy,
      { insurancePolicyId: documentId },
    );

    return {
      ok: true,
      documentKind: session.kind,
      documentId,
    };
  },
});
