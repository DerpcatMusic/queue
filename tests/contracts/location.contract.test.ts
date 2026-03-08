import { afterEach, describe, expect, it } from "bun:test";

import { fetchJsonWithPolicy } from "../../src/lib/fetch-json";
import { getLocationResolveErrorMessage } from "../../src/lib/location-error-message";

const originalFetch = globalThis.fetch;

function setFetchMock(mockImpl: (input: string, init?: RequestInit) => Promise<Response>) {
  globalThis.fetch = mockImpl as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("location error mapping contract", () => {
  const t = (key: string) => `tx:${key}`;

  it("maps domain location codes to translated message keys", () => {
    const mappedCodes = [
      "native_module_missing",
      "permission_denied",
      "permission_blocked",
      "services_disabled",
      "timeout",
      "address_not_found",
      "outside_supported_zone",
    ] as const;

    for (const code of mappedCodes) {
      const message = getLocationResolveErrorMessage({
        code,
        fallbackMessage: null,
        fallbackKey: "genericError",
        translationPrefix: "onboarding.errors",
        t,
      });
      expect(message.startsWith("tx:onboarding.errors.location")).toBe(true);
    }
  });

  it("falls back to fallback text for unsupported/unmapped location codes", () => {
    const fallbackMessage = "Use fallback";
    const unsupportedMessage = getLocationResolveErrorMessage({
      code: "unsupported_platform",
      fallbackMessage,
      fallbackKey: "genericError",
      translationPrefix: "onboarding.errors",
      t,
    });
    expect(unsupportedMessage).toBe(fallbackMessage);

    const unknownMessage = getLocationResolveErrorMessage({
      code: "unknown",
      fallbackMessage: null,
      fallbackKey: "genericError",
      translationPrefix: "onboarding.errors",
      t,
    });
    expect(unknownMessage).toBe("tx:onboarding.errors.genericError");
  });
});

describe("network resilience contract", () => {
  it("retries transient network errors and eventually succeeds", async () => {
    let attempts = 0;
    setFetchMock(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new TypeError("Network request failed");
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    await expect(
      fetchJsonWithPolicy<{ ok: boolean }>("https://example.test", {}, { retries: 1, retryDelayMs: 0 }),
    ).resolves.toEqual({ ok: true });
    expect(attempts).toBe(2);
  });

  it("does not retry user-aborted requests", async () => {
    let attempts = 0;
    setFetchMock(async () => {
      attempts += 1;
      throw new DOMException("Aborted", "AbortError");
    });

    await expect(
      fetchJsonWithPolicy("https://example.test", {}, { retries: 2, retryDelayMs: 0 }),
    ).rejects.toMatchObject({
      code: "aborted",
      retryable: false,
    });
    expect(attempts).toBe(1);
  });

  it("retries once after timeout-driven abort and succeeds", async () => {
    let attempts = 0;
    setFetchMock((_: string, init?: RequestInit) => {
      attempts += 1;
      if (attempts === 1) {
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });

    await expect(
      fetchJsonWithPolicy<{ ok: boolean }>("https://example.test", {}, { timeoutMs: 5, retries: 1, retryDelayMs: 0 }),
    ).resolves.toEqual({ ok: true });
    expect(attempts).toBe(2);
  });
});
