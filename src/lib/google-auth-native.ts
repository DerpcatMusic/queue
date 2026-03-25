import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";

export type GoogleNativeAuthConfig = {
  enabled: boolean;
  webClientId?: string | null | undefined;
  iosClientId?: string | null | undefined;
};

type SignInWithGoogleNativeResult = { type: "success"; idToken: string } | { type: "cancelled" };

function trimEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function resolveGoogleNativeAuthConfig(): GoogleNativeAuthConfig {
  const webClientId = trimEnv(process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_SERVER_CLIENT_ID);
  const iosClientId = trimEnv(process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID_IOS);

  return {
    enabled: Boolean(webClientId),
    ...(webClientId ? { webClientId } : {}),
    ...(iosClientId ? { iosClientId } : {}),
  };
}

function normalizeGoogleSigninNativeError(error: unknown): Error {
  if (
    error instanceof Error &&
    (error.message.includes("DEVELOPER_ERROR") ||
      error.message.includes("code: 10") ||
      error.message.includes("Developer console is not set up correctly"))
  ) {
    return new Error(
      "Google Sign-In does not match this native build. For Android, the Google Cloud OAuth app must include package `com.derpcat.queue` and this build's SHA-1 fingerprint. For iOS, the Expo build must include the Google iOS URL scheme and be rebuilt.",
    );
  }

  if (error instanceof Error && error.message.includes("RNGoogleSignin")) {
    return new Error(
      "Google Sign-In is not included in this build yet. Rebuild and reinstall the dev client after adding the native module configuration.",
    );
  }

  return error instanceof Error ? error : new Error("Google Sign-In failed.");
}

export function canUseNativeGoogleAuth(config: GoogleNativeAuthConfig | null | undefined) {
  if (!config?.enabled || !config.webClientId || Platform.OS === "web") {
    return false;
  }

  if (Platform.OS === "ios" && !config.iosClientId) {
    return false;
  }

  return true;
}

async function clearPreviousGoogleSession() {
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_REQUIRED) {
      return;
    }
    throw normalizeGoogleSigninNativeError(error);
  }
}

export async function signInWithGoogleNative(args: {
  config: GoogleNativeAuthConfig | null | undefined;
}): Promise<SignInWithGoogleNativeResult> {
  if (!canUseNativeGoogleAuth(args.config)) {
    throw new Error("Native Google Sign-In is not configured for this platform.");
  }

  const config = args.config!;

  try {
    GoogleSignin.configure({
      webClientId: config.webClientId!,
      ...(Platform.OS === "ios" && config.iosClientId ? { iosClientId: config.iosClientId } : {}),
      offlineAccess: false,
    });

    if (Platform.OS === "android") {
      const hasPlayServices = await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      if (!hasPlayServices) {
        throw new Error("Google Play Services is unavailable on this device.");
      }
    }

    await clearPreviousGoogleSession();

    const signInResponse = await GoogleSignin.signIn();
    if (isCancelledResponse(signInResponse)) {
      return { type: "cancelled" };
    }

    const idToken = signInResponse.data.idToken;
    if (!idToken) {
      throw new Error(
        "Google sign-in succeeded but no ID token was returned. Check the Google client configuration.",
      );
    }

    return {
      type: "success",
      idToken,
    };
  } catch (error) {
    throw normalizeGoogleSigninNativeError(error);
  }
}
