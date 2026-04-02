import type { TFunction } from "i18next";
import { getInstructorJobPresentation } from "./instructor-job-presentation";
import {
  formatCompactDateTime,
  formatDateWithWeekday,
  formatTime,
  getApplicationStatusTranslationKey,
  getJobStatusToneWithReason,
  getJobStatusTranslationKey,
  type JobStatusTone,
} from "@/lib/jobs-utils";
import type { InstructorMarketplaceJob } from "./instructor-marketplace-job";

export type JobDetailBadgeTone = "primary" | "secondary" | "muted" | "success" | "warning";

export type InstructorJobDetailBadge = {
  key: string;
  label: string;
  tone: JobDetailBadgeTone;
};

export type InstructorJobDetailItem = {
  key: string;
  label: string;
  value: string;
  supportingText?: string;
};

export type InstructorJobDetailSection = {
  key: string;
  title: string;
  items: InstructorJobDetailItem[];
};

export type InstructorJobDetailViewModel = {
  eyebrow: string;
  title: string;
  badges: InstructorJobDetailBadge[];
  sections: InstructorJobDetailSection[];
  notes: {
    title: string;
    body: string;
  };
};

function createDetailItem({
  key,
  label,
  value,
  supportingText,
}: {
  key: string;
  label: string;
  value: string;
  supportingText?: string | undefined;
}): InstructorJobDetailItem {
  return {
    key,
    label,
    value,
    ...(supportingText ? { supportingText } : {}),
  };
}

function mapStatusToneToBadgeTone(tone: JobStatusTone): JobDetailBadgeTone {
  if (tone === "success") return "success";
  if (tone === "amber") return "warning";
  if (tone === "gray" || tone === "muted") return "muted";
  return "primary";
}

function formatParticipantSummary(job: InstructorMarketplaceJob, t: TFunction) {
  if (job.maxParticipants) {
    return t("jobsTab.detail.participantsCount", { count: job.maxParticipants });
  }

  return t("jobsTab.detail.noParticipantLimit");
}

function formatCancellationWindow(
  hours: number | undefined,
  t: TFunction,
) {
  if (typeof hours !== "number" || !Number.isFinite(hours)) {
    return t("jobsTab.detail.noCancellationWindow");
  }

  return t("jobsTab.detail.cancellationWindowValue", { count: hours });
}

export function createInstructorJobDetailViewModel({
  job,
  studioName,
  locale,
  now,
  t,
}: {
  job: InstructorMarketplaceJob;
  studioName: string;
  locale: string;
  now: number;
  t: TFunction;
}): InstructorJobDetailViewModel {
  const timeZone = job.timeZone;
  const presentation = getInstructorJobPresentation({
    job,
    locale,
    now,
    zoneLanguage: locale.toLowerCase().startsWith("he") ? "he" : "en",
  });
  const scheduleLabel = `${formatDateWithWeekday(job.startTime, locale, timeZone)} · ${formatTime(job.startTime, locale, timeZone)} - ${formatTime(job.endTime, locale, timeZone)}`;
  const postedLabel =
    typeof job.postedAt === "number"
      ? formatCompactDateTime(job.postedAt, locale, timeZone)
      : t("jobsTab.detail.unavailable");
  const expiry = presentation.expiry;
  const boost = presentation.boost;

  const badges: InstructorJobDetailBadge[] = [];

  if (job.status) {
    badges.push({
      key: "job-status",
      label: t(getJobStatusTranslationKey(job.status, job.closureReason)),
      tone: mapStatusToneToBadgeTone(getJobStatusToneWithReason(job.status, job.closureReason)),
    });
  }

  if (job.applicationStatus) {
    badges.push({
      key: "application-status",
      label: t(getApplicationStatusTranslationKey(job.applicationStatus)),
      tone:
        job.applicationStatus === "accepted"
          ? "success"
          : job.applicationStatus === "pending"
            ? "secondary"
            : "muted",
    });
  }

  if (boost.bonusAmount) {
    badges.push({
      key: "boost",
      label: t("jobsTab.detail.boostValue", { bonus: boost.bonusAmount }),
      tone: "warning",
    });
  }

  return {
    eyebrow: t("jobsTab.detail.sectionEyebrow"),
    title: presentation.sportLabel,
    badges,
    sections: [
      {
        key: "core",
        title: t("jobsTab.detail.core"),
        items: [
          createDetailItem({
            key: "sport",
            label: t("jobsTab.detail.sport"),
            value: presentation.sportLabel,
          }),
          createDetailItem({
            key: "studio",
            label: t("jobsTab.detail.studio"),
            value: studioName,
          }),
          createDetailItem({
            key: "location",
            label: t("jobsTab.detail.location"),
            value: job.branchName,
            supportingText: job.branchAddress ?? job.studioAddress,
          }),
        ],
      },
      {
        key: "schedule",
        title: t("jobsTab.detail.schedule"),
        items: [
          createDetailItem({
            key: "lesson-time",
            label: t("jobsTab.detail.lessonTime"),
            value: scheduleLabel,
            supportingText: timeZone
              ? t("jobsTab.detail.timeZoneValue", { timeZone })
              : undefined,
          }),
          createDetailItem({
            key: "application-deadline",
            label: t("jobsTab.detail.applicationDeadline"),
            value: expiry
              ? t(expiry.key, expiry.interpolation)
              : t("jobsTab.detail.noApplicationDeadline"),
            supportingText: expiry?.exactText,
          }),
          createDetailItem({
            key: "cancellation-window",
            label: t("jobsTab.detail.cancellationWindow"),
            value: formatCancellationWindow(job.cancellationDeadlineHours, t),
          }),
          createDetailItem({
            key: "posted-at",
            label: t("jobsTab.detail.posted"),
            value: postedLabel,
          }),
        ],
      },
      {
        key: "pay",
        title: t("jobsTab.detail.pay"),
        items: [
          createDetailItem({
            key: "total-pay",
            label: t("jobsTab.detail.totalPay"),
            value: `₪${Math.round(boost.totalPay)}`,
            supportingText:
              boost.bonusAmount && boost.totalPay !== job.pay
                ? `${t("jobsTab.detail.basePay")}: ₪${Math.round(job.pay)}`
                : undefined,
          }),
          createDetailItem({
            key: "boost-pay",
            label: t("jobsTab.detail.boost"),
            value: boost.bonusAmount
              ? t("jobsTab.detail.boostValue", { bonus: boost.bonusAmount })
              : t("jobsTab.detail.noBoost"),
          }),
        ],
      },
      {
        key: "setup",
        title: t("jobsTab.detail.lessonSetup"),
        items: [
          createDetailItem({
            key: "participants",
            label: t("jobsTab.detail.participants"),
            value: formatParticipantSummary(job, t),
          }),
          createDetailItem({
            key: "language",
            label: t("jobsTab.detail.language"),
            value: job.sessionLanguage ?? t("jobsTab.detail.notSpecified"),
          }),
          createDetailItem({
            key: "equipment",
            label: t("jobsTab.detail.equipment"),
            value: job.equipmentProvided
              ? t("jobsTab.detail.equipmentProvided")
              : t("jobsTab.detail.equipmentNotListed"),
          }),
          createDetailItem({
            key: "recurring",
            label: t("jobsTab.detail.recurring"),
            value: job.isRecurring
              ? t("jobsTab.detail.recurringYes")
              : t("jobsTab.detail.recurringNo"),
          }),
          createDetailItem({
            key: "required-level",
            label: t("jobsTab.detail.requiredLevel"),
            value: job.requiredLevel ?? t("jobsTab.detail.notSpecified"),
          }),
        ],
      },
    ],
    notes: {
      title: t("jobsTab.detail.notes"),
      body: job.note?.trim() || t("jobsTab.noNotes"),
    },
  };
}
