import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import {
  getWebCrypto,
  verifyDiditWebhookSignature,
} from "./httpShared";
import {
  validateWebhookSourceIp,
  sanitizeWebhookError,
  checkWebhookEventIdempotency,
  recordWebhookEventProcessing,
  markWebhookEventProcessed,
  validateWebhookTimestamp,
  recordInvalidSignatureAttempt,
  clearInvalidSignatureThrottle,
  checkInvalidSignatureThrottle,
} from "./security/webhookSecurity";

/**
 * Computes SHA-256 fingerprint of webhook body for rate limiting.
 */
async function getDiditWebhookFingerprint(body: string): Promise<string> {
  return Array.from(
    new Uint8Array(
      await getWebCrypto().subtle.digest("SHA-256", new TextEncoder().encode(body)),
    ),
  )
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Extracts event ID from Didit webhook payload.
 * Uses payload hash as identifier for idempotency tracking.
 */
async function extractDiditEventId(body: string): Promise<string> {
  return `didit:${await getDiditWebhookFingerprint(body)}`;
}

// =============================================================================
// Development Mode IP Allowlist (Configure via environment variables)
// =============================================================================
// Set WEBHOOK_DIDIT_IPS to comma-separated IPs in production
// In development, unknown IPs trigger warnings but are allowed

export function registerDiditRoutes(http: { route: (...args: any[]) => void }) {
  http.route({
    path: "/didit/webhook",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      // ----------------------------------------------------------------
      // 1. Extract source IP for validation
      // ----------------------------------------------------------------
      const sourceIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        ?? req.headers.get("cf-connecting-ip")?.trim()
        ?? null;

      // ----------------------------------------------------------------
      // 2. Validate source IP (dev mode: log warning, production: block)
      // ----------------------------------------------------------------
      const ipValidation = await validateWebhookSourceIp(sourceIp, "didit");
      if (ipValidation.shouldLog) {
        console.warn(
          `[DiditWebhook] Source IP validation: ip=${sourceIp ?? "unknown"}, provider=didit`,
        );
      }
      if (!ipValidation.valid) {
        return new Response("Access denied", { status: 403 });
      }

      // ----------------------------------------------------------------
      // 3. Validate required headers
      // ----------------------------------------------------------------
      const signature = req.headers.get("x-signature-v2");
      const timestamp = req.headers.get("x-timestamp");

      if (!signature || !timestamp) {
        return new Response("Missing required headers", { status: 400 });
      }

      // ----------------------------------------------------------------
      // 4. Validate timestamp to prevent replays
      // ----------------------------------------------------------------
      const timestampValidation = validateWebhookTimestamp(timestamp);
      if (!timestampValidation.valid) {
        console.warn(
          `[DiditWebhook] Timestamp validation failed: age=${timestampValidation.age}s`,
        );
        return new Response("Request timestamp expired", { status: 401 });
      }

      const body = await req.text();
      const fingerprint = await getDiditWebhookFingerprint(body);

      // ----------------------------------------------------------------
      // 5. Check signature throttle before processing
      // ----------------------------------------------------------------
      const throttleCheck = await ctx.runMutation(
        internal.security.webhookSecurity.checkInvalidSignatureThrottle,
        {
          provider: "didit",
          fingerprint,
        },
      );

      if (throttleCheck.blocked) {
        const retryAfter = throttleCheck.retryAfterSeconds ?? 60;
        console.warn(
          `[DiditWebhook] Request blocked due to throttle: fingerprint=${fingerprint.slice(0, 16)}..., retryAfter=${retryAfter}s`,
        );
        return new Response("Too many requests", {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        });
      }

      // ----------------------------------------------------------------
      // 6. Verify signature
      // ----------------------------------------------------------------
      const signatureValid = await verifyDiditWebhookSignature(body, signature, timestamp);
      if (!signatureValid) {
        // Record failed attempt for rate limiting
        await ctx.runMutation(
          internal.security.webhookSecurity.recordInvalidSignatureAttempt,
          {
            provider: "didit",
            fingerprint,
          },
        );
        return new Response("Signature verification failed", { status: 401 });
      }

      // ----------------------------------------------------------------
      // 7. Check for replay attacks using event idempotency
      // ----------------------------------------------------------------
      const eventId = await extractDiditEventId(body);
      const idempotencyCheck = await ctx.runQuery(
        internal.security.webhookSecurity.checkWebhookEventIdempotency,
        {
          provider: "didit",
          eventId,
        },
      );

      if (idempotencyCheck.isDuplicate) {
        console.info(
          `[DiditWebhook] Duplicate event rejected: eventId=${eventId.slice(0, 20)}...`,
        );
        // Return 200 to prevent retries
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Record that we're processing this event
      await ctx.runMutation(
        internal.security.webhookSecurity.recordWebhookEventProcessing,
        {
          provider: "didit",
          eventId,
        },
      );

      // ----------------------------------------------------------------
      // 8. Parse and validate payload
      // ----------------------------------------------------------------
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(body);
      } catch {
        await ctx.runMutation(
          internal.security.webhookSecurity.markWebhookEventProcessed,
          {
            provider: "didit",
            eventId,
            success: false,
            errorMessage: "Invalid JSON payload",
          },
        );
        return new Response("Invalid payload format", { status: 400 });
      }

      const sessionId =
        (typeof payload.session_id === "string" && payload.session_id.trim()) ||
        (typeof payload.sessionId === "string" && payload.sessionId.trim());

      if (!sessionId) {
        await ctx.runMutation(
          internal.security.webhookSecurity.markWebhookEventProcessed,
          {
            provider: "didit",
            eventId,
            success: false,
            errorMessage: "Missing session id",
          },
        );
        return new Response("Missing session identifier", { status: 400 });
      }

      const statusRaw =
        (typeof payload.status === "string" && payload.status.trim()) || "not_started";

      const vendorData =
        typeof payload.vendor_data === "string"
          ? payload.vendor_data.trim()
          : typeof payload.vendorData === "string"
            ? payload.vendorData.trim()
            : undefined;

      const webhookType =
        typeof payload.webhook_type === "string"
          ? payload.webhook_type.trim()
          : typeof payload.webhookType === "string"
            ? payload.webhookType.trim()
            : undefined;

      const decision =
        payload.decision && typeof payload.decision === "object" ? payload.decision : undefined;

      const payloadHash = fingerprint; // Already computed

      // ----------------------------------------------------------------
      // 9. Process the webhook
      // ----------------------------------------------------------------
      try {
        await ctx.runMutation(
          internal.payments.core.applyDiditStudioWebhook as any,
          {
            providerEventId: eventId,
            sessionId,
            statusRaw,
            vendorData,
            webhookType,
            payload,
            payloadHash,
            signatureValid: true,
            ...(decision ? { decision } : {}),
          } as any,
        );

        // Clear throttle on successful processing
        await ctx.runMutation(
          internal.security.webhookSecurity.clearInvalidSignatureThrottle,
          {
            provider: "didit",
            fingerprint,
          },
        );

        // Mark event as successfully processed
        await ctx.runMutation(
          internal.security.webhookSecurity.markWebhookEventProcessed,
          {
            provider: "didit",
            eventId,
            success: true,
          },
        );
      } catch (error) {
        // Use sanitized error response to prevent information leakage
        const sanitized = sanitizeWebhookError(error);
        
        // Mark event as failed
        await ctx.runMutation(
          internal.security.webhookSecurity.markWebhookEventProcessed,
          {
            provider: "didit",
            eventId,
            success: false,
            errorMessage: sanitized.message,
          },
        );

        console.error(
          `[DiditWebhook] Processing failed: sessionId=${sessionId}, error=${sanitized.message}`,
        );
        return new Response(sanitized.message, { status: sanitized.statusCode });
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });
}