import { useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  captureCurrentLocationSample,
  isLocationResolveError,
} from "@/lib/location-zone";

type LessonCheckInResult =
  | {
      status: "verified";
      reason: "verified";
      checkedInAt: number;
      distanceToBranchMeters?: number;
      allowedDistanceMeters?: number;
    }
  | {
      status: "rejected";
      reason:
        | "outside_radius"
        | "accuracy_too_low"
        | "sample_too_old"
        | "outside_check_in_window"
        | "branch_location_missing";
      checkedInAt: number;
      distanceToBranchMeters?: number;
      allowedDistanceMeters?: number;
    };

function getRejectedReasonMessage(
  reason: LessonCheckInResult["reason"],
  t: (key: string) => string,
) {
  switch (reason) {
    case "outside_radius":
      return t("calendarTab.card.checkInReasons.outside_radius");
    case "accuracy_too_low":
      return t("calendarTab.card.checkInReasons.accuracy_too_low");
    case "sample_too_old":
      return t("calendarTab.card.checkInReasons.sample_too_old");
    case "outside_check_in_window":
      return t("calendarTab.card.checkInReasons.outside_check_in_window");
    case "branch_location_missing":
      return t("calendarTab.card.checkInReasons.branch_location_missing");
    default:
      return t("calendarTab.card.checkInReasons.unknown");
  }
}

type UseLessonCheckInOptions = {
  onVerified?: ((result: Extract<LessonCheckInResult, { status: "verified" }>) => void) | undefined;
  onRejected?: ((result: Extract<LessonCheckInResult, { status: "rejected" }>) => void) | undefined;
  onError?: ((message: string) => void) | undefined;
  suppressAlerts?: boolean | undefined;
};

export function useLessonCheckIn(options?: UseLessonCheckInOptions) {
  const { t } = useTranslation();
  const checkIntoLesson = useMutation(api.jobs.checkIntoLesson);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitCheckIn = useCallback(
    async (jobId: Id<"jobs">) => {
      if (isSubmitting) {
        return null;
      }

      setIsSubmitting(true);
      try {
        const sample = await captureCurrentLocationSample();
        const result = (await checkIntoLesson({
          jobId,
          latitude: sample.latitude,
          longitude: sample.longitude,
          accuracyMeters: sample.accuracyMeters,
          sampledAt: sample.sampledAt,
        })) as LessonCheckInResult;

        if (result.status === "verified") {
          options?.onVerified?.(result);
          if (!options?.suppressAlerts) {
            Alert.alert(
              t("calendarTab.card.checkInVerifiedTitle"),
              t("calendarTab.card.checkInVerifiedBody", {
                distance: Math.max(0, Math.round(result.distanceToBranchMeters ?? 0)),
              }),
            );
          }
        } else {
          options?.onRejected?.(result);
          if (!options?.suppressAlerts) {
            Alert.alert(
              t("calendarTab.card.checkInRetryTitle"),
              getRejectedReasonMessage(result.reason, t),
            );
          }
        }

        return result;
      } catch (error) {
        const message =
          isLocationResolveError(error)
            ? error.message
            : error instanceof Error
              ? error.message
              : t("calendarTab.card.checkInReasons.unknown");
        options?.onError?.(message);
        if (!options?.suppressAlerts) {
          Alert.alert(t("calendarTab.card.checkInErrorTitle"), message);
        }
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [checkIntoLesson, isSubmitting, options, t],
  );

  return {
    isSubmitting,
    submitCheckIn,
  };
}
