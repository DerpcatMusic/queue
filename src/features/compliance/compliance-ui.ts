import type { TFunction } from "i18next";
import { isSportType, toSportLabel } from "@/convex/constants";

type CertificateStatus =
  | "uploaded"
  | "ai_pending"
  | "ai_reviewing"
  | "approved"
  | "rejected"
  | "needs_resubmission";

type InsuranceStatus =
  | "uploaded"
  | "ai_pending"
  | "ai_reviewing"
  | "approved"
  | "rejected"
  | "expired"
  | "needs_resubmission";

type CertificateRowLike = {
  sport?: string;
  specialties?: Array<{
    sport: string;
    capabilityTags?: string[];
  }>;
  reviewStatus: CertificateStatus;
  issuerName?: string;
  certificateTitle?: string;
  uploadedAt: number;
  reviewedAt?: number;
};

type InsuranceRowLike = {
  reviewStatus: InsuranceStatus;
  issuerName?: string;
  policyNumber?: string;
  expiresOn?: string;
  expiresAt?: number;
  uploadedAt: number;
  reviewedAt?: number;
};

export function toComplianceDisplayLabel(value: string): string {
  if (isSportType(value)) {
    return toSportLabel(value);
  }
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getInstructorBlockingSummary(reasons: string[], t: TFunction): string {
  return reasons
    .map((reason) => {
      switch (reason) {
        case "identity_verification_required":
          return t("profile.compliance.blockers.identity");
        case "insurance_verification_required":
          return t("profile.compliance.blockers.insurance");
        case "sport_certificate_required":
          return t("profile.compliance.blockers.certificate");
        default:
          return reason;
      }
    })
    .join(" · ");
}

export function getStudioBlockingSummary(reasons: string[], t: TFunction): string {
  return reasons
    .map((reason) => {
      switch (reason) {
        case "owner_identity_required":
          return t("profile.studioCompliance.blockers.identity");
        case "business_profile_required":
          return t("profile.studioCompliance.blockers.billing");
        case "payment_method_required":
          return t("profile.studioCompliance.blockers.payment");
        default:
          return reason;
      }
    })
    .join(" · ");
}

export function getComplianceDocumentValue(
  reviewStatus: CertificateStatus | InsuranceStatus | undefined,
  t: TFunction,
): string {
  if (reviewStatus === "approved") {
    return t("profile.compliance.values.approved");
  }
  if (
    reviewStatus === "uploaded" ||
    reviewStatus === "ai_pending" ||
    reviewStatus === "ai_reviewing"
  ) {
    return t("profile.compliance.values.pending");
  }
  return t("profile.compliance.values.actionRequired");
}

export function getLatestCertificate<T extends CertificateRowLike>(rows: T[]): T | null {
  if (rows.length === 0) {
    return null;
  }
  return [...rows].sort(
    (left, right) => (right.reviewedAt ?? right.uploadedAt) - (left.reviewedAt ?? left.uploadedAt),
  )[0] ?? null;
}

export function getLatestCertificateForSport<T extends CertificateRowLike>(
  rows: T[],
  sport: string,
): T | null {
  const matchingRows = rows.filter((row) => {
    const specialties =
      row.specialties?.map((specialty) => specialty.sport) ?? (row.sport ? [row.sport] : []);
    return specialties.includes(sport);
  });

  if (matchingRows.length === 0) {
    return null;
  }

  return [...matchingRows].sort((left, right) => {
    const leftPriority = left.reviewStatus === "approved" ? 1 : 0;
    const rightPriority = right.reviewStatus === "approved" ? 1 : 0;
    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }
    return (right.reviewedAt ?? right.uploadedAt) - (left.reviewedAt ?? left.uploadedAt);
  })[0] ?? null;
}

export function getPreferredInsurancePolicy<T extends InsuranceRowLike>(rows: T[], now: number): T | null {
  if (rows.length === 0) {
    return null;
  }

  return [...rows].sort((left, right) => {
    const leftActiveApproved =
      left.reviewStatus === "approved" && (!left.expiresAt || left.expiresAt > now) ? 1 : 0;
    const rightActiveApproved =
      right.reviewStatus === "approved" && (!right.expiresAt || right.expiresAt > now) ? 1 : 0;
    if (leftActiveApproved !== rightActiveApproved) {
      return rightActiveApproved - leftActiveApproved;
    }
    return (right.reviewedAt ?? right.uploadedAt) - (left.reviewedAt ?? left.uploadedAt);
  })[0] ?? null;
}

function formatDate(value: number | undefined, locale: string) {
  if (!value) {
    return null;
  }
  return new Date(value).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getInsuranceSubtitle(
  row: InsuranceRowLike | null,
  locale: string,
  t: TFunction,
): string {
  if (!row) {
    return t("profile.compliance.insurance.missingBody");
  }

  const expiresLabel = formatDate(row.expiresAt, locale);
  switch (row.reviewStatus) {
    case "approved":
      return expiresLabel
        ? t("profile.compliance.insurance.approvedWithDate", { date: expiresLabel })
        : t("profile.compliance.insurance.approvedBody");
    case "expired":
      return expiresLabel
        ? t("profile.compliance.insurance.expiredWithDate", { date: expiresLabel })
        : t("profile.compliance.insurance.expiredBody");
    case "uploaded":
    case "ai_pending":
    case "ai_reviewing":
      return t("profile.compliance.insurance.pendingBody");
    case "rejected":
    case "needs_resubmission":
      return t("profile.compliance.insurance.reuploadBody");
    default:
      return t("profile.compliance.insurance.missingBody");
  }
}

export function getCertificateSubtitle(
  row: CertificateRowLike | null,
  locale: string,
  t: TFunction,
): string {
  if (!row) {
    return t("profile.compliance.certificate.missingBody");
  }

  const reviewedAt = formatDate(row.reviewedAt, locale);
  const coverage = (
    row.specialties?.map((specialty) => specialty.sport) ?? (row.sport ? [row.sport] : [])
  )
    .map((sport) => (isSportType(sport) ? toSportLabel(sport) : sport))
    .join(", ");

  switch (row.reviewStatus) {
    case "approved": {
      const source = [row.certificateTitle, row.issuerName].filter(Boolean).join(" · ");
      const summary = [coverage, source].filter(Boolean).join(" · ");
      if (summary) {
        return reviewedAt
          ? t("profile.compliance.certificate.approvedWithSourceAndDate", {
              source: summary,
              date: reviewedAt,
            })
          : t("profile.compliance.certificate.approvedWithSource", {
              source: summary,
            });
      }
      return reviewedAt
        ? t("profile.compliance.certificate.approvedWithDate", { date: reviewedAt })
        : t("profile.compliance.certificate.approvedBody");
    }
    case "uploaded":
    case "ai_pending":
    case "ai_reviewing":
      return t("profile.compliance.certificate.pendingBody");
    case "rejected":
    case "needs_resubmission":
      return t("profile.compliance.certificate.reuploadBody");
    default:
      return t("profile.compliance.certificate.missingBody");
  }
}

export function getStudioPaymentSubtitle(
  args: {
    status: "missing" | "pending" | "ready" | "failed";
    paymentReadinessSource?: "payment_profile" | "legacy_env";
  },
  t: TFunction,
): string {
  if (args.status !== "ready" && args.paymentReadinessSource === "legacy_env") {
    return t("onboarding.verification.studioPaymentGroundwork");
  }

  switch (args.status) {
    case "ready":
      return t("profile.studioCompliance.payment.readyBody");
    case "failed":
      return t("profile.studioCompliance.payment.failedBody");
    case "pending":
      return t("profile.studioCompliance.payment.pendingBody");
    default:
      return t("profile.studioCompliance.payment.missingBody");
  }
}
