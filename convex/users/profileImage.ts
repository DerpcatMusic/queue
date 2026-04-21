import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { requireUserRole } from "../lib/auth";
import { omitUndefined, trimOptionalString } from "../lib/validation";
import { getUniqueInstructorProfileByUserId, getUniqueStudioProfileByUserId } from "./_shared";
import { createSecureUploadToken } from "../lib/secureToken";

// Private helper - uses crypto for secure token generation
function createUploadSessionToken(userId: Doc<"users">["_id"], now: number) {
  return createSecureUploadToken(String(userId), now);
}

// Private helper to require instructor profile
async function requireInstructorProfileByUserId(ctx: MutationCtx, userId: Doc<"users">["_id"]) {
  const profile = await getUniqueInstructorProfileByUserId(ctx, userId);
  if (!profile) {
    throw new ConvexError("Instructor profile not found");
  }
  return profile;
}

// Private helper to require studio profile
async function requireStudioProfileByUserId(ctx: MutationCtx, userId: Doc<"users">["_id"]) {
  const profile = await getUniqueStudioProfileByUserId(ctx, userId);
  if (!profile) {
    throw new ConvexError("Studio profile not found");
  }
  return profile;
}

const PROFILE_IMAGE_UPLOAD_SESSION_TTL_MS = 10 * 60 * 1000;

// createMyProfileImageUploadSession: mutation to create a profile image upload session
export const createMyProfileImageUploadSession = mutation({
  args: {},
  returns: v.object({
    uploadUrl: v.string(),
    sessionToken: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (ctx: MutationCtx) => {
    const user = await requireUserRole(ctx, ["instructor", "studio"]);
    const now = Date.now();
    const expiresAt = now + PROFILE_IMAGE_UPLOAD_SESSION_TTL_MS;
    const sessionToken = createUploadSessionToken(user._id, now);
    const uploadUrl = await ctx.storage.generateUploadUrl();
    const role = user.role === "studio" ? "studio" : "instructor";

    await ctx.db.insert("profileImageUploadSessions", {
      userId: user._id,
      role,
      token: sessionToken,
      createdAt: now,
      expiresAt,
    });

    return {
      uploadUrl,
      sessionToken,
      expiresAt,
    };
  },
});

// completeMyProfileImageUpload: mutation to complete a profile image upload
export const completeMyProfileImageUpload = mutation({
  args: {
    sessionToken: v.string(),
    storageId: v.id("_storage"),
  },
  returns: v.object({
    ok: v.boolean(),
    imageUrl: v.optional(v.string()),
  }),
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireUserRole(ctx, ["instructor", "studio"]);
    const now = Date.now();

    const session = await ctx.db
      .query("profileImageUploadSessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .unique();

    const role = user.role === "studio" ? "studio" : "instructor";
    if (!session || session.userId !== user._id || session.role !== role) {
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
    const contentType = trimOptionalString(uploadedFile.contentType ?? undefined);
    if (!contentType || !contentType.startsWith("image/")) {
      throw new ConvexError("Only image uploads are allowed");
    }

    let previousStorageId:
      | Doc<"instructorProfiles">["profileImageStorageId"]
      | Doc<"studioProfiles">["logoStorageId"];
    if (user.role === "instructor") {
      const profile = await requireInstructorProfileByUserId(ctx, user._id);
      previousStorageId = profile.profileImageStorageId;
      await ctx.db.patch("instructorProfiles", profile._id, {
        profileImageStorageId: args.storageId,
        updatedAt: now,
      });
    } else {
      const profile = await requireStudioProfileByUserId(ctx, user._id);
      previousStorageId = profile.logoStorageId;
      await ctx.db.patch("studioProfiles", profile._id, {
        logoStorageId: args.storageId,
        updatedAt: now,
      });
    }

    await ctx.db.patch("profileImageUploadSessions", session._id, {
      consumedAt: now,
      storageId: args.storageId,
    });

    if (previousStorageId && previousStorageId !== args.storageId) {
      await ctx.storage.delete(previousStorageId);
    }

    const imageUrl = (await ctx.storage.getUrl(args.storageId)) ?? undefined;
    return {
      ok: true,
      ...omitUndefined({ imageUrl }),
    };
  },
});