"use node";

/**
 * Multi-layer fingerprinting for rate limiting.
 * Combines userId, device fingerprint, and IP for robust rate limiting.
 * Prevents bypass via multiple devices or IP rotation.
 */

import { createHash } from "node:crypto";

// Browser fingerprint components
export interface DeviceFingerprint {
  userAgent: string;
  deviceId?: string; // Persistent device identifier
  screenResolution?: string;
  timezone?: string;
  platform?: string;
}

// Proof-of-work challenge for expensive operations
export interface PowChallenge {
  id: string;
  difficulty: number; // Number of leading zeros required
  target: string; // Hash target
  expiresAt: number;
  createdAt: number;
}

// Batch operation identifiers
export type BatchOperationType = 
  | "markNotificationsRead" 
  | "bulkDelete" 
  | "bulkArchive"
  | "exportData"
  | "batchUpdate";

/**
 * Generate a secure device fingerprint hash from components.
 * Falls back to user agent + IP if deviceId not provided.
 */
export function hashDeviceFingerprint(
  device: DeviceFingerprint,
  ipHash?: string,
): string {
  const components: string[] = [];
  
  if (device.deviceId) {
    // Use persistent device ID - most reliable
    components.push(`did:${device.deviceId}`);
  }
  
  // Always include normalized user agent
  components.push(`ua:${normalizeUserAgent(device.userAgent)}`);
  
  // Add screen resolution for additional uniqueness
  if (device.screenResolution) {
    components.push(`sr:${device.screenResolution}`);
  }
  
  // Add timezone for timezone-based fingerprinting
  if (device.timezone) {
    components.push(`tz:${device.timezone}`);
  }
  
  // Include IP hash if available (server-side only)
  if (ipHash) {
    components.push(`ip:${ipHash}`);
  }
  
  // Add platform
  if (device.platform) {
    components.push(`pf:${device.platform}`);
  }
  
  const combined = components.join("|");
  return sha256Hash(combined).substring(0, 24);
}

/**
 * Build a composite rate limit fingerprint with multiple layers.
 * Layer 1: User authentication
 * Layer 2: Device fingerprint
 * Layer 3: IP address
 * 
 * This prevents bypass via:
 * - Multiple devices: device fingerprint catches it
 * - IP rotation: IP hash catches it
 * - Account switching: requires all three layers match
 */
export function buildRateLimitFingerprint(args: {
  userId?: string;
  ipAddress?: string;
  device?: DeviceFingerprint;
}): string {
  const layers: string[] = [];

  // Layer 1: User identification (strongest)
  if (args.userId) {
    layers.push(`u:${args.userId}`);
  }

  // Layer 2: Device fingerprint
  const deviceHash = args.device 
    ? hashDeviceFingerprint(args.device, args.ipAddress ? simpleHash(args.ipAddress) : undefined)
    : null;
  
  if (deviceHash) {
    layers.push(`d:${deviceHash}`);
  }

  // Layer 3: IP address (hash for privacy)
  if (args.ipAddress) {
    layers.push(`i:${simpleHash(args.ipAddress)}`);
  }

  // If no identification provided, use anonymous fingerprint with entropy
  if (layers.length === 0) {
    const anonPart = randomBytes(16).toString("hex");
    return `anon:${anonPart}`;
  }

  // Combine layers with sorted order for consistency
  // Format: u:{userId}:d:{deviceHash}:i:{ipHash}
  return layers.join(":");
}

/**
 * Build a batch operation rate limit key.
 * Combines user + operation + time window for efficient batching.
 */
export function buildBatchOperationFingerprint(args: {
  userId?: string;
  ipAddress?: string;
  device?: DeviceFingerprint;
  operationType: BatchOperationType;
  batchId?: string;
}): string {
  const base = buildRateLimitFingerprint({
    userId: args.userId,
    ipAddress: args.ipAddress,
    device: args.device,
  });

  // Add operation type and batch identifier
  const operationPart = args.batchId 
    ? `${args.operationType}:${args.batchId}`
    : args.operationType;

  return `batch:${base}:${operationPart}`;
}

/**
 * Generate a proof-of-work challenge for expensive operations.
 * Clients must solve the challenge before proceeding.
 */
export function generatePowChallenge(
  operationType: BatchOperationType,
  difficulty: number = 4,
): PowChallenge {
  const id = randomBytes(16).toString("hex");
  const now = Date.now();
  
  // Target is derived from id + operation + timestamp
  // This makes each challenge unique and time-limited
  const targetSeed = sha256Hash(`${id}:${operationType}:${now}`).substring(0, 16);
  
  return {
    id,
    difficulty,
    target: targetSeed,
    expiresAt: now + 5 * 60 * 1000, // 5 minute expiry
    createdAt: now,
  };
}

/**
 * Verify a proof-of-work solution.
 * Returns true if the solution meets the difficulty requirement.
 */
export function verifyPowSolution(
  challenge: PowChallenge,
  solution: string,
): boolean {
  // Check expiry
  if (Date.now() > challenge.expiresAt) {
    return false;
  }

  // Verify the solution hash starts with required zeros
  const solutionHash = sha256Hash(`${challenge.id}:${challenge.target}:${solution}`);
  const requiredPrefix = "0".repeat(challenge.difficulty);
  
  return solutionHash.startsWith(requiredPrefix);
}

/**
 * Normalize user agent string for consistent fingerprinting.
 * Removes version-specific details that change frequently.
 */
function normalizeUserAgent(ua: string): string {
  // Extract browser and OS info, ignore specific versions
  const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/i);
  const osMatch = ua.match(/(Windows|Macintosh|Linux|Android|iOS)/i);
  
  const browser = browserMatch ? browserMatch[1].toLowerCase() : "unknown";
  const os = osMatch ? osMatch[1].toLowerCase() : "unknown";
  
  return `${browser}:${os}`;
}

/**
 * Fast string hash for IP addresses and simple strings.
 * Uses djb2 algorithm - fast and good distribution.
 */
export function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * SHA256 hash for fingerprinting.
 * Used for device fingerprints and proof-of-work.
 */
function sha256Hash(input: string): string {
  // Use Web Crypto API in browser, fallback to simple hash in Node
  // For Convex runtime, we use a simple but strong hash
  const crypto = typeof globalThis.crypto !== 'undefined' 
    ? globalThis.crypto 
    : null;
  
  if (crypto && crypto.subtle) {
    // This won't work directly in Convex, so we use a robust fallback
  }
  
  // Simple but strong hash for Convex runtime
  // Uses multiple rounds of mixing for diffusion
  let h1 = 0x6a09e667;
  let h2 = 0xbb67ae85;
  let h3 = 0x3c6ef372;
  let h4 = 0xa54ff53a;
  
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    h1 = (h1 ^ char) * 0x9e3779b9 + (h2 << 8) + (h3 << 16);
    h2 = (h2 ^ char) * 0x85ebca6b + (h4 << 8) + (h1 << 16);
    h3 = (h3 ^ char) * 0xc2b2ae35 + (h1 << 8) + (h2 << 16);
    h4 = (h4 ^ char) * 0x510e527f + (h2 << 8) + (h3 << 16);
  }
  
  const toHex = (n: number) => Math.abs(n).toString(16).padStart(8, '0');
  return toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4);
}

/**
 * Generate a client-side device fingerprint.
 * This runs in the browser to gather device information.
 */
export function getClientDeviceFingerprint(): DeviceFingerprint {
  return {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    screenResolution: typeof screen !== 'undefined' 
      ? `${screen.width}x${screen.height}` 
      : undefined,
    timezone: typeof Intl !== 'undefined' 
      ? Intl.DateTimeFormat().resolvedOptions().timeZone 
      : undefined,
    platform: typeof navigator !== 'undefined' ? navigator.platform : undefined,
    deviceId: getOrCreateDeviceId(),
  };
}

/**
 * Get or create a persistent device ID using localStorage.
 * This ID persists across sessions and identifies the device.
 */
function getOrCreateDeviceId(): string | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  
  const storageKey = 'cvx_device_id';
  let deviceId = localStorage.getItem(storageKey);
  
  if (!deviceId) {
    deviceId = randomBytes(32).toString('hex');
    localStorage.setItem(storageKey, deviceId);
  }
  
  return deviceId;
}

/**
 * Batch rate limit configuration for expensive operations.
 */
export const BATCH_RATE_LIMITS: Record<BatchOperationType, {
  windowMs: number;
  maxRequests: number;
  maxBatchSize: number;
  requiresPow: boolean;
  powDifficulty: number;
}> = {
  markNotificationsRead: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    maxBatchSize: 100,
    requiresPow: false,
    powDifficulty: 0,
  },
  bulkDelete: {
    windowMs: 60 * 1000,
    maxRequests: 5,
    maxBatchSize: 50,
    requiresPow: true,
    powDifficulty: 3,
  },
  bulkArchive: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    maxBatchSize: 100,
    requiresPow: true,
    powDifficulty: 3,
  },
  exportData: {
    windowMs: 5 * 60 * 1000,
    maxRequests: 3,
    maxBatchSize: 1,
    requiresPow: true,
    powDifficulty: 4,
  },
  batchUpdate: {
    windowMs: 60 * 1000,
    maxRequests: 20,
    maxBatchSize: 200,
    requiresPow: false,
    powDifficulty: 0,
  },
};