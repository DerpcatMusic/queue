import type { TFunction } from "i18next";
import type { AppButtonColors } from "@/components/ui/app-button.types";
import type { useTheme } from "@/hooks/use-theme";

export type DiditUiStatus =
  | "approved"
  | "declined"
  | "in_review"
  | "pending"
  | "in_progress"
  | "abandoned"
  | "expired"
  | "not_started";

type ThemeColors = ReturnType<typeof useTheme>["color"];

export function toDiditUiStatus(status: string | undefined): DiditUiStatus {
  switch (status) {
    case "approved":
    case "declined":
    case "in_review":
    case "pending":
    case "in_progress":
    case "abandoned":
    case "expired":
      return status;
    default:
      return "not_started";
  }
}

export function getDiditVerificationStatusPresentation(
  status: string | undefined,
  colors: ThemeColors,
  t: TFunction,
) {
  const resolved = toDiditUiStatus(status);
  switch (resolved) {
    case "approved":
      return {
        label: t("profile.compliance.values.approved"),
        backgroundColor: colors.primarySubtle,
        borderColor: colors.primarySubtle,
        textColor: colors.primary,
      };
    case "in_review":
    case "pending":
    case "in_progress":
      return {
        label: t("profile.compliance.values.pending"),
        backgroundColor: colors.tertiarySubtle,
        borderColor: colors.tertiarySubtle,
        textColor: colors.tertiary,
      };
    default:
      return {
        label: t("profile.compliance.identity.unverified"),
        backgroundColor: colors.tertiarySubtle,
        borderColor: colors.tertiarySubtle,
        textColor: colors.tertiary,
      };
  }
}

export function getDiditPrimaryActionLabel(
  isVerified: boolean,
  t: TFunction,
) {
  return isVerified
    ? t("profile.compliance.actions.refreshIdentity")
    : t("profile.identityVerification.verifyNow");
}

export function getDiditActionButtonColors(
  isVerified: boolean,
  colors: ThemeColors,
): AppButtonColors | undefined {
  if (isVerified) {
    return undefined;
  }
  return {
    backgroundColor: colors.tertiary,
    pressedBackgroundColor: colors.tertiary,
    disabledBackgroundColor: colors.tertiarySubtle,
    labelColor: colors.onPrimary,
    disabledLabelColor: colors.onPrimary,
    nativeTintColor: colors.tertiary,
  };
}

export function shouldOfferDiditManualRefresh(
  status: string | undefined,
  isVerified: boolean,
) {
  if (isVerified) {
    return true;
  }
  const resolved = toDiditUiStatus(status);
  return (
    resolved === "pending" ||
    resolved === "in_progress" ||
    resolved === "in_review"
  );
}

export function shouldAutoRefreshDiditStatus(
  status: string | undefined,
  isVerified: boolean,
  sessionId: string | undefined,
) {
  if (isVerified || !sessionId) {
    return false;
  }
  const resolved = toDiditUiStatus(status);
  return (
    resolved === "pending" ||
    resolved === "in_progress" ||
    resolved === "in_review"
  );
}
