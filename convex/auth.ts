import Apple from "@auth/core/providers/apple";
import Google from "@auth/core/providers/google";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { convexAuth, createAccount } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ResendMagicLink } from "./auth/magicLink";
import { ResendOTP } from "./auth/otp";
import { getFallbackRedirectTarget, isAllowedRedirectTarget } from "./authRedirect";
import { resolveAuthenticatedUser } from "./authResolution";

function trimEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

const providers: any[] = [ResendOTP, ResendMagicLink];
const googleSharedServerClientId =
  trimEnv(process.env.GOOGLE_CALENDAR_SERVER_CLIENT_ID) ?? trimEnv(process.env.AUTH_GOOGLE_ID);
const googleOauthWebClientId = googleSharedServerClientId;
const googleNativeWebClientId = googleSharedServerClientId;
const googleNativeTokenAudiences = [googleNativeWebClientId, googleOauthWebClientId].filter(
  (value): value is string => Boolean(value),
);
const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const appleNativeClientId =
  trimEnv(process.env.EXPO_PUBLIC_APPLE_NATIVE_CLIENT_ID) ?? "com.derpcat.queue";
const appleNativeTokenAudiences = [appleNativeClientId].filter((value): value is string =>
  Boolean(value),
);
const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

if (googleOauthWebClientId && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
}

if (googleNativeWebClientId && googleNativeTokenAudiences.length > 0) {
  providers.push(
    ConvexCredentials({
      id: "google-native",
      authorize: async (credentials, ctx) => {
        const idToken = typeof credentials.idToken === "string" ? credentials.idToken : undefined;
        if (!idToken) {
          throw new ConvexError("Missing Google ID token.");
        }

        const verified = await jwtVerify(idToken, googleJwks, {
          audience: googleNativeTokenAudiences,
          issuer: ["https://accounts.google.com", "accounts.google.com"],
        });
        const payload = verified.payload;
        if (!payload?.email) {
          throw new ConvexError("Google sign-in succeeded but no email was returned.");
        }

        const accountId = payload.sub ?? payload.email;
        const profile = {
          role: "pending" as const,
          roles: [] as Array<"instructor" | "studio">,
          onboardingComplete: false,
          isActive: true,
          email: String(payload.email),
          ...(payload.email_verified === true ? { emailVerified: true } : {}),
          ...(typeof payload.name === "string" ? { name: payload.name } : {}),
          ...(typeof payload.picture === "string" ? { image: payload.picture } : {}),
          providerAccountIdHint: String(accountId),
          providerAccountProviders: ["google", "google-native"],
        } as any;
        const created = await createAccount(ctx, {
          provider: "google-native",
          account: {
            id: String(accountId),
          },
          profile,
          shouldLinkViaEmail: true,
        });

        return { userId: created.user._id };
      },
    }),
  );
}

if (appleNativeClientId && appleNativeTokenAudiences.length > 0) {
  providers.push(
    ConvexCredentials({
      id: "apple-native",
      authorize: async (credentials, ctx) => {
        const idToken = typeof credentials.idToken === "string" ? credentials.idToken : undefined;
        if (!idToken) {
          throw new ConvexError("Missing Apple identity token.");
        }

        const verified = await jwtVerify(idToken, appleJwks, {
          audience: appleNativeTokenAudiences,
          issuer: ["https://appleid.apple.com"],
        });
        const payload = verified.payload;
        const accountId = payload.sub ?? payload.email;
        if (!accountId) {
          throw new ConvexError("Apple sign-in succeeded but no user identifier was returned.");
        }

        const profile = {
          role: "pending" as const,
          roles: [] as Array<"instructor" | "studio">,
          onboardingComplete: false,
          isActive: true,
          ...(typeof payload.email === "string" ? { email: payload.email } : {}),
          ...(payload.email_verified === true || payload.email_verified === "true"
            ? { emailVerified: true }
            : {}),
          ...(typeof payload.name === "string" ? { name: payload.name } : {}),
          providerAccountIdHint: String(accountId),
          providerAccountProviders: ["apple", "apple-native"],
        } as any;

        const created = await createAccount(ctx, {
          provider: "apple-native",
          account: {
            id: String(accountId),
          },
          profile,
          shouldLinkViaEmail: Boolean(payload.email),
        });

        return { userId: created.user._id };
      },
    }),
  );
}

if (process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) {
  providers.push(Apple);
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers,
  callbacks: {
    async redirect({ redirectTo }) {
      if (isAllowedRedirectTarget(redirectTo)) {
        return redirectTo;
      }
      return getFallbackRedirectTarget();
    },
    async createOrUpdateUser(ctx, args) {
      return await resolveAuthenticatedUser(ctx, {
        existingUserId: args.existingUserId,
        profile: args.profile,
        provider: args.provider,
      });
    },
  },
});
