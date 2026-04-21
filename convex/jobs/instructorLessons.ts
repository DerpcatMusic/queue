import { v } from "convex/values";
import { query } from "../_generated/server";
import { loadLatestLessonCheckInSummary, requireInstructorProfile } from "./_helpers";
import { isPresent } from "./jobConstants";

export const getMyCurrentLessons = query({
  args: {
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      applicationId: v.id("jobApplications"),
      jobId: v.id("jobs"),
      studioId: v.id("studioProfiles"),
      branchId: v.id("studioBranches"),
      studioName: v.string(),
      branchName: v.string(),
      branchAddress: v.optional(v.string()),
      branchLatitude: v.optional(v.number()),
      branchLongitude: v.optional(v.number()),
      studioImageUrl: v.optional(v.string()),
      sport: v.string(),
      startTime: v.number(),
      endTime: v.number(),
      timeZone: v.optional(v.string()),
      status: v.union(
        v.literal("open"),
        v.literal("filled"),
        v.literal("cancelled"),
        v.literal("completed"),
      ),
      applicationStatus: v.literal("accepted"),
      checkedInAt: v.optional(v.number()),
      checkInStatus: v.optional(v.union(v.literal("verified"), v.literal("rejected"))),
      checkInReason: v.optional(
        v.union(
          v.literal("verified"),
          v.literal("outside_radius"),
          v.literal("accuracy_too_low"),
          v.literal("sample_too_old"),
          v.literal("outside_check_in_window"),
          v.literal("branch_location_missing"),
        ),
      ),
      distanceMeters: v.optional(v.number()),
      note: v.optional(v.string()),
      closureReason: v.optional(
        v.union(v.literal("expired"), v.literal("studio_cancelled"), v.literal("filled")),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const instructor = await requireInstructorProfile(ctx);
    const now = args.now ?? Date.now();
    const rawLimit = args.limit ?? 20;
    const limit = Math.min(Math.max(1, rawLimit), 50);

    const applications = await ctx.db
      .query("jobApplications")
      .withIndex("by_instructor_appliedAt", (q) => q.eq("instructorId", instructor._id))
      .order("desc")
      .take(200);

    const acceptedApplications = applications.filter(
      (application) => application.status === "accepted",
    );
    if (acceptedApplications.length === 0) {
      return [];
    }

    const acceptedJobIds = [
      ...new Set(acceptedApplications.map((application) => application.jobId)),
    ];
    const jobs = await Promise.all(acceptedJobIds.map((jobId) => ctx.db.get("jobs", jobId)));
    const jobById = new Map<string, NonNullable<(typeof jobs)[number]>>();
    for (let index = 0; index < acceptedJobIds.length; index += 1) {
      const job = jobs[index];
      if (job) {
        jobById.set(String(acceptedJobIds[index]), job);
      }
    }

    const studioIds = [...new Set(jobs.filter(isPresent).map((job) => job.studioId))];
    const branchIds = [...new Set(jobs.filter(isPresent).map((job) => job.branchId))];
    const latestCheckIns = await Promise.all(
      jobs.filter(isPresent).map((job) =>
        loadLatestLessonCheckInSummary(ctx, {
          jobId: job._id,
          instructorId: instructor._id,
        }),
      ),
    );
    const studios = await Promise.all(
      studioIds.map((studioId) => ctx.db.get("studioProfiles", studioId)),
    );
    const branches = await Promise.all(
      branchIds.map((branchId) => ctx.db.get("studioBranches", branchId)),
    );
    const studioImageUrls = await Promise.all(
      studios.map((studio) =>
        studio?.logoStorageId ? ctx.storage.getUrl(studio.logoStorageId) : null,
      ),
    );
    const studioById = new Map<string, NonNullable<(typeof studios)[number]>>();
    const branchById = new Map<string, NonNullable<(typeof branches)[number]>>();
    const studioImageUrlById = new Map<string, string>();
    for (let i = 0; i < studioIds.length; i += 1) {
      const studio = studios[i];
      if (studio) {
        studioById.set(String(studioIds[i]), studio);
      }
      const studioImageUrl = studioImageUrls[i];
      if (studioImageUrl) {
        studioImageUrlById.set(String(studioIds[i]), studioImageUrl);
      }
    }
    for (let i = 0; i < branchIds.length; i += 1) {
      const branch = branches[i];
      if (branch) {
        branchById.set(String(branchIds[i]), branch);
      }
    }
    const checkInByJobId = new Map<string, NonNullable<(typeof latestCheckIns)[number]>>();
    const presentJobs = jobs.filter(isPresent);
    for (let i = 0; i < presentJobs.length; i += 1) {
      const latestCheckIn = latestCheckIns[i];
      if (latestCheckIn) {
        checkInByJobId.set(String(presentJobs[i]!._id), latestCheckIn);
      }
    }

    const rows = acceptedApplications
      .map((application) => {
        const job = jobById.get(String(application.jobId));
        if (!job) return null;
        const studio = studioById.get(String(job.studioId));
        const branch = branchById.get(String(job.branchId));
        if (job.status === "cancelled" || job.status === "completed") {
          return null;
        }
        if (job.endTime < now - 24 * 60 * 60 * 1000) {
          return null;
        }

        return {
          applicationId: application._id,
          jobId: job._id,
          studioId: job.studioId,
          branchId: job.branchId,
          studioName: studio?.studioName ?? "Unknown studio",
          branchName: job.branchNameSnapshot ?? branch?.name ?? "Main branch",
          branchAddress: job.branchAddressSnapshot ?? branch?.address,
          branchLatitude: branch?.latitude,
          branchLongitude: branch?.longitude,
          studioImageUrl: studioImageUrlById.get(String(job.studioId)),
          sport: job.sport,
          startTime: job.startTime,
          endTime: job.endTime,
          timeZone: job.timeZone,
          status: job.status,
          applicationStatus: "accepted" as const,
          ...checkInByJobId.get(String(job._id)),
          note: job.note,
          closureReason: job.closureReason,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((left, right) => left.startTime - right.startTime);

    return rows.slice(0, limit);
  },
});
