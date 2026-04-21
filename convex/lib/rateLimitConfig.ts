export type OperationType = "query" | "mutation" | "auth" | "payment" | "webhook";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockMs: number;
}

const DEFAULT_AUTH_WINDOW_MS = 60 * 1000;
const DEFAULT_AUTH_MAX_REQUESTS = 10;
const DEFAULT_AUTH_BLOCK_MS = 15 * 60 * 1000;

const DEFAULT_QUERY_WINDOW_MS = 60 * 1000;
const DEFAULT_QUERY_MAX_REQUESTS = 100;
const DEFAULT_QUERY_BLOCK_MS = 5 * 60 * 1000;

const DEFAULT_MUTATION_WINDOW_MS = 60 * 1000;
const DEFAULT_MUTATION_MAX_REQUESTS = 50;
const DEFAULT_MUTATION_BLOCK_MS = 5 * 60 * 1000;

const DEFAULT_PAYMENT_WINDOW_MS = 60 * 1000;
const DEFAULT_PAYMENT_MAX_REQUESTS = 20;
const DEFAULT_PAYMENT_BLOCK_MS = 10 * 60 * 1000;

const DEFAULT_WEBHOOK_WINDOW_MS = 60 * 1000;
const DEFAULT_WEBHOOK_MAX_REQUESTS = 60;
const DEFAULT_WEBHOOK_BLOCK_MS = 5 * 60 * 1000;

export function getRateLimitConfig(type: OperationType): RateLimitConfig {
  const prefix = `RATELIMIT_${type.toUpperCase()}_`;

  const parseEnv = (suffix: string, fallback: number): number => {
    const val = process.env[`${prefix}${suffix}`];
    if (val) {
      const parsed = Number.parseInt(val, 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return fallback;
  };

  switch (type) {
    case "auth":
      return {
        windowMs: parseEnv("WINDOW_MS", DEFAULT_AUTH_WINDOW_MS),
        maxRequests: parseEnv("MAX_REQUESTS", DEFAULT_AUTH_MAX_REQUESTS),
        blockMs: parseEnv("BLOCK_MS", DEFAULT_AUTH_BLOCK_MS),
      };
    case "payment":
      return {
        windowMs: parseEnv("WINDOW_MS", DEFAULT_PAYMENT_WINDOW_MS),
        maxRequests: parseEnv("MAX_REQUESTS", DEFAULT_PAYMENT_MAX_REQUESTS),
        blockMs: parseEnv("BLOCK_MS", DEFAULT_PAYMENT_BLOCK_MS),
      };
    case "webhook":
      return {
        windowMs: parseEnv("WINDOW_MS", DEFAULT_WEBHOOK_WINDOW_MS),
        maxRequests: parseEnv("MAX_REQUESTS", DEFAULT_WEBHOOK_MAX_REQUESTS),
        blockMs: parseEnv("BLOCK_MS", DEFAULT_WEBHOOK_BLOCK_MS),
      };
    case "mutation":
      return {
        windowMs: parseEnv("WINDOW_MS", DEFAULT_MUTATION_WINDOW_MS),
        maxRequests: parseEnv("MAX_REQUESTS", DEFAULT_MUTATION_MAX_REQUESTS),
        blockMs: parseEnv("BLOCK_MS", DEFAULT_MUTATION_BLOCK_MS),
      };
    default:
      return {
        windowMs: parseEnv("WINDOW_MS", DEFAULT_QUERY_WINDOW_MS),
        maxRequests: parseEnv("MAX_REQUESTS", DEFAULT_QUERY_MAX_REQUESTS),
        blockMs: parseEnv("BLOCK_MS", DEFAULT_QUERY_BLOCK_MS),
      };
  }
}
