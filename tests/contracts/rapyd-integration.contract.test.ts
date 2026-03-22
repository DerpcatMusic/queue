import { createHmac } from "node:crypto";
import { describe, expect, it } from "bun:test";

import {
  buildRapydRequestSignature,
  buildRapydWebhookSignature,
  resolveRapydCheckoutMethodSelectionFromAvailableMethods,
} from "../../convex/integrations/rapyd/client";
import {
  getRapydEnvPresence,
  resolveRapydCheckoutMode,
} from "../../convex/integrations/rapyd/config";
import { buildCanonicalRapydPayload } from "../../convex/integrations/rapyd/payloads";

function withEnv(
  entries: Record<string, string | undefined>,
  run: () => void | Promise<void>,
) {
  const previous = Object.fromEntries(
    Object.keys(entries).map((key) => [key, process.env[key]]),
  );

  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return Promise.resolve(run()).finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

describe("rapyd integration helpers", () => {
  it("resolves checkout selectors against live available payment methods", () => {
    const selection = resolveRapydCheckoutMethodSelectionFromAvailableMethods({
      configured: "il_card,apple_pay,google_pay",
      availableMethods: [
        {
          type: "il_visa_card",
          category: "card",
          supportedDigitalWalletProviders: ["apple_pay", "google_pay"],
          status: 1,
        },
        {
          type: "il_mastercard_card",
          category: "card",
          supportedDigitalWalletProviders: [],
          status: 1,
        },
        {
          type: "il_bank_transfer",
          category: "bank_transfer",
          supportedDigitalWalletProviders: [],
          status: 1,
        },
      ],
    });

    expect(selection.requestedSelectors).toEqual([
      "il_card",
      "apple_pay",
      "google_pay",
    ]);
    expect(selection.paymentMethodTypesInclude).toEqual([
      "il_visa_card",
      "il_mastercard_card",
    ]);
    expect(selection.warnings).toEqual([]);
  });

  it("surfaces unknown checkout selectors instead of silently broadening methods", () => {
    const selection = resolveRapydCheckoutMethodSelectionFromAvailableMethods({
      configured: "category:card,totally_fake_method",
      availableMethods: [
        {
          type: "il_visa_card",
          category: "card",
          supportedDigitalWalletProviders: [],
          status: 1,
        },
      ],
    });

    expect(selection.paymentMethodTypesInclude).toEqual(["il_visa_card"]);
    expect(selection.warnings).toEqual([
      "Unrecognized Rapyd payment selector: totally_fake_method",
    ]);
  });

  it("fails closed to bank rails in a2a checkout mode", () => {
    const selection = resolveRapydCheckoutMethodSelectionFromAvailableMethods({
      configured: "il_visa_card,bank_transfer",
      allowedCategories: ["bank_transfer", "bank_redirect"],
      availableMethods: [
        {
          type: "il_visa_card",
          category: "card",
          supportedDigitalWalletProviders: [],
          status: 1,
        },
        {
          type: "il_bank_transfer",
          category: "bank_transfer",
          supportedDigitalWalletProviders: [],
          status: 1,
        },
      ],
    });

    expect(selection.paymentMethodTypesInclude).toEqual(["il_bank_transfer"]);
    expect(selection.warnings).toEqual([
      "Rapyd payment selector is not allowed in the current checkout mode: il_visa_card",
    ]);
  });

  it("builds webhook signatures without the HTTP method", async () => {
    const args = {
      path: "/webhooks/rapyd",
      salt: "salt-123",
      timestamp: "1700000000",
      accessKey: "access-key",
      secretKey: "secret-key",
      body: '{"id":"evt_1"}',
      encoding: "hex_base64" as const,
    };

    const webhookSignature = await buildRapydWebhookSignature(args);
    const requestSignature = await buildRapydRequestSignature({
      ...args,
      method: "POST",
    });

    const expectedWebhook = Buffer.from(
      createHmac("sha256", args.secretKey)
        .update(
          `${args.path}${args.salt}${args.timestamp}${args.accessKey}${args.secretKey}${args.body}`,
        )
        .digest("hex"),
      "utf8",
    ).toString("base64");

    expect(webhookSignature).toBe(expectedWebhook);
    expect(requestSignature).not.toBe(expectedWebhook);
  });

  it("canonicalizes Rapyd payloads from nested webhook data", () => {
    expect(
      buildCanonicalRapydPayload({
        id: " evt_1 ",
        event: " PAYMENT_COMPLETED ",
        data: {
          id: " payment_1 ",
          status: " CLO ",
          merchant_reference_id: " payments:123 ",
          checkout: { id: " checkout_1 " },
          payment: { id: " payment_provider_1 ", status: " CLO " },
          metadata: {
            paymentId: " payments:123 ",
            merchant_reference_id: " payments:123 ",
          },
        },
      }),
    ).toEqual({
      id: "evt_1",
      type: "PAYMENT_COMPLETED",
      data: {
        id: "payment_1",
        status: "CLO",
        merchant_reference_id: "payments:123",
        checkout: { id: "checkout_1" },
        payment: { id: "payment_provider_1", status: "CLO" },
        metadata: {
          paymentId: "payments:123",
          merchant_reference_id: "payments:123",
        },
      },
    });
  });

  it("reports Rapyd env readiness from the shared config layer", async () => {
    await withEnv(
      {
        RAPYD_MODE: "sandbox",
        RAPYD_ACCESS_KEY: "ak",
        RAPYD_SECRET_KEY: "sk",
        RAPYD_COUNTRY: "IL",
        RAPYD_COMPLETE_CHECKOUT_URL: "https://example.com/complete",
        RAPYD_CANCEL_CHECKOUT_URL: "https://example.com/cancel",
        RAPYD_EWALLET: "ewallet_1",
        RAPYD_BENEFICIARY_COMPLETE_URL:
          "https://example.com/beneficiary-complete",
        RAPYD_BENEFICIARY_CANCEL_URL: "https://example.com/beneficiary-cancel",
        RAPYD_WEBHOOK_SECRET: "whsec",
        RAPYD_SANDBOX_BASE_URL: "https://sandboxapi.rapyd.net",
        RAPYD_BASE_URL: undefined,
        RAPYD_PROD_BASE_URL: undefined,
      },
      () => {
        const status = getRapydEnvPresence();

        expect(status.readyForCheckout).toBe(true);
        expect(status.readyForOnboarding).toBe(true);
        expect(status.readyForPayouts).toBe(true);
        expect(status.hasExplicitWebhookSecret).toBe(true);
        expect(status.effectiveBaseUrlEnvName).toBe("RAPYD_SANDBOX_BASE_URL");
      },
    );
  });

  it("defaults checkout mode to flexible in sandbox (card-capable)", async () => {
    await withEnv(
      {
        RAPYD_MODE: "sandbox",
        RAPYD_ACCESS_KEY: "ak",
        RAPYD_SECRET_KEY: "sk",
        RAPYD_COUNTRY: "IL",
        RAPYD_COMPLETE_CHECKOUT_URL: "https://example.com/complete",
        RAPYD_CANCEL_CHECKOUT_URL: "https://example.com/cancel",
        RAPYD_EWALLET: "ewallet_1",
        RAPYD_CHECKOUT_MODE: undefined,
      },
      () => {
        expect(resolveRapydCheckoutMode()).toBe("flexible");
      },
    );
  });

  it("defaults checkout mode to a2a in production (fail-closed bank-only)", async () => {
    await withEnv(
      {
        RAPYD_MODE: "production",
        RAPYD_ACCESS_KEY: "ak",
        RAPYD_SECRET_KEY: "sk",
        RAPYD_COUNTRY: "IL",
        RAPYD_COMPLETE_CHECKOUT_URL: "https://example.com/complete",
        RAPYD_CANCEL_CHECKOUT_URL: "https://example.com/cancel",
        RAPYD_EWALLET: "ewallet_1",
        RAPYD_CHECKOUT_MODE: undefined,
      },
      () => {
        expect(resolveRapydCheckoutMode()).toBe("a2a");
      },
    );
  });

  it("respects explicit RAPYD_CHECKOUT_MODE=flexible override regardless of environment", async () => {
    await withEnv(
      {
        RAPYD_MODE: "production",
        RAPYD_ACCESS_KEY: "ak",
        RAPYD_SECRET_KEY: "sk",
        RAPYD_COUNTRY: "IL",
        RAPYD_COMPLETE_CHECKOUT_URL: "https://example.com/complete",
        RAPYD_CANCEL_CHECKOUT_URL: "https://example.com/cancel",
        RAPYD_EWALLET: "ewallet_1",
        RAPYD_CHECKOUT_MODE: "flexible",
      },
      () => {
        expect(resolveRapydCheckoutMode()).toBe("flexible");
      },
    );
  });

  it("respects explicit RAPYD_CHECKOUT_MODE=a2a override in sandbox", async () => {
    await withEnv(
      {
        RAPYD_MODE: "sandbox",
        RAPYD_ACCESS_KEY: "ak",
        RAPYD_SECRET_KEY: "sk",
        RAPYD_COUNTRY: "IL",
        RAPYD_COMPLETE_CHECKOUT_URL: "https://example.com/complete",
        RAPYD_CANCEL_CHECKOUT_URL: "https://example.com/cancel",
        RAPYD_EWALLET: "ewallet_1",
        RAPYD_CHECKOUT_MODE: "a2a",
      },
      () => {
        expect(resolveRapydCheckoutMode()).toBe("a2a");
      },
    );
  });
});
