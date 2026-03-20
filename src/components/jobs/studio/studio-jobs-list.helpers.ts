import type { ComponentProps } from "react";
import type { IconSymbol } from "@/components/ui/icon-symbol";
import type { BrandPalette } from "@/constants/brand";
import { getJobStatusTone } from "@/lib/jobs-utils";
import { getPaymentStatusTone, type PaymentStatus } from "@/lib/payments-utils";
import type { StudioJob, StudioJobApplication } from "./studio-jobs-list.types";

export type SummaryChipProps = {
  icon: ComponentProps<typeof IconSymbol>["name"];
  text: string;
  palette: BrandPalette;
};

export function jobStatusDot(status: StudioJob["status"], palette: BrandPalette): string {
  const tone = getJobStatusTone(status);
  if (tone === "primary") return palette.primary as string;
  if (tone === "success") return palette.success as string;
  return palette.textMuted as string;
}

export function paymentDotColor(status: PaymentStatus | undefined, palette: BrandPalette): string {
  if (!status) return palette.textMuted as string;
  const tone = getPaymentStatusTone(status);
  if (tone === "success") return palette.success as string;
  if (tone === "warning") return palette.warning as string;
  if (tone === "danger") return palette.danger as string;
  return palette.primary as string;
}

export function appStatusDot(
  status: StudioJobApplication["status"],
  palette: BrandPalette,
): string {
  if (status === "accepted") return palette.success as string;
  if (status === "rejected") return palette.danger as string;
  if (status === "pending") return palette.warning as string;
  return palette.textMuted as string;
}
