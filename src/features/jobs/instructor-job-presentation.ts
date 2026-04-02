import { getZoneLabel } from "@/constants/zones";
import { toSportLabel } from "@/convex/constants";
import { getBoostPresentation, getExpiryPresentation } from "@/lib/jobs-utils";
import type { InstructorMarketplaceJob } from "./instructor-marketplace-job";

function formatJobPay(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getInstructorJobPresentation({
  job,
  locale,
  now,
  zoneLanguage,
}: {
  job: InstructorMarketplaceJob;
  locale: string;
  now: number;
  zoneLanguage: "en" | "he";
}) {
  const boost = getBoostPresentation(
    job.pay,
    job.boostPreset,
    job.boostBonusAmount,
    job.boostActive,
  );
  const expiry = getExpiryPresentation(job.applicationDeadline, locale, now, job.timeZone);
  const isExpired = expiry?.isExpired ?? false;
  const zoneLabel = getZoneLabel(job.zone, zoneLanguage);
  const street = job.studioAddress?.split(",")[0]?.trim();
  const branchStreet = job.branchAddress?.split(",")[0]?.trim();
  const locationStreet = branchStreet ?? street;
  const shortLocation = locationStreet ? `${locationStreet} · ${zoneLabel}` : zoneLabel;
  const studioLabel = `${job.studioName} · ${job.branchName}`;
  const sportLabel = toSportLabel(job.sport as never);
  const hasApplied = job.applicationStatus === "pending" || job.applicationStatus === "accepted";
  const canWithdrawPendingApplication =
    hasApplied && job.applicationStatus === "pending" && Boolean(job.applicationId);
  const canApplyFromCard =
    !job.applicationStatus ||
    job.applicationStatus === "withdrawn" ||
    job.applicationStatus === "rejected";
  const applyBlockedByVerification = job.jobActionBlockedReason !== undefined;

  return {
    boost,
    expiry,
    isExpired,
    zoneLabel,
    locationStreet,
    shortLocation,
    studioLabel,
    sportLabel,
    formattedPay: formatJobPay(boost.totalPay, locale),
    hasApplied,
    canWithdrawPendingApplication,
    canApplyFromCard,
    applyBlockedByVerification,
  };
}
