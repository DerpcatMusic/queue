import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";

export type AppleNativeAuthResult =
  | {
      type: "success";
      identityToken: string;
    }
  | {
      type: "cancelled";
    }
  | {
      type: "unavailable";
    };

function normalizeAppleAuthError(error: unknown): Error {
  if (error instanceof Error && error.message.includes("ERR_REQUEST_CANCELED")) {
    return new Error("Apple Sign-In was cancelled.");
  }

  if (error instanceof Error && error.message.includes("apple-authentication")) {
    return new Error("Apple Sign-In is not included in this build yet.");
  }

  return error instanceof Error ? error : new Error("Apple Sign-In failed.");
}

export async function signInWithAppleNative(): Promise<AppleNativeAuthResult> {
  if (Platform.OS !== "ios") {
    return { type: "unavailable" };
  }

  const isAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAvailable) {
    return { type: "unavailable" };
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error("Apple Sign-In completed but no identity token was returned.");
    }

    return {
      type: "success",
      identityToken: credential.identityToken,
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ERR_REQUEST_CANCELED"
    ) {
      return { type: "cancelled" };
    }

    throw normalizeAppleAuthError(error);
  }
}
