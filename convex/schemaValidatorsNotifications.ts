import { v } from "convex/values";
import {
  NOTIFICATION_INBOX_KINDS,
  NOTIFICATION_PREFERENCE_KEYS,
} from "./lib/notificationPreferences";

export const notificationPreferenceKeyValidator = v.union(
  ...NOTIFICATION_PREFERENCE_KEYS.map((key) => v.literal(key)),
);

export const notificationInboxKindValidator = v.union(
  ...NOTIFICATION_INBOX_KINDS.map((kind) => v.literal(kind)),
);

export const notificationScheduleStatusValidator = v.union(
  v.literal("scheduled"),
  v.literal("sent"),
  v.literal("cancelled"),
  v.literal("skipped"),
);
