export type JobStatus = "open" | "filled" | "completed" | "cancelled";
export type ApplicationStatus = "pending" | "accepted" | "rejected";

export type StatusTokens = {
  fg: string | import("react-native").ColorValue;
  bg: string | import("react-native").ColorValue;
  border: string | import("react-native").ColorValue;
};

type Palette = {
  primary: string;
  primarySubtle: string;
  primaryPressed: string;
  secondary: string;
  onPrimary: string;
  text: string;
  textMuted: string;
  textMicro: string;
  surface: string;
  surfaceAlt: string;
  surfaceElevated: string;
  appBg: string;
  border: string;
  borderStrong: string;
  success: string;
  successSubtle: string;
  danger: string;
  dangerSubtle: string;
  warning: string;
};

/** Single source of truth for job status → display colors. */
export function getJobStatusTokens(status: JobStatus, palette: Palette): StatusTokens {
  switch (status) {
    case "open":
      return {
        fg: palette.primary,
        bg: palette.primarySubtle,
        border: palette.primary,
      };
    case "filled":
    case "completed":
      return {
        fg: palette.success as import("react-native").ColorValue,
        bg: palette.successSubtle as import("react-native").ColorValue,
        border: palette.success as import("react-native").ColorValue,
      };
    case "cancelled":
      return {
        fg: palette.danger,
        bg: palette.dangerSubtle,
        border: palette.danger,
      };
    default:
      return {
        fg: palette.textMuted,
        bg: palette.surfaceAlt,
        border: palette.border,
      };
  }
}

/** Single source of truth for application status → display colors. */
export function getApplicationStatusTokens(
  status: ApplicationStatus,
  palette: Palette,
): StatusTokens {
  switch (status) {
    case "accepted":
      return {
        fg: palette.success as import("react-native").ColorValue,
        bg: palette.successSubtle as import("react-native").ColorValue,
        border: palette.success as import("react-native").ColorValue,
      };
    case "rejected":
      return {
        fg: palette.danger,
        bg: palette.dangerSubtle,
        border: palette.danger,
      };
    default:
      return {
        fg: palette.primary,
        bg: palette.primarySubtle,
        border: palette.primary,
      };
  }
}
