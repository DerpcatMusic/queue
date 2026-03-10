"use node";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ConvexError } from "convex/values";

const CALENDAR_TOKEN_ENCRYPTION_PREFIX = "enc:v1:";
const CALENDAR_TOKEN_ENCRYPTION_SECRET_ENV = "CALENDAR_TOKEN_ENCRYPTION_SECRET";

function getCalendarTokenEncryptionSecret(): string | undefined {
  const secret = process.env[CALENDAR_TOKEN_ENCRYPTION_SECRET_ENV]?.trim();
  return secret ? secret : undefined;
}

function deriveCalendarTokenKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function isEncryptedCalendarToken(value: string | undefined): boolean {
  return Boolean(value?.startsWith(CALENDAR_TOKEN_ENCRYPTION_PREFIX));
}

export function encryptCalendarToken(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }
  if (isEncryptedCalendarToken(value)) {
    return value;
  }
  const secret = getCalendarTokenEncryptionSecret();
  if (!secret) {
    return value;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveCalendarTokenKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, ciphertext]).toString("base64url");
  return `${CALENDAR_TOKEN_ENCRYPTION_PREFIX}${payload}`;
}

export function encryptRequiredCalendarToken(value: string): string {
  return encryptCalendarToken(value) ?? value;
}

export function decryptCalendarToken(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }
  if (!isEncryptedCalendarToken(value)) {
    return value;
  }

  const secret = getCalendarTokenEncryptionSecret();
  if (!secret) {
    throw new ConvexError(
      "Calendar token encryption secret is required to decrypt stored calendar credentials",
    );
  }

  const encoded = value.slice(CALENDAR_TOKEN_ENCRYPTION_PREFIX.length);
  const raw = Buffer.from(encoded, "base64url");
  if (raw.length <= 28) {
    throw new ConvexError("Stored calendar token ciphertext is invalid");
  }

  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);

  try {
    const decipher = createDecipheriv("aes-256-gcm", deriveCalendarTokenKey(secret), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new ConvexError("Stored calendar token could not be decrypted");
  }
}
