import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { requireUserRole } from "../lib/auth";
import {
  type FranceProfessionalQualification,
  lookupFranceProfessionalCardPublic,
  normalizeFranceProfessionalCardNumber,
} from "../lib/professionalRegistryFrance";
import { nameMatchesHolder } from "../instructors/publicProfiles";
import { omitUndefined } from "../lib/validation";

const franceProfessionalQualificationValidator = v.object({
  title: v.string(),
  alert: v.optional(v.string()),
  conditions: v.optional(v.string()),
  obtainedOn: v.optional(v.string()),
  obtainedAt: v.optional(v.number()),
  validFromOn: v.optional(v.string()),
  validFromAt: v.optional(v.number()),
  validUntilOn: v.optional(v.string()),
  validUntilAt: v.optional(v.number()),
  lastReviewedOn: v.optional(v.string()),
  lastReviewedAt: v.optional(v.number()),
  renewalRequiredByOn: v.optional(v.string()),
  renewalRequiredByAt: v.optional(v.number()),
});

const instructorProfessionalRegistrySnapshotValidator = v.union(
  v.null(),
  v.object({
    country: v.literal("FR"),
    provider: v.literal("france_eaps_public"),
    identifier: v.string(),
    status: v.union(v.literal("found"), v.literal("not_found"), v.literal("error")),
    checkedAt: v.optional(v.number()),
    isPublic: v.optional(v.boolean()),
    hasValidRegistration: v.optional(v.boolean()),
    holderName: v.optional(v.string()),
    issuingAuthority: v.optional(v.string()),
    expiresOn: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    nameMatched: v.optional(v.boolean()),
    publicProfileUrl: v.optional(v.string()),
    apiUrl: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    qualifications: v.array(franceProfessionalQualificationValidator),
  }),
);

function mapQualifications(qualifications: FranceProfessionalQualification[] | undefined) {
  return (qualifications ?? []).map((qualification) => ({
    title: qualification.title,
    ...omitUndefined({
      alert: qualification.alert,
      conditions: qualification.conditions,
      obtainedOn: qualification.obtainedOn,
      obtainedAt: qualification.obtainedAt,
      validFromOn: qualification.validFromOn,
      validFromAt: qualification.validFromAt,
      validUntilOn: qualification.validUntilOn,
      validUntilAt: qualification.validUntilAt,
      lastReviewedOn: qualification.lastReviewedOn,
      lastReviewedAt: qualification.lastReviewedAt,
      renewalRequiredByOn: qualification.renewalRequiredByOn,
      renewalRequiredByAt: qualification.renewalRequiredByAt,
    }),
  }));
}

export const getMyInstructorProfessionalRegistrySnapshot = query({
  args: {},
  returns: instructorProfessionalRegistrySnapshotValidator,
  handler: async (ctx) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const instructor = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();

    if (!instructor?.professionalRegistryCountry || !instructor.professionalRegistryIdentifier) {
      return null;
    }

    return {
      country: "FR",
      provider: "france_eaps_public",
      identifier: instructor.professionalRegistryIdentifier,
      status: instructor.professionalRegistryStatus ?? "error",
      qualifications: mapQualifications(instructor.professionalRegistryQualifications),
      ...omitUndefined({
        checkedAt: instructor.professionalRegistryCheckedAt,
        isPublic: instructor.professionalRegistryIsPublic,
        hasValidRegistration: instructor.professionalRegistryHasValidRegistration,
        holderName: instructor.professionalRegistryHolderName,
        issuingAuthority: instructor.professionalRegistryIssuingAuthority,
        expiresOn: instructor.professionalRegistryExpiresOn,
        expiresAt: instructor.professionalRegistryExpiresAt,
        nameMatched: instructor.professionalRegistryNameMatched,
        publicProfileUrl: instructor.professionalRegistryPublicUrl,
        apiUrl: instructor.professionalRegistryApiUrl,
        errorCode: instructor.professionalRegistryErrorCode,
        errorMessage: instructor.professionalRegistryErrorMessage,
      }),
    };
  },
});

export const saveMyFranceProfessionalCardNumber = mutation({
  args: {
    cardNumber: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    identifier: v.string(),
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

    const identifier = normalizeFranceProfessionalCardNumber(args.cardNumber);
    await ctx.db.patch(instructor._id, {
      professionalRegistryCountry: "FR",
      professionalRegistryIdentifier: identifier,
      professionalRegistryProvider: "france_eaps_public",
      professionalRegistryStatus: "error",
      professionalRegistryErrorCode: "PENDING_REFRESH",
      professionalRegistryErrorMessage: "Saved. Run refresh to verify against the public registry.",
      updatedAt: Date.now(),
    });

    return { ok: true, identifier };
  },
});

export const getInstructorProfessionalRegistryProfileContext = internalQuery({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(
    v.null(),
    v.object({
      instructorId: v.id("instructorProfiles"),
      addressCountryCode: v.optional(v.string()),
      professionalRegistryIdentifier: v.optional(v.string()),
      diditLegalFirstName: v.optional(v.string()),
      diditLegalMiddleName: v.optional(v.string()),
      diditLegalLastName: v.optional(v.string()),
      diditLegalName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const instructor = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();

    if (!instructor) {
      return null;
    }

    return {
      instructorId: instructor._id,
      ...omitUndefined({
        addressCountryCode: instructor.addressCountryCode,
        professionalRegistryIdentifier: instructor.professionalRegistryIdentifier,
        diditLegalFirstName: instructor.diditLegalFirstName,
        diditLegalMiddleName: instructor.diditLegalMiddleName,
        diditLegalLastName: instructor.diditLegalLastName,
        diditLegalName: instructor.diditLegalName,
      }),
    };
  },
});

export const syncInstructorProfessionalRegistrySnapshot = internalMutation({
  args: {
    instructorId: v.id("instructorProfiles"),
    provider: v.string(),
    country: v.string(),
    identifier: v.string(),
    status: v.union(v.literal("found"), v.literal("not_found"), v.literal("error")),
    checkedAt: v.number(),
    publicProfileUrl: v.optional(v.string()),
    apiUrl: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    hasValidRegistration: v.optional(v.boolean()),
    holderName: v.optional(v.string()),
    issuingAuthority: v.optional(v.string()),
    expiresOn: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    nameMatched: v.optional(v.boolean()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    qualifications: v.array(franceProfessionalQualificationValidator),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.instructorId, {
      professionalRegistryCountry: args.country,
      professionalRegistryIdentifier: args.identifier,
      professionalRegistryProvider: args.provider,
      professionalRegistryStatus: args.status,
      professionalRegistryCheckedAt: args.checkedAt,
      professionalRegistryQualifications: args.qualifications,
      ...omitUndefined({
        professionalRegistryPublicUrl: args.publicProfileUrl,
        professionalRegistryApiUrl: args.apiUrl,
        professionalRegistryIsPublic: args.isPublic,
        professionalRegistryHasValidRegistration: args.hasValidRegistration,
        professionalRegistryHolderName: args.holderName,
        professionalRegistryIssuingAuthority: args.issuingAuthority,
        professionalRegistryExpiresOn: args.expiresOn,
        professionalRegistryExpiresAt: args.expiresAt,
        professionalRegistryNameMatched: args.nameMatched,
        professionalRegistryErrorCode: args.errorCode,
        professionalRegistryErrorMessage: args.errorMessage,
      }),
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const refreshMyFranceProfessionalCardVerification = action({
  args: {},
  returns: instructorProfessionalRegistrySnapshotValidator,
  handler: async (ctx) => {
    const user = await requireUserRole(ctx, ["instructor"]);
    const instructor = await ctx.runQuery(
      internal.compliance.instructor.getInstructorProfessionalRegistryProfileContext,
      { userId: user._id },
    );

    if (!instructor) {
      throw new ConvexError("Instructor profile not found");
    }
    if (instructor.addressCountryCode?.toUpperCase() !== "FR") {
      throw new ConvexError(
        "France professional card verification only applies to instructors based in France",
      );
    }
    if (!instructor.professionalRegistryIdentifier) {
      throw new ConvexError("Add a France carte professionnelle number first");
    }

    const _checkedAt = Date.now();
    try {
      const result = await lookupFranceProfessionalCardPublic(
        instructor.professionalRegistryIdentifier,
      );
      const computedNameMatched = nameMatchesHolder(
        result.holder?.fullName,
        instructor.diditLegalFirstName,
        instructor.diditLegalMiddleName,
        instructor.diditLegalLastName,
        instructor.diditLegalName,
      );
      await ctx.runMutation(
        internal.compliance.instructor.syncInstructorProfessionalRegistrySnapshot,
        {
          instructorId: instructor.instructorId,
          country: "FR",
          provider: result.provider,
          identifier: result.normalizedIdentifier,
          status: result.status,
          checkedAt: result.checkedAt,
          qualifications: mapQualifications(result.qualifications),
          publicProfileUrl: result.publicProfileUrl,
          apiUrl: result.apiUrl,
          isPublic: result.isPublic,
          hasValidRegistration: result.hasValidRegistration,
          holderName: result.holder?.fullName,
          issuingAuthority: result.issuingAuthority,
          expiresOn: result.expiresOn,
          expiresAt: result.expiresAt,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          nameMatched: computedNameMatched,
        },
      );

      return {
        country: "FR",
        provider: result.provider,
        identifier: result.normalizedIdentifier,
        status: result.status,
        qualifications: mapQualifications(result.qualifications),
        ...omitUndefined({
          checkedAt: result.checkedAt,
          isPublic: result.isPublic,
          hasValidRegistration: result.hasValidRegistration,
          holderName: result.holder?.fullName,
          issuingAuthority: result.issuingAuthority,
          expiresOn: result.expiresOn,
          expiresAt: result.expiresAt,
          publicProfileUrl: result.publicProfileUrl,
          apiUrl: result.apiUrl,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
        }),
        nameMatched: computedNameMatched,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "France professional card lookup failed";
      await ctx.runMutation(
        internal.compliance.instructor.syncInstructorProfessionalRegistrySnapshot,
        {
          instructorId: instructor.instructorId,
          country: "FR",
          provider: "france_eaps_public",
          identifier: instructor.professionalRegistryIdentifier,
          status: "error",
          checkedAt: _checkedAt,
          errorMessage: message,
          qualifications: [],
        },
      );
      throw new ConvexError(message);
    }
  },
});
