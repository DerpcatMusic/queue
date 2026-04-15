import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Redirect old /profiles/instructors/[instructorId] URLs to the new
 * public short-link URL /instructor/[slug].
 *
 * Old format: /profiles/instructors/2xpmv2a00q2q0q2q0q2q0q2q
 * New format: /instructor/daniel-smith-k4m7
 */
export default function InstructorProfileRedirectRoute() {
  const { instructorId } = useLocalSearchParams<{ instructorId: string }>();
  const router = useRouter();

  const redirect = useQuery(
    api.instructors.publicProfiles.getInstructorProfileRedirect,
    instructorId ? { instructorId: instructorId as Id<"instructorProfiles"> } : "skip",
  );

  useEffect(() => {
    if (redirect?.slug) {
      router.replace(`/instructor/${redirect.slug}`);
    }
  }, [redirect?.slug, router]);

  return null;
}
