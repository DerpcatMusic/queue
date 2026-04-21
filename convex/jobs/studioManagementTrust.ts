import type { QueryCtx } from "../_generated/server";
import { getInstructorTrustSnapshot } from "../lib/instructorCompliance";

export async function loadInstructorTrustAssets(
  ctx: Pick<QueryCtx, "db" | "storage">,
  studioApplications: any[],
) {
  const instructorIds = [
    ...new Set(studioApplications.map((application: any) => application.instructorId)),
  ];
  const profiles = await Promise.all(
    instructorIds.map((instructorId: any) => ctx.db.get("instructorProfiles", instructorId)),
  );

  const profileById = new Map<string, any>();
  for (let i = 0; i < instructorIds.length; i += 1) {
    const instructorId = instructorIds[i];
    const profile = profiles[i];
    if (profile) {
      profileById.set(String(instructorId), profile);
    }
  }

  const profileImageUrlById = new Map<string, string | undefined>();
  for (const profile of profiles) {
    if (!profile) continue;
    const imageUrl = profile.profileImageStorageId
      ? ((await ctx.storage.getUrl(profile.profileImageStorageId)) ?? undefined)
      : undefined;
    profileImageUrlById.set(String(profile._id), imageUrl);
  }

  const trustByInstructorId = new Map<
    string,
    Awaited<ReturnType<typeof getInstructorTrustSnapshot>>
  >();
  const now = Date.now();
  await Promise.all(
    profiles.map(async (profile) => {
      if (!profile) return;
      trustByInstructorId.set(
        String(profile._id),
        await getInstructorTrustSnapshot(ctx as QueryCtx, { instructor: profile, now }),
      );
    }),
  );

  return { profileById, profileImageUrlById, trustByInstructorId };
}
