import { Platform } from "react-native";

type DiditNativeOutcome = "approved" | "pending" | "declined" | "cancelled";

export type DiditNativeVerificationResult = {
  outcome: DiditNativeOutcome;
  sessionId?: string;
};

function resolveDiditLanguageCode(locale: string | undefined) {
  const normalized = locale?.toLowerCase() ?? "en";
  return normalized.startsWith("he") ? "he" : "en";
}

export async function startDiditNativeVerification({
  sessionToken,
  locale,
}: {
  sessionToken: string;
  locale?: string;
}): Promise<DiditNativeVerificationResult> {
  if (Platform.OS === "web") {
    throw new Error(
      "Didit verification is only available in the native iOS or Android app.",
    );
  }

  const { startVerification, VerificationStatus } =
    await import("@didit-protocol/sdk-react-native");

  const result = await startVerification(sessionToken, {
    languageCode: resolveDiditLanguageCode(locale),
    loggingEnabled: __DEV__,
    showCloseButton: true,
    showExitConfirmation: true,
    closeOnComplete: false,
  });

  switch (result.type) {
    case "completed":
      if (result.session.status === VerificationStatus.Approved) {
        return {
          outcome: "approved",
          sessionId: result.session.sessionId,
        };
      }
      if (result.session.status === VerificationStatus.Pending) {
        return {
          outcome: "pending",
          sessionId: result.session.sessionId,
        };
      }
      return {
        outcome: "declined",
        sessionId: result.session.sessionId,
      };
    case "cancelled":
      return result.session?.sessionId
        ? {
            outcome: "cancelled",
            sessionId: result.session.sessionId,
          }
        : {
            outcome: "cancelled",
          };
    case "failed":
      throw new Error(result.error.message);
  }
}
