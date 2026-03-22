import type { TFunction } from "i18next";
import type { BrandPalette } from "@/constants/brand";
import type { Id } from "@/convex/_generated/dataModel";
import type { BoostPreset, JobClosureReason } from "@/lib/jobs-utils";
import type { PaymentStatus, PayoutStatus } from "@/lib/payments-utils";

export type StudioJobApplication = {
  applicationId: Id<"jobApplications">;
  instructorName: string;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  appliedAt: number;
  message?: string | null;
};

export type StudioJob = {
  jobId: Id<"jobs">;
  sport: string;
  status: "open" | "filled" | "cancelled" | "completed";
  zone: string;
  startTime: number;
  endTime: number;
  pay: number;
  applicationDeadline?: number;
  closureReason?: JobClosureReason;
  boostPreset?: BoostPreset;
  boostBonusAmount?: number;
  boostActive?: boolean;
  applicationsCount: number;
  pendingApplicationsCount: number;
  applications: StudioJobApplication[];
  payment: {
    paymentId: Id<"payments">;
    status: PaymentStatus;
    payoutStatus: PayoutStatus | null;
  } | null;
};

export type StudioJobsListProps = {
  jobs: StudioJob[];
  locale: string;
  zoneLanguage: "en" | "he";
  palette: BrandPalette;
  reviewingApplicationId: Id<"jobApplications"> | null;
  payingJobId: Id<"jobs"> | null;
  onReview: (applicationId: Id<"jobApplications">, status: "accepted" | "rejected") => void;
  onStartPayment: (jobId: Id<"jobs">) => void;
  t: TFunction;
};
