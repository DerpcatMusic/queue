import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";

type ConnectGoogleCalendarNativeResult =
  | { type: "success"; serverAuthCode: string }
  | { type: "cancelled" };

function normalizeGoogleSigninNativeError(error: unknown): Error {
  if (error instanceof Error && error.message.includes("RNGoogleSignin")) {
    return new Error(
      "Google Sign-In is not included in this Android build yet. Rebuild and reinstall the dev client after adding the native module.",
    );
  }

  return error instanceof Error ? error : new Error("Google Sign-In failed.");
}

export async function connectGoogleCalendarNative(args: {
  serverClientId: string;
  scopes: string[];
}): Promise<ConnectGoogleCalendarNativeResult> {
  try {
    GoogleSignin.configure({
      webClientId: args.serverClientId,
      scopes: args.scopes,
      offlineAccess: true,
      forceCodeForRefreshToken: false,
    });

    const hasPlayServices = await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });
    if (!hasPlayServices) {
      throw new Error("Google Play Services is unavailable on this device.");
    }

    const signInResponse = await GoogleSignin.signIn();
    if (isCancelledResponse(signInResponse)) {
      return { type: "cancelled" };
    }

    const serverAuthCode = signInResponse.data.serverAuthCode;
    if (!serverAuthCode) {
      throw new Error(
        "Google sign-in succeeded but no server auth code was returned. Check the server client ID and offline access setup.",
      );
    }

    return {
      type: "success",
      serverAuthCode,
    };
  } catch (error) {
    throw normalizeGoogleSigninNativeError(error);
  }
}

export async function disconnectGoogleCalendarNative() {
  try {
    await GoogleSignin.revokeAccess();
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_REQUIRED) {
      return;
    }
    throw normalizeGoogleSigninNativeError(error);
  }

  try {
    await GoogleSignin.signOut();
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_REQUIRED) {
      return;
    }
    throw normalizeGoogleSigninNativeError(error);
  }
}
