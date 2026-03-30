export const NOTIFICATION_PREFERENCE_KEYS = [
  "job_offer",
  "insurance_renewal",
  "application_received",
  "application_updates",
  "lesson_reminder",
  "lesson_updates",
] as const;

export type NotificationPreferenceKey = (typeof NOTIFICATION_PREFERENCE_KEYS)[number];

export const NOTIFICATION_INBOX_KINDS = [
  "application_received",
  "application_accepted",
  "application_rejected",
  "lesson_started",
  "lesson_completed",
  "lesson_reminder",
  "compliance_certificate_approved",
  "compliance_certificate_rejected",
  "compliance_insurance_approved",
  "compliance_insurance_rejected",
  "compliance_insurance_expiring",
  "compliance_insurance_expired",
] as const;

export type NotificationInboxKind = (typeof NOTIFICATION_INBOX_KINDS)[number];

export const STUDIO_NOTIFICATION_PREFERENCE_KEYS = [
  "application_received",
  "lesson_reminder",
  "lesson_updates",
] as const satisfies readonly NotificationPreferenceKey[];

export const INSTRUCTOR_NOTIFICATION_PREFERENCE_KEYS = [
  "job_offer",
  "insurance_renewal",
  "application_updates",
  "lesson_reminder",
  "lesson_updates",
] as const satisfies readonly NotificationPreferenceKey[];

export const LESSON_REMINDER_MINUTES_OPTIONS = [15, 30, 45, 60] as const;

export const DEFAULT_LESSON_REMINDER_MINUTES =
  LESSON_REMINDER_MINUTES_OPTIONS[1];

export function mapNotificationKindToPreferenceKey(
  kind: NotificationInboxKind,
): NotificationPreferenceKey {
  switch (kind) {
    case "application_received":
      return "application_received";
    case "application_accepted":
    case "application_rejected":
      return "application_updates";
    case "lesson_reminder":
      return "lesson_reminder";
    case "lesson_started":
    case "lesson_completed":
      return "lesson_updates";
    case "compliance_insurance_expiring":
    case "compliance_insurance_expired":
    case "compliance_insurance_approved":
    case "compliance_insurance_rejected":
      return "insurance_renewal";
    case "compliance_certificate_approved":
    case "compliance_certificate_rejected":
      return "lesson_updates";
  }
}

export function getDefaultNotificationPreferencesForRole(
  role: "instructor" | "studio",
): Record<NotificationPreferenceKey, boolean> {
  const defaults: Record<NotificationPreferenceKey, boolean> = {
    job_offer: false,
    insurance_renewal: false,
    application_received: false,
    application_updates: false,
    lesson_reminder: false,
    lesson_updates: false,
  };

  const enabledKeys =
    role === "instructor"
      ? INSTRUCTOR_NOTIFICATION_PREFERENCE_KEYS
      : STUDIO_NOTIFICATION_PREFERENCE_KEYS;

  for (const key of enabledKeys) {
    defaults[key] = true;
  }

  return defaults;
}

export function getNotificationPreferenceKeysForRole(
  role: "instructor" | "studio",
): readonly NotificationPreferenceKey[] {
  return role === "instructor"
    ? INSTRUCTOR_NOTIFICATION_PREFERENCE_KEYS
    : STUDIO_NOTIFICATION_PREFERENCE_KEYS;
}
