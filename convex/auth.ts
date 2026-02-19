import Apple from "@auth/core/providers/apple";
import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import { ResendOTP } from "./resendOtp";

const providers: any[] = [ResendOTP];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
}

if (process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) {
  providers.push(Apple);
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers,
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const now = Date.now();
      const fullName =
        typeof args.profile.name === "string" ? args.profile.name : undefined;
      const email =
        typeof args.profile.email === "string" ? args.profile.email : undefined;
      const phone =
        typeof args.profile.phone === "string" ? args.profile.phone : undefined;
      const image =
        typeof args.profile.image === "string" ? args.profile.image : undefined;
      const emailVerificationTime =
        args.profile.emailVerified === true ? now : undefined;
      const phoneVerificationTime =
        args.profile.phoneVerified === true ? now : undefined;
      const isAnonymous =
        typeof args.profile.isAnonymous === "boolean"
          ? args.profile.isAnonymous
          : undefined;

      if (args.existingUserId) {
        await ctx.db.patch(args.existingUserId, {
          isActive: true,
          updatedAt: now,
          ...(fullName ? { fullName } : {}),
          ...(email ? { email } : {}),
          ...(phone ? { phoneE164: phone } : {}),
          ...(image ? { image } : {}),
          ...(emailVerificationTime ? { emailVerificationTime } : {}),
          ...(phoneVerificationTime ? { phoneVerificationTime } : {}),
          ...(isAnonymous !== undefined ? { isAnonymous } : {}),
        });
        return args.existingUserId;
      }

      const userId = await ctx.db.insert("users", {
        role: "pending",
        onboardingComplete: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        ...(fullName ? { fullName } : {}),
        ...(email ? { email } : {}),
        ...(phone ? { phoneE164: phone } : {}),
        ...(image ? { image } : {}),
        ...(emailVerificationTime ? { emailVerificationTime } : {}),
        ...(phoneVerificationTime ? { phoneVerificationTime } : {}),
        ...(isAnonymous !== undefined ? { isAnonymous } : {}),
      });
      return userId;
    },
  },
});
