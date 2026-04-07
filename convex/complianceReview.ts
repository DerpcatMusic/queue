"use node";

import { ConvexError, v } from "convex/values";
import { Resend as ResendApi } from "resend";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { geminiReviewRateLimiter } from "./components";
import {
  isCapabilityTag,
  isSportType,
  SPORT_TYPES,
  toCapabilityTagLabel,
  toSportLabel,
} from "./constants";
import { sendResendEmailWithDevFallback } from "./lib/resendDevRouting";

const GEMINI_BASE_URL = (
  process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com"
).replace(/\/+$/, "");
const GEMINI_COMPLIANCE_MODEL = process.env.GEMINI_COMPLIANCE_MODEL?.trim() || "gemini-2.5-flash";
const DAY_MS = 24 * 60 * 60 * 1000;

type GeminiUploadedFile = {
  name?: string;
  uri?: string;
  mimeType?: string;
  state?: string | { name?: string };
};

type CertificateReviewResult = {
  approved: boolean;
  specialties: Array<{
    sport: string;
    capabilityTags?: string[];
  }>;
  issuerName: string;
  certificateTitle: string;
  completedOn: string;
  summary: string;
  rejectionReasons: string[];
};

type InsuranceReviewResult = {
  approved: boolean;
  issuerName: string;
  /** The name of the person who is the policy holder (the insured instructor) */
  policyHolderName: string;
  policyNumber: string;
  expiresOn: string;
  summary: string;
  rejectionReasons: string[];
};

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new ConvexError("GEMINI_API_KEY is not configured");
  }
  return apiKey;
}

function getAuthEmailFrom() {
  return process.env.AUTH_EMAIL_FROM?.trim() || "Queue <onboarding@resend.dev>";
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function normalizeSpecialties(values: unknown) {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: Array<{
    sport: (typeof SPORT_TYPES)[number];
    capabilityTags?: string[];
  }> = [];

  for (const value of values) {
    if (!value || typeof value !== "object") {
      continue;
    }
    const sport = (value as { sport?: unknown }).sport;
    if (typeof sport !== "string" || !isSportType(sport.trim())) {
      continue;
    }
    const normalizedSport = sport.trim() as (typeof SPORT_TYPES)[number];
    const capabilityTags = normalizeStringArray(
      (value as { capabilityTags?: unknown }).capabilityTags,
    )
      .map((tag) => tag.toLowerCase().replace(/[^a-z0-9]+/g, "_"))
      .filter(isCapabilityTag);
    const dedupedTags = capabilityTags.length > 0 ? [...new Set(capabilityTags)] : undefined;
    const key = `${normalizedSport}::${(dedupedTags ?? []).join(",")}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push({
      sport: normalizedSport,
      ...(dedupedTags ? { capabilityTags: dedupedTags } : {}),
    });
  }

  return normalized;
}

function parseStructuredPartText(responseJson: unknown) {
  const text = (responseJson as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new ConvexError("Gemini review returned no structured content");
  }
  return text;
}

function parseIsoDateToExpiryMs(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoMatch) {
    return undefined;
  }

  const [, yearText, monthText, dayText] = isoMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return undefined;
  }

  return Date.UTC(year, month - 1, day, 23, 59, 59, 999);
}

async function uploadFileToGemini(args: {
  apiKey: string;
  bytes: ArrayBuffer;
  mimeType: string;
  displayName: string;
}): Promise<GeminiUploadedFile> {
  const startResponse = await fetch(`${GEMINI_BASE_URL}/upload/v1beta/files?key=${args.apiKey}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(args.bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": args.mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file: {
        display_name: args.displayName,
      },
    }),
  });

  if (!startResponse.ok) {
    throw new ConvexError(`Gemini file upload start failed (${startResponse.status})`);
  }

  const uploadUrl = startResponse.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    throw new ConvexError("Gemini file upload URL was missing");
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(args.bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: Buffer.from(args.bytes),
  });

  if (!uploadResponse.ok) {
    throw new ConvexError(`Gemini file upload finalize failed (${uploadResponse.status})`);
  }

  const uploadJson = (await uploadResponse.json()) as {
    file?: GeminiUploadedFile;
  };
  if (!uploadJson.file?.uri || !uploadJson.file?.mimeType || !uploadJson.file?.name) {
    throw new ConvexError("Gemini file upload returned incomplete metadata");
  }

  return uploadJson.file;
}

async function deleteGeminiFile(apiKey: string, fileName: string | undefined) {
  if (!fileName) {
    return;
  }
  await fetch(`${GEMINI_BASE_URL}/v1beta/${fileName}?key=${apiKey}`, {
    method: "DELETE",
  }).catch(() => undefined);
}

async function generateStructuredGeminiReview<T>(args: {
  apiKey: string;
  file: GeminiUploadedFile;
  prompt: string;
  responseSchema: Record<string, unknown>;
}): Promise<T> {
  const response = await fetch(
    `${GEMINI_BASE_URL}/v1beta/models/${GEMINI_COMPLIANCE_MODEL}:generateContent?key=${args.apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: args.prompt },
              {
                file_data: {
                  mime_type: args.file.mimeType,
                  file_uri: args.file.uri,
                },
              },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: "application/json",
          response_schema: args.responseSchema,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new ConvexError(`Gemini review request failed (${response.status})`);
  }

  const responseJson = await response.json();
  return JSON.parse(parseStructuredPartText(responseJson)) as T;
}

function buildCertificatePrompt(args: {
  instructorDisplayName: string;
  nowIsoDate: string;
  diditLegalName?: string;
  declaredSport?: string;
}) {
  return [
    "You are validating a sports instructor teaching certificate for marketplace compliance.",
    `Today's date: ${args.nowIsoDate}.`,
    `Instructor display name: ${args.instructorDisplayName}.`,
    args.diditLegalName ? `Instructor legal name from Didit: ${args.diditLegalName}.` : null,
    args.declaredSport ? `User-selected sport hint: ${args.declaredSport}.` : null,
    `Allowed sport keys: ${SPORT_TYPES.map((sport) => `${sport} = ${toSportLabel(sport)}`).join("; ")}.`,
    "Approve only if the document clearly appears to be a legitimate certificate or diploma allowing this person to teach one or more sports.",
    "Check whether the name on the document reasonably matches the instructor, the issuing organization is present, the certificate title is visible, and the covered sports can be inferred from the document.",
    "Also extract the date the instructor completed their certification course (completedOn). Return in ISO format YYYY-MM-DD if visible. Return empty string if not found.",
    "Return specialties as objects shaped like { sport, capabilityTags } using only allowed sport keys.",
    "Use capabilityTags only when the certificate clearly supports a narrower apparatus or modality, such as cadillac, tower, wunda_chair, trx, pads, heavy_bag, aerial_hammock, rehab, prenatal, or postnatal.",
    "If a certificate supports a sport but no narrower capability tags are clear, return that specialty with an empty or omitted capabilityTags array.",
    "Return JSON only.",
    "Use an empty string when issuerName or certificateTitle are unclear.",
    "Use rejectionReasons to explain what is missing or why the document should not be approved.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildInsurancePrompt(args: {
  diditLegalName?: string;
  instructorDisplayName: string;
  nowIsoDate: string;
}) {
  return [
    "You are validating proof of active third-party liability insurance for a sports instructor in Israel.",
    `Today's date: ${args.nowIsoDate}.`,
    `Instructor display name: ${args.instructorDisplayName}.`,
    args.diditLegalName ? `Instructor legal name from Didit: ${args.diditLegalName}.` : null,
    "Approve only if the document clearly appears to show an active insurance policy for the instructor.",
    "The document must include an expiry date. Return expiresOn in ISO format YYYY-MM-DD when visible.",
    "Also extract the name of the insurance company (issuerName) and the name of the policy holder / insured person (policyHolderName).",
    "If the insured person does not reasonably match the instructor, or if expiry is missing or already past, do not approve.",
    "Return JSON only.",
    "Use an empty string when issuerName, policyNumber, or policyHolderName are unclear.",
    "Use rejectionReasons to explain what is missing or why the document should not be approved.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildCertificateReviewSchema() {
  return {
    type: "OBJECT",
    properties: {
      approved: { type: "BOOLEAN" },
      specialties: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            sport: { type: "STRING" },
            capabilityTags: {
              type: "ARRAY",
              items: { type: "STRING" },
            },
          },
          required: ["sport"],
        },
      },
      issuerName: { type: "STRING" },
      certificateTitle: { type: "STRING" },
      /** ISO date string YYYY-MM-DD when the instructor completed the certification course */
      completedOn: { type: "STRING" },
      summary: { type: "STRING" },
      rejectionReasons: {
        type: "ARRAY",
        items: { type: "STRING" },
      },
    },
    required: [
      "approved",
      "specialties",
      "issuerName",
      "certificateTitle",
      "completedOn",
      "summary",
      "rejectionReasons",
    ],
  };
}

function buildInsuranceReviewSchema() {
  return {
    type: "OBJECT",
    properties: {
      approved: { type: "BOOLEAN" },
      issuerName: { type: "STRING" },
      /** Name of the policy holder / insured person */
      policyHolderName: { type: "STRING" },
      policyNumber: { type: "STRING" },
      expiresOn: { type: "STRING" },
      summary: { type: "STRING" },
      rejectionReasons: {
        type: "ARRAY",
        items: { type: "STRING" },
      },
    },
    required: [
      "approved",
      "issuerName",
      "policyHolderName",
      "policyNumber",
      "expiresOn",
      "summary",
      "rejectionReasons",
    ],
  };
}

/**
 * Fetch a compliance document from Convex storage with SHA256 integrity verification.
 *
 * Convex storage serves files with an HTTP Digest header containing the SHA256
 * of the stored bytes (e.g., `Digest: sha-256=<hex>`). We verify this header
 * matches the downloaded content to detect any corruption or tampering that
 * may have occurred between upload and AI review.
 *
 * Note: Convex already verifies SHA256 at upload time, but we re-verify at
 * read time as a defense-in-depth measure.
 */
async function fetchAndVerifyDocumentBytes(storageUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(storageUrl);
  if (!response.ok) {
    throw new ConvexError(`Failed to fetch stored compliance file (${response.status})`);
  }
  const bytes = await response.arrayBuffer();

  // Verify SHA256 integrity using the Digest header Convex includes in the response
  const digestHeader = response.headers.get("digest");
  if (digestHeader) {
    // Digest header format: "sha-256=<hex>" or "SHA-256=<hex>"
    const match = digestHeader.match(/sha-256=([a-fA-F0-9]{64})/i);
    if (match && match[1]) {
      const storedHash = match[1].toLowerCase();
      // Compute SHA-256 of downloaded bytes
      const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
      const downloadedHash = Buffer.from(hashBuffer).toString("hex");
      if (downloadedHash !== storedHash) {
        throw new ConvexError(
          `Document integrity check failed: SHA256 mismatch. ` +
            `Expected ${storedHash}, got ${downloadedHash}. The uploaded document may have been corrupted or tampered with.`,
        );
      }
    }
  }

  return bytes;
}

async function sendComplianceEmail(args: {
  to?: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !args.to) {
    return false;
  }

  const resend = new ResendApi(apiKey);
  await sendResendEmailWithDevFallback({
    resend,
    from: getAuthEmailFrom(),
    originalTo: args.to,
    subject: args.subject,
    text: args.text,
    ...(args.html ? { html: args.html } : {}),
  });
  return true;
}

export const reviewInstructorCertificate = internalAction({
  args: {
    certificateId: v.id("instructorCertificates"),
  },
  returns: v.object({
    ok: v.boolean(),
    status: v.string(),
  }),
  handler: async (ctx, args): Promise<{ ok: boolean; status: string }> => {
    let apiKey: string | undefined;
    let geminiFileName: string | undefined;
    try {
      apiKey = getGeminiApiKey();

      // Get review context first — needed for rate limiting key
      const reviewContext = await ctx.runQuery(
        internal.compliance.getInstructorCertificateReviewContext,
        {
          certificateId: args.certificateId,
        },
      );
      if (!reviewContext) {
        return { ok: false, status: "missing" };
      }

      // Rate limit: prevent runaway uploads from exhausting Gemini quota
      await geminiReviewRateLimiter.limit(ctx, "instructorReview", {
        key: String(reviewContext.instructorId),
        throws: true,
      });

      // Mark as ai_reviewing only after passing rate limit
      await ctx.runMutation(internal.compliance.markInstructorCertificateReviewProgress, {
        certificateId: args.certificateId,
        reviewStatus: "ai_reviewing",
        reviewProvider: "gemini",
        reviewSummary: "Automatic review started.",
      });

      const bytes = await fetchAndVerifyDocumentBytes(reviewContext.storageUrl);
      const uploadedFile = await uploadFileToGemini({
        apiKey,
        bytes,
        mimeType: reviewContext.mimeType ?? "application/pdf",
        displayName: reviewContext.fileName ?? `certificate-${String(reviewContext.certificateId)}`,
      });
      geminiFileName = uploadedFile.name;

      const parsed = await generateStructuredGeminiReview<CertificateReviewResult>({
        apiKey,
        file: uploadedFile,
        prompt: buildCertificatePrompt({
          instructorDisplayName: reviewContext.instructorDisplayName,
          nowIsoDate: new Date().toISOString().slice(0, 10),
          ...(reviewContext.declaredSport ? { declaredSport: reviewContext.declaredSport } : {}),
          ...(reviewContext.diditLegalName ? { diditLegalName: reviewContext.diditLegalName } : {}),
        }),
        responseSchema: buildCertificateReviewSchema(),
      });

      const rejectionReasons = normalizeStringArray(parsed.rejectionReasons);
      const specialties = normalizeSpecialties(parsed.specialties);
      const approved: boolean = parsed.approved === true && specialties.length > 0;
      const issuerName = normalizeOptionalText(parsed.issuerName);
      const certificateTitle = normalizeOptionalText(parsed.certificateTitle);
      const reviewSummary = normalizeOptionalText(parsed.summary);
      const completedAt = parseIsoDateToExpiryMs(parsed.completedOn);

      await ctx.runMutation(internal.compliance.applyInstructorCertificateReviewDecision, {
        certificateId: args.certificateId,
        reviewStatus: approved ? "approved" : "rejected",
        reviewProvider: "gemini",
        rejectionReasons,
        reviewJson: JSON.stringify(parsed),
        specialties,
        ...(issuerName ? { issuerName } : {}),
        ...(certificateTitle ? { certificateTitle } : {}),
        ...(completedAt !== undefined ? { completedAt } : {}),
        ...(reviewSummary ? { reviewSummary } : {}),
      });

      await ctx.runMutation(internal.compliance.createInstructorComplianceNotification, {
        recipientUserId: reviewContext.recipientUserId,
        kind: approved ? "compliance_certificate_approved" : "compliance_certificate_rejected",
        title: approved ? "Certificate approved" : "Certificate needs attention",
        body: approved
          ? `Certificate approved for ${specialties
              .map((specialty) =>
                specialty.capabilityTags && specialty.capabilityTags.length > 0
                  ? `${toSportLabel(specialty.sport)} (${specialty.capabilityTags
                      .map((tag) => toCapabilityTagLabel(tag))
                      .join(", ")})`
                  : toSportLabel(specialty.sport),
              )
              .join(", ")}.`
          : "Your certificate was not approved yet. Upload a clearer or corrected document to continue.",
      });

      return { ok: true, status: approved ? "approved" : "rejected" };
    } catch (error) {
      await ctx.runMutation(internal.compliance.markInstructorCertificateReviewProgress, {
        certificateId: args.certificateId,
        reviewStatus: "ai_pending",
        reviewProvider: "gemini",
        reviewSummary:
          error instanceof Error && error.message
            ? `Automatic review retry needed: ${error.message}`
            : "Automatic review retry needed.",
      });
      return { ok: false, status: "retry_pending" };
    } finally {
      if (apiKey) {
        await deleteGeminiFile(apiKey, geminiFileName).catch(() => undefined);
      }
    }
  },
});

export const reviewInstructorInsurancePolicy = internalAction({
  args: {
    insurancePolicyId: v.id("instructorInsurancePolicies"),
  },
  returns: v.object({
    ok: v.boolean(),
    status: v.string(),
  }),
  handler: async (ctx, args): Promise<{ ok: boolean; status: string }> => {
    let apiKey: string | undefined;
    let geminiFileName: string | undefined;
    try {
      apiKey = getGeminiApiKey();

      const reviewContext = await ctx.runQuery(
        internal.compliance.getInstructorInsuranceReviewContext,
        {
          insurancePolicyId: args.insurancePolicyId,
        },
      );
      if (!reviewContext) {
        return { ok: false, status: "missing" };
      }

      // Rate limit: prevent runaway uploads from exhausting Gemini quota
      await geminiReviewRateLimiter.limit(ctx, "instructorReview", {
        key: String(reviewContext.instructorId),
        throws: true,
      });

      // Mark as ai_reviewing only after passing rate limit
      await ctx.runMutation(internal.compliance.markInstructorInsuranceReviewProgress, {
        insurancePolicyId: args.insurancePolicyId,
        reviewStatus: "ai_reviewing",
        reviewProvider: "gemini",
        reviewSummary: "Automatic review started.",
      });

      const bytes = await fetchAndVerifyDocumentBytes(reviewContext.storageUrl);
      const uploadedFile = await uploadFileToGemini({
        apiKey,
        bytes,
        mimeType: reviewContext.mimeType ?? "application/pdf",
        displayName:
          reviewContext.fileName ?? `insurance-${String(reviewContext.insurancePolicyId)}`,
      });
      geminiFileName = uploadedFile.name;

      const parsed = await generateStructuredGeminiReview<InsuranceReviewResult>({
        apiKey,
        file: uploadedFile,
        prompt: buildInsurancePrompt({
          instructorDisplayName: reviewContext.instructorDisplayName,
          nowIsoDate: new Date().toISOString().slice(0, 10),
          ...(reviewContext.diditLegalName ? { diditLegalName: reviewContext.diditLegalName } : {}),
        }),
        responseSchema: buildInsuranceReviewSchema(),
      });

      const expiresAt = parseIsoDateToExpiryMs(parsed.expiresOn);
      const rejectionReasons = normalizeStringArray(parsed.rejectionReasons);
      const approved: boolean =
        parsed.approved === true && typeof expiresAt === "number" && expiresAt > Date.now();
      const issuerName = normalizeOptionalText(parsed.issuerName);
      const policyNumber = normalizeOptionalText(parsed.policyNumber);
      const expiresOn = normalizeOptionalText(parsed.expiresOn);
      const reviewSummary = normalizeOptionalText(parsed.summary);
      const policyHolderName = normalizeOptionalText(parsed.policyHolderName);

      await ctx.runMutation(internal.compliance.applyInstructorInsuranceReviewDecision, {
        insurancePolicyId: args.insurancePolicyId,
        reviewStatus: approved ? "approved" : "rejected",
        reviewProvider: "gemini",
        rejectionReasons: approved
          ? rejectionReasons
          : rejectionReasons.length > 0
            ? rejectionReasons
            : ["Insurance proof is missing a valid future expiry date or could not be verified."],
        reviewJson: JSON.stringify(parsed),
        ...(issuerName ? { issuerName } : {}),
        ...(policyHolderName ? { policyHolderName } : {}),
        ...(policyNumber ? { policyNumber } : {}),
        ...(expiresOn ? { expiresOn } : {}),
        ...(typeof expiresAt === "number" ? { expiresAt } : {}),
        ...(reviewSummary ? { reviewSummary } : {}),
      });

      await ctx.runMutation(internal.compliance.createInstructorComplianceNotification, {
        recipientUserId: reviewContext.recipientUserId,
        kind: approved ? "compliance_insurance_approved" : "compliance_insurance_rejected",
        title: approved ? "Insurance approved" : "Insurance needs attention",
        body: approved
          ? `Insurance approved${parsed.expiresOn ? ` until ${parsed.expiresOn}` : ""}.`
          : "Your insurance document was not approved yet. Upload a valid active policy to continue.",
      });

      return { ok: true, status: approved ? "approved" : "rejected" };
    } catch (error) {
      await ctx.runMutation(internal.compliance.markInstructorInsuranceReviewProgress, {
        insurancePolicyId: args.insurancePolicyId,
        reviewStatus: "ai_pending",
        reviewProvider: "gemini",
        reviewSummary:
          error instanceof Error && error.message
            ? `Automatic review retry needed: ${error.message}`
            : "Automatic review retry needed.",
      });
      return { ok: false, status: "retry_pending" };
    } finally {
      if (apiKey) {
        await deleteGeminiFile(apiKey, geminiFileName).catch(() => undefined);
      }
    }
  },
});

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
      internal.compliance.listInsurancePoliciesForRenewalProcessing,
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
        await ctx.runMutation(internal.compliance.markInsuranceReminderEvent, {
          insurancePolicyId: row.insurancePolicyId,
          event: "expired_notice",
          at: now,
        });
        await ctx.runMutation(internal.compliance.createInstructorComplianceNotification, {
          recipientUserId: row.recipientUserId,
          kind: "compliance_insurance_expired",
          title: "Insurance expired",
          body: "Your insurance expired. Upload a new active policy to restore job actions.",
        });
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
        await ctx.runMutation(internal.compliance.markInsuranceReminderEvent, {
          insurancePolicyId: row.insurancePolicyId,
          event: "day_reminder",
          at: now,
        });
        await ctx.runMutation(internal.compliance.createInstructorComplianceNotification, {
          recipientUserId: row.recipientUserId,
          kind: "compliance_insurance_expiring",
          title: "Insurance expires tomorrow",
          body: "Your insurance expires within a day. Upload the next active policy now to avoid a lapse.",
        });
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
        await ctx.runMutation(internal.compliance.markInsuranceReminderEvent, {
          insurancePolicyId: row.insurancePolicyId,
          event: "month_reminder",
          at: now,
        });
        await ctx.runMutation(internal.compliance.createInstructorComplianceNotification, {
          recipientUserId: row.recipientUserId,
          kind: "compliance_insurance_expiring",
          title: "Insurance expires within a month",
          body: "Upload your next active insurance policy before it lapses and blocks job actions.",
        });
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
        await ctx.runMutation(internal.compliance.markInsuranceReminderEvent, {
          insurancePolicyId: row.insurancePolicyId,
          event: "week_reminder",
          at: now,
        });
        await ctx.runMutation(internal.compliance.createInstructorComplianceNotification, {
          recipientUserId: row.recipientUserId,
          kind: "compliance_insurance_expiring",
          title: "Insurance expires in 7 days",
          body: "Your insurance expires within a week. Upload the next active policy now.",
        });
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
        continue;
      }

      if (
        row.reviewStatus === "approved" &&
        daysUntilExpiry <= 1 &&
        daysUntilExpiry > 0 &&
        row.dayReminderSentAt === undefined
      ) {
        processed += 1;
        await ctx.runMutation(internal.compliance.markInsuranceReminderEvent, {
          insurancePolicyId: row.insurancePolicyId,
          event: "day_reminder",
          at: now,
        });
        await ctx.runMutation(internal.compliance.createInstructorComplianceNotification, {
          recipientUserId: row.recipientUserId,
          kind: "compliance_insurance_expiring",
          title: "Insurance expires tomorrow",
          body: "Your insurance expires in less than a day. Upload a renewed policy immediately.",
        });
        notified += 1;
        if (
          await sendComplianceEmail(
            row.email
              ? {
                  to: row.email,
                  subject: "Your Queue insurance expires tomorrow",
                  text: `Hi ${row.instructorDisplayName}, your insurance expires in less than a day. Upload a renewed policy in Queue immediately to avoid losing job actions.`,
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
