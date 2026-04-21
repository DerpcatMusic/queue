"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { DAY_MS, sendComplianceEmail } from "./instructorReviewShared";

export const processInsuranceRenewalChecks = internalAction({
  args: {
    now: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    emailed: v.number(),
    notified: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const rows = await ctx.runQuery(
      internal.compliance.instructor.listInsurancePoliciesForRenewalProcessing,
      {},
    );
    const currentByInstructor = new Map<string, (typeof rows)[number]>();

    for (const row of rows) {
      const key = String(row.instructorId);
      const current = currentByInstructor.get(key);
      if (!current || row.expiresAt > current.expiresAt) {
        currentByInstructor.set(key, row);
      }
    }

    let processed = 0;
    let emailed = 0;
    let notified = 0;

    for (const row of currentByInstructor.values()) {
      if (row.reviewStatus !== "approved" && row.reviewStatus !== "expired") {
        continue;
      }

      const daysUntilExpiry = Math.ceil((row.expiresAt - now) / DAY_MS);
      if (
        row.reviewStatus === "approved" &&
        row.expiresAt <= now &&
        row.expiredNoticeSentAt === undefined
      ) {
        processed += 1;
        await ctx.runMutation(internal.compliance.instructor.markInsuranceReminderEvent, {
          insurancePolicyId: row.insurancePolicyId,
          event: "expired_notice",
          at: now,
        });
        await ctx.runMutation(
          internal.compliance.instructor.createInstructorComplianceNotification,
          {
            recipientUserId: row.recipientUserId,
            kind: "compliance_insurance_expired",
            title: "Insurance expired",
            body: "Your insurance expired. Upload a new active policy to restore job actions.",
          },
        );
        notified += 1;
        if (
          await sendComplianceEmail(
            row.email
              ? {
                  to: row.email,
                  subject: "Your Queue insurance document expired",
                  text: `Hi ${row.instructorDisplayName}, your insurance document has expired. Upload a new active policy in Queue to restore job actions.`,
                }
              : { subject: "", text: "" },
          )
        ) {
          emailed += 1;
        }
        continue;
      }

      if (
        row.reviewStatus === "approved" &&
        daysUntilExpiry <= 1 &&
        daysUntilExpiry > 0 &&
        row.dayReminderSentAt === undefined
      ) {
        processed += 1;
        await ctx.runMutation(internal.compliance.instructor.markInsuranceReminderEvent, {
          insurancePolicyId: row.insurancePolicyId,
          event: "day_reminder",
          at: now,
        });
        await ctx.runMutation(
          internal.compliance.instructor.createInstructorComplianceNotification,
          {
            recipientUserId: row.recipientUserId,
            kind: "compliance_insurance_expiring",
            title: "Insurance expires tomorrow",
            body: "Your insurance expires within a day. Upload the next active policy now to avoid a lapse.",
          },
        );
        notified += 1;
        if (
          await sendComplianceEmail(
            row.email
              ? {
                  to: row.email,
                  subject: "Your Queue insurance expires tomorrow",
                  text: `Hi ${row.instructorDisplayName}, your insurance expires in less than a day. Upload the next active policy in Queue now to avoid a lapse.`,
                }
              : { subject: "", text: "" },
          )
        ) {
          emailed += 1;
        }
        continue;
      }

      if (
        row.reviewStatus === "approved" &&
        daysUntilExpiry <= 30 &&
        daysUntilExpiry > 7 &&
        row.monthReminderSentAt === undefined
      ) {
        processed += 1;
        await ctx.runMutation(internal.compliance.instructor.markInsuranceReminderEvent, {
          insurancePolicyId: row.insurancePolicyId,
          event: "month_reminder",
          at: now,
        });
        await ctx.runMutation(
          internal.compliance.instructor.createInstructorComplianceNotification,
          {
            recipientUserId: row.recipientUserId,
            kind: "compliance_insurance_expiring",
            title: "Insurance expires within a month",
            body: "Upload your next active insurance policy before it lapses and blocks job actions.",
          },
        );
        notified += 1;
        if (
          await sendComplianceEmail(
            row.email
              ? {
                  to: row.email,
                  subject: "Your Queue insurance expires within a month",
                  text: `Hi ${row.instructorDisplayName}, your insurance expires in ${daysUntilExpiry} days. Upload the next active policy in Queue now so job actions stay unlocked.`,
                }
              : { subject: "", text: "" },
          )
        ) {
          emailed += 1;
        }
        continue;
      }

      if (
        row.reviewStatus === "approved" &&
        daysUntilExpiry <= 7 &&
        daysUntilExpiry > 1 &&
        row.weekReminderSentAt === undefined
      ) {
        processed += 1;
        await ctx.runMutation(internal.compliance.instructor.markInsuranceReminderEvent, {
          insurancePolicyId: row.insurancePolicyId,
          event: "week_reminder",
          at: now,
        });
        await ctx.runMutation(
          internal.compliance.instructor.createInstructorComplianceNotification,
          {
            recipientUserId: row.recipientUserId,
            kind: "compliance_insurance_expiring",
            title: "Insurance expires in 7 days",
            body: "Your insurance expires within a week. Upload the next active policy now.",
          },
        );
        notified += 1;
        if (
          await sendComplianceEmail(
            row.email
              ? {
                  to: row.email,
                  subject: "Your Queue insurance expires in 7 days",
                  text: `Hi ${row.instructorDisplayName}, your insurance expires in ${daysUntilExpiry} days. Upload the next active policy in Queue now so job actions stay unlocked.`,
                }
              : { subject: "", text: "" },
          )
        ) {
          emailed += 1;
        }
      }
    }

    return { processed, emailed, notified };
  },
});
