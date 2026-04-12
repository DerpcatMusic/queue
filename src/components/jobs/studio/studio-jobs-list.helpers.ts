import type { ComponentProps } from "react";
import type { IconSymbol } from "@/components/ui/icon-symbol";
import type { AppTheme } from "@/lib/design-system";
import { getJobStatusTone } from "@/lib/jobs-utils";
import { getPaymentStatusTone, type PaymentStatus } from "@/lib/payments-utils";
import type { StudioJob, StudioJobApplication } from "./studio-jobs-list.types";

export type SummaryChipProps = {
  icon: ComponentProps<typeof IconSymbol>["name"];
  text: string;
};

/** Maps job status tones to theme-aware chartreuse signal colors. */
export function getJobStatusToneColors(
  tone: "primary" | "success" | "amber" | "gray" | "muted",
  theme: AppTheme,
) {
  if (tone === "success") {
    return { color: theme.jobs.signal, backgroundColor: theme.color.primarySubtle };
  }
  if (tone === "primary") {
    return { color: theme.color.primary, backgroundColor: theme.color.primarySubtle };
  }
  if (tone === "amber") {
    return { color: theme.jobs.accentHeat, backgroundColor: theme.jobs.accentHeatSubtle };
  }
  if (tone === "gray") {
    return { color: theme.color.textMuted, backgroundColor: theme.color.surfaceMuted };
  }
  return {
    color: theme.color.textMuted,
    backgroundColor: theme.color.surfaceMuted,
  };
}

export function jobStatusDot(status: StudioJob["status"], theme: AppTheme): string {
  const tone = getJobStatusTone(status);
  if (tone === "primary") return theme.color.primary;
  if (tone === "success") return theme.jobs.signal;
  return theme.color.textMuted;
}

export function paymentDotColor(status: PaymentStatus | undefined, theme: AppTheme): string {
  if (!status) return theme.color.textMuted;
  const tone = getPaymentStatusTone(status);
  if (tone === "success") return theme.jobs.signal;
  if (tone === "warning") return theme.jobs.accentHeat;
  if (tone === "danger") return theme.color.danger;
  return theme.color.primary;
}

export function appStatusDot(status: StudioJobApplication["status"], theme: AppTheme): string {
  if (status === "accepted") return theme.jobs.signal;
  if (status === "rejected") return theme.color.danger;
  if (status === "pending") return theme.jobs.accentHeat;
  return theme.color.textMuted;
}
