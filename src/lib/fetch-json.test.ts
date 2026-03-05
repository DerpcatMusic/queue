import { afterEach, describe, expect, it } from "bun:test";

import { fetchJsonWithPolicy, FetchRequestError, isFetchRequestError } from "./fetch-json";

const originalFetch = globalThis.fetch;

function setFetchMock(mockImpl: (input: string, init?: RequestInit) => Promise<Response>) {
  globalThis.fetch = mockImpl as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchJsonWithPolicy", () => {
  it("returns parsed JSON on success", async () => {
    setFetchMock(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await expect(fetchJsonWithPolicy<{ ok: boolean }>("https://example.test")).resolves.toEqual({
      ok: true,
    });
  });

  it("retries on retryable HTTP status and eventually succeeds", async () => {
    let attempt = 0;
    setFetchMock(async () => {
      attempt += 1;
      if (attempt === 1) {
        return new Response(JSON.stringify({ error: "temporary" }), { status: 503 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    await expect(
      fetchJsonWithPolicy<{ ok: boolean }>("https://example.test", {}, { retries: 1, retryDelayMs: 0 }),
    ).resolves.toEqual({ ok: true });
    expect(attempt).toBe(2);
  });

  it("does not retry non-retryable HTTP status", async () => {
    let attempt = 0;
    setFetchMock(async () => {
      attempt += 1;
      return new Response(JSON.stringify({ error: "bad request" }), { status: 400 });
    });

    await expect(
      fetchJsonWithPolicy("https://example.test", {}, { retries: 3, retryDelayMs: 0 }),
    ).rejects.toMatchObject({
      code: "http",
      retryable: false,
      status: 400,
    });
    expect(attempt).toBe(1);
  });

  it("throws parse error for non-JSON response", async () => {
    setFetchMock(async () => new Response("<html />", { status: 200 }));

    await expect(fetchJsonWithPolicy("https://example.test")).rejects.toMatchObject({
      code: "parse",
      retryable: false,
    });
  });

  it("throws timeout when request exceeds timeoutMs", async () => {
    setFetchMock((_: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }));

    await expect(
      fetchJsonWithPolicy("https://example.test", {}, { timeoutMs: 5, retries: 0 }),
    ).rejects.toMatchObject({
      code: "timeout",
      retryable: true,
    });
  });
});

describe("FetchRequestError guards", () => {
  it("identifies FetchRequestError instances", () => {
    const error = new FetchRequestError({
      code: "network",
      message: "Network error",
      retryable: true,
      url: "https://example.test",
    });

    expect(isFetchRequestError(error)).toBe(true);
    expect(isFetchRequestError(new Error("x"))).toBe(false);
  });
});
