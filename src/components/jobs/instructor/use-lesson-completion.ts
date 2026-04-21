import { useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { captureCurrentLocationSample, isLocationResolveError } from "@/lib/location-zone";

export function useLessonCompletion() {
  const { t } = useTranslation();
  const markLessonCompleted = useMutation(api.jobs.lessonCompletion.markLessonCompleted);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitLessonCompletion = useCallback(
    async (jobId: Id<"jobs">) => {
      if (isSubmitting) {
        return null;
      }

      setIsSubmitting(true);
      try {
        const sample = await captureCurrentLocationSample();
        await markLessonCompleted({
          jobId,
          checkoutLatitude: sample.latitude,
          checkoutLongitude: sample.longitude,
          checkoutAccuracyMeters: sample.accuracyMeters,
          checkoutSampledAt: sample.sampledAt,
        });

        Alert.alert(t("jobsTab.success.lessonCompleted"), t("jobsTab.checkout.completed"));
        return { ok: true as const };
      } catch (error) {
        const message = isLocationResolveError(error)
          ? error.message
          : error instanceof Error
            ? error.message
            : t("jobsTab.errors.failedToMarkLessonDone");
        Alert.alert(t("jobsTab.errors.failedToMarkLessonDone"), message);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, markLessonCompleted, t],
  );

  return {
    isSubmitting,
    submitLessonCompletion,
  };
}
