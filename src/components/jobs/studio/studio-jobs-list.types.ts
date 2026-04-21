import type { TFunction } from "i18next";
import type { Id } from "@/convex/_generated/dataModel";
import type { BoostPreset, JobClosureReason } from "@/lib/jobs-utils";
import type { PaymentStatus, PayoutStatus } from "@/lib/payments-utils";

export type StudioJobApplication = {
  applicationId: Id<"jobApplications">;
  instructorId: Id<"instructorProfiles">;
  instructorName: string;
  profileImageUrl?: string | null;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  appliedAt: number;
  message?: string | null;
  trust: {
    identityVerified: boolean;
    insuranceVerified: boolean;
    certificates: Array<{
      specialties: Array<{
        sport: string;
        capabilityTags?: string[];
      }>;
      issuerName?: string;
      certificateTitle?: string;
      verifiedAt?: number;
    }>;
  };
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
  boostTriggerMinutes?: number;
  applicationsCount: number;
  pendingApplicationsCount: number;
  applications: StudioJobApplication[];
  payment: {
    paymentId: Id<"paymentOrders">;
    status: PaymentStatus;
    payoutStatus: PayoutStatus | null;
  } | null;
};

export type StudioJobsListProps = {
  jobs: StudioJob[];
  locale: string;
  zoneLanguage: "en" | "he";
  reviewingApplicationId: Id<"jobApplications"> | null;
  payingJobId: Id<"jobs"> | null;
  onInstructorPress?: (instructorId: Id<"instructorProfiles">) => void;
  onReview: (applicationId: Id<"jobApplications">, status: "accepted" | "rejected") => void;
  onStartPayment: (jobId: Id<"jobs">) => void;
  onStartNativeWalletPayment: (jobId: Id<"jobs">) => void;
  onStartEmbeddedCheckout: (jobId: Id<"jobs">) => void;
  onJobPress: (jobId: Id<"jobs">) => void;
  t: TFunction;
};
