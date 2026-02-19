import type { Id } from "@/convex/_generated/dataModel";

export type JobsRole = "studio" | "instructor";

export type JobsStatusMessage = {
  kind: "error" | "success";
  text: string;
};

export type JobCardItem = {
  id: Id<"jobs">;
  title: string;
  notes?: string;
  zoneId: string;
  startsAt: number;
  durationMinutes: number;
  payNis: number;
  status: "open" | "claimed" | "cancelled" | "expired" | "completed";
  createdAt: number;
  expiresAt: number;
};

export type StudioJobDraft = {
  title: string;
  notes: string;
  startsInMinutes: string;
  durationMinutes: string;
  payNis: string;
  ttlMinutes: string;
};

export type JobsScreenProps = {
  role: JobsRole;
  jobs: JobCardItem[];
  isLoadingJobs: boolean;
  isSubmitting: boolean;
  claimingJobId: Id<"jobs"> | null;
  draft: StudioJobDraft;
  statusMessage: JobsStatusMessage | null;
  onDraftChange: <K extends keyof StudioJobDraft>(
    key: K,
    value: StudioJobDraft[K],
  ) => void;
  onSubmitStudioJob: () => void;
  onClaimJob: (jobId: Id<"jobs">) => void;
  onDismissMessage: () => void;
};
