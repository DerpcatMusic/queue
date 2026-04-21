"use node";

import { customAlphabet } from "nanoid";

/**
 * Secure token generation for Convex.
 * Uses nanoid which is Convex-bundler compatible.
 * 
 * NOTE: This file uses "use node" directive to run in Node.js runtime.
 * Import it only from other Node.js files or actions.
 */

// Use nanoid with custom alphabet for URL-safe tokens (16 chars)
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const generateSecureId = customAlphabet(ALPHABET, 16);

/**
 * Creates a cryptographically secure upload session token.
 * Format: userId:timestamp:entropy
 * 
 * @param userId - The user's ID
 * @param now - Current timestamp in milliseconds
 * @returns A secure, unpredictable token string
 */
export function createSecureUploadToken(userId: string, now: number): string {
  const entropy = generateSecureId();
  return `${userId}:${now}:${entropy}`;
}

/**
 * Validates a token format without revealing if it's valid.
 * Returns true if format matches expected pattern.
 */
export function isValidTokenFormat(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(":");
  // Expected format: userId:timestamp:16-char-alphanumeric-entropy
  if (parts.length !== 3) return false;
  if (!parts[0] || parts[0].length === 0) return false;
  if (!parts[1] || parts[1].length === 0) return false;
  // Alphanumeric entropy should be 16 characters
  if (!parts[2] || parts[2].length !== 16) return false;
  // Check it's valid alphanumeric
  return /^[0-9a-z]{16}$/.test(parts[2]);
}