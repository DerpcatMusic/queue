"use node";

import { ConvexError } from "convex/values";
import { Resend as ResendApi } from "resend";
import { isCapabilityTag, isSportType, SPORT_TYPES, toSportLabel } from "../constants";
import { sendResendEmailWithDevFallback } from "../lib/resendDevRouting";

export const GEMINI_BASE_URL = (
  process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com"
).replace(/\/+$/, "");
export const GEMINI_COMPLIANCE_MODEL =
  process.env.GEMINI_COMPLIANCE_MODEL?.trim() || "gemini-2.5-flash";
export const DAY_MS = 24 * 60 * 60 * 1000;

export type GeminiUploadedFile = {
  name?: string;
  uri?: string;
  mimeType?: string;
  state?: string | { name?: string };
};

export type CertificateReviewResult = {
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

export type InsuranceReviewResult = {
  approved: boolean;
  issuerName: string;
  policyHolderName: string;
  policyNumber: string;
  expiresOn: string;
  summary: string;
  rejectionReasons: string[];
};

export function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new ConvexError("GEMINI_API_KEY is not configured");
  }
  return apiKey;
}

export function getAuthEmailFrom() {
  return process.env.AUTH_EMAIL_FROM?.trim() || "Queue <onboarding@resend.dev>";
}

export function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function normalizeSpecialties(values: unknown) {
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

export function parseStructuredPartText(responseJson: unknown) {
  const text = (responseJson as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new ConvexError("Gemini review returned no structured content");
  }
  return text;
}

export function parseIsoDateToExpiryMs(value: string | undefined) {
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

export async function uploadFileToGemini(args: {
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

export async function deleteGeminiFile(apiKey: string, fileName: string | undefined) {
  if (!fileName) {
    return;
  }
  await fetch(`${GEMINI_BASE_URL}/v1beta/${fileName}?key=${apiKey}`, {
    method: "DELETE",
  }).catch(() => undefined);
}

export async function generateStructuredGeminiReview<T>(args: {
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

export function buildCertificatePrompt(args: {
  instructorDisplayName: string;
  nowIsoDate: string;
  diditLegalName?: string;
  declaredSport?: string;
}) {
  return [
    "You are validating a sports instructor teaching certificate for marketplace compliance.",
    `Today's date: ${args.nowIsoDate}.`,
    `Instructor display name: ${args.instructorDisplayName}.`,
    args.diditLegalName ? `Instructor verified legal name: ${args.diditLegalName}.` : null,
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

export function buildInsurancePrompt(args: {
  diditLegalName?: string;
  instructorDisplayName: string;
  nowIsoDate: string;
}) {
  return [
    "You are validating proof of active third-party liability insurance for a sports instructor in Israel.",
    `Today's date: ${args.nowIsoDate}.`,
    `Instructor display name: ${args.instructorDisplayName}.`,
    args.diditLegalName ? `Instructor verified legal name: ${args.diditLegalName}.` : null,
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

export function buildCertificateReviewSchema() {
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

export function buildInsuranceReviewSchema() {
  return {
    type: "OBJECT",
    properties: {
      approved: { type: "BOOLEAN" },
      issuerName: { type: "STRING" },
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

export async function fetchAndVerifyDocumentBytes(storageUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(storageUrl);
  if (!response.ok) {
    throw new ConvexError(`Failed to fetch stored compliance file (${response.status})`);
  }
  const bytes = await response.arrayBuffer();
  const digestHeader = response.headers.get("digest");
  if (digestHeader) {
    const match = digestHeader.match(/sha-256=([a-fA-F0-9]{64})/i);
    if (match?.[1]) {
      const storedHash = match[1].toLowerCase();
      const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
      const downloadedHash = Buffer.from(hashBuffer).toString("hex");
      if (downloadedHash !== storedHash) {
        throw new ConvexError(
          `Document integrity check failed: SHA256 mismatch. Expected ${storedHash}, got ${downloadedHash}. The uploaded document may have been corrupted or tampered with.`,
        );
      }
    }
  }

  return bytes;
}

export async function sendComplianceEmail(args: {
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
