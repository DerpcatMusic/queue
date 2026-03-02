import { KitStatusBadge } from "@/components/ui/kit";
import type { BrandPalette } from "@/constants/brand";

export type IdentityStatus =
  | "approved"
  | "declined"
  | "in_review"
  | "pending"
  | "in_progress"
  | "abandoned"
  | "expired"
  | "not_started";

const STATUS_LABELS: Record<IdentityStatus, string> = {
  approved: "Approved",
  declined: "Declined",
  in_review: "In review",
  pending: "Pending",
  in_progress: "In progress",
  abandoned: "Cancelled",
  expired: "Expired",
  not_started: "Not started",
};

export function getIdentityStatusLabel(status: string) {
  if (status in STATUS_LABELS) {
    return STATUS_LABELS[status as IdentityStatus];
  }
  return STATUS_LABELS.not_started;
}

export function getIdentityStatusTone(status: string, palette: BrandPalette) {
  switch (status) {
    case "approved":
      return {
        accent: palette.success as string,
        background: palette.successSubtle as string,
        text: palette.success as string,
      };
    case "declined":
      return {
        accent: palette.danger as string,
        background: palette.dangerSubtle as string,
        text: palette.danger as string,
      };
    case "pending":
    case "in_progress":
    case "in_review":
      return {
        accent: palette.primary as string,
        background: palette.primarySubtle as string,
        text: palette.text as string,
      };
    case "abandoned":
    case "expired":
      return {
        accent: palette.warning as string,
        background: palette.warningSubtle as string,
        text: palette.warning as string,
      };
    default:
      return {
        accent: palette.borderStrong as string,
        background: palette.surface as string,
        text: palette.textMuted as string,
      };
  }
}

export function IdentityStatusBadge({
  status,
  palette,
}: {
  status: string;
  palette: BrandPalette;
}) {
  const tone = getIdentityStatusTone(status, palette);
  const badgeTone =
    status === "approved"
      ? "success"
      : status === "declined"
        ? "danger"
        : status === "abandoned" || status === "expired"
          ? "warning"
          : status === "pending" || status === "in_progress" || status === "in_review"
            ? "accent"
            : "neutral";

  return (
    <KitStatusBadge
      label={getIdentityStatusLabel(status)}
      tone={badgeTone}
      style={{
        borderColor: tone.accent,
        backgroundColor: tone.background,
      }}
    />
  );
}
