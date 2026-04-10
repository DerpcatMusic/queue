import type { TFunction } from "i18next";
import type { AppButtonColors } from "@/components/ui/app-button.types";
import type { useTheme } from "@/hooks/use-theme";

export type IdentityVerificationUiStatus =
  | "approved"
  | "declined"
  | "in_review"
  | "pending"
  | "in_progress"
  | "abandoned"
  | "expired"
  | "not_started";

type ThemeColors = ReturnType<typeof useTheme>["color"];

export function toIdentityVerificationUiStatus(status: string | undefined): IdentityVerificationUiStatus {
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

export function getIdentityVerificationStatusPresentation(
  status: string | undefined,
  colors: ThemeColors,
  t: TFunction,
) {
  const resolved = toIdentityVerificationUiStatus(status);
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
        backgroundColor: colors.primarySubtle,
        borderColor: colors.primarySubtle,
        textColor: colors.primary,
      };
    default:
      return {
        label: t("profile.compliance.identity.unverified"),
        backgroundColor: colors.primarySubtle,
        borderColor: colors.primarySubtle,
        textColor: colors.primary,
      };
  }
}

export function getIdentityPrimaryActionLabel(isVerified: boolean, t: TFunction) {
  return isVerified
    ? t("profile.compliance.actions.refreshIdentity")
    : t("profile.identityVerification.verifyNow");
}

export function getIdentityActionButtonColors(
  isVerified: boolean,
  colors: ThemeColors,
): AppButtonColors | undefined {
  if (isVerified) {
    return undefined;
  }
  return {
    backgroundColor: colors.primary,
    pressedBackgroundColor: colors.primaryPressed,
    disabledBackgroundColor: colors.primarySubtle,
    labelColor: colors.onPrimary,
    disabledLabelColor: colors.onPrimary,
    nativeTintColor: colors.primary,
  };
}

export function shouldOfferIdentityManualRefresh(status: string | undefined, isVerified: boolean) {
  if (isVerified) {
    return true;
  }
  const resolved = toIdentityVerificationUiStatus(status);
  return resolved === "pending" || resolved === "in_progress" || resolved === "in_review";
}

export function shouldAutoRefreshIdentityStatus(
  status: string | undefined,
  isVerified: boolean,
  sessionId: string | undefined,
) {
  if (isVerified || !sessionId) {
    return false;
  }
  const resolved = toIdentityVerificationUiStatus(status);
  return resolved === "pending" || resolved === "in_progress" || resolved === "in_review";
}
