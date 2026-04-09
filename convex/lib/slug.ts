/**
 * Slug generation utilities for public profile URLs.
 *
 * Format: kebab-case name + optional short suffix for collision resolution.
 * Example: "Daniel Smith" → "daniel-smith", or "daniel-smith-k4m7" if taken.
 */

import type { MutationCtx } from "../_generated/server";

const SLUG_SUFFIX_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
const SLUG_MAX_LENGTH = 50;
const SLUG_SUFFIX_LENGTH = 4;

/**
 * Generate a slug from a display name.
 * - Lowercase, kebab-case
 * - Strips non-alphanumeric characters except hyphens
 * - Collapses multiple hyphens into one
 * - Trims hyphens from edges
 * - Truncates to SLUG_MAX_LENGTH
 */
export function generateSlugFromDisplayName(displayName: string): string {
  const normalized = displayName
    .trim()
    .toLowerCase()
    // Remove accents/diacritics (basic Latin transliteration)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Replace spaces and common separators with hyphens
    .replace(/[\s_]+/g, "-")
    // Remove anything that's not a letter, number, or hyphen
    .replace(/[^a-z0-9-]/g, "")
    // Collapse multiple hyphens
    .replace(/-+/g, "-")
    // Trim hyphens from ends
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH);

  return normalized || "instructor";
}

/**
 * Generate a random suffix for slug collision resolution.
 * Uses carefully selected characters to avoid ambiguity: no i/l/1/o/0.
 */
export function generateSlugSuffix(): string {
  let suffix = "";
  for (let i = 0; i < SLUG_SUFFIX_LENGTH; i++) {
    suffix += SLUG_SUFFIX_CHARS[Math.floor(Math.random() * SLUG_SUFFIX_CHARS.length)];
  }
  return suffix;
}

/**
 * Reserved slugs that cannot be used by any profile.
 */
const RESERVED_SLUGS = new Set([
  "admin",
  "admins",
  "api",
  "app",
  "apply",
  "auth",
  "cancel",
  "checkout",
  "connect",
  "contact",
  "dashboard",
  "help",
  "home",
  "instructor",
  "instructors",
  "jobs",
  "login",
  "logout",
  "notification",
  "notifications",
  "onboarding",
  "payments",
  "pricing",
  "privacy",
  "profile",
  "profiles",
  "public",
  "settings",
  "sign-in",
  "sign-in-screen",
  "signout",
  "signup",
  "staff",
  "static",
  "studio",
  "studios",
  "support",
  "terms",
  "tos",
  "user",
  "users",
  "verify",
  "webhooks",
  "www",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/**
 * Build a full slug with collision suffix if needed.
 */
export function buildSlugWithSuffix(baseName: string, suffix?: string): string {
  const base = generateSlugFromDisplayName(baseName);
  if (!suffix) return base;
  return `${base}-${suffix}`;
}

/**
 * Generate a unique slug for an instructor profile.
 * Checks for reserved slugs and collisions in the database.
 * Falls back to suffix-based resolution.
 */
export async function generateUniqueInstructorSlug(
  displayName: string,
  ctx: MutationCtx,
): Promise<string> {
  const MAX_ATTEMPTS = 5;

  let baseSlug = generateSlugFromDisplayName(displayName);

  // Ensure base is not reserved
  if (isReservedSlug(baseSlug)) {
    baseSlug = `${baseSlug}-1`;
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate =
      attempt === 0 ? baseSlug : buildSlugWithSuffix(baseSlug, generateSlugSuffix());

    // Check if slug is already in use
    const existing = await ctx.db
      .query("instructorProfiles")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();

    if (!existing) {
      return candidate;
    }
  }

  // Fallback: use displayName with a timestamp-based suffix
  const fallback = buildSlugWithSuffix(baseSlug, Date.now().toString(36).slice(-4));
  return fallback;
}

/**
 * Generate a unique slug for a studio profile.
 */
export async function generateUniqueStudioSlug(
  studioName: string,
  ctx: MutationCtx,
): Promise<string> {
  const MAX_ATTEMPTS = 5;

  let baseSlug = generateSlugFromDisplayName(studioName);

  if (isReservedSlug(baseSlug)) {
    baseSlug = `${baseSlug}-1`;
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate =
      attempt === 0 ? baseSlug : buildSlugWithSuffix(baseSlug, generateSlugSuffix());

    const existing = await ctx.db
      .query("studioProfiles")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();

    if (!existing) {
      return candidate;
    }
  }

  const fallback = buildSlugWithSuffix(baseSlug, Date.now().toString(36).slice(-4));
  return fallback;
}
