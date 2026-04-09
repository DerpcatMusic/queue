import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Redirect old /profiles/studios/[studioId] URLs to the new
 * public short-link URL /studio/[slug].
 */
export default function StudioProfileRedirectRoute() {
  const { studioId } = useLocalSearchParams<{ studioId: string }>();
  const router = useRouter();

  const redirect = useQuery(
    api.users.getStudioProfileRedirect,
    studioId ? { studioId: studioId as Id<"studioProfiles"> } : "skip",
  );

  useEffect(() => {
    if (redirect?.slug) {
      router.replace(`/studio/${redirect.slug}`);
    }
  }, [redirect?.slug, router]);

  return null;
}
