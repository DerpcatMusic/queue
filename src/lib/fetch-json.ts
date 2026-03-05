const RETRYABLE_HTTP_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

export type FetchErrorCode = "aborted" | "http" | "network" | "parse" | "timeout" | "unknown";

export class FetchRequestError extends Error {
  code: FetchErrorCode;
  status: number | undefined;
  url: string | undefined;
  retryable: boolean;
  cause: unknown;

  constructor(input: {
    code: FetchErrorCode;
    message: string;
    status?: number;
    url?: string;
    retryable: boolean;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = "FetchRequestError";
    this.code = input.code;
    this.status = input.status;
    this.url = input.url;
    this.retryable = input.retryable;
    this.cause = input.cause;
  }
}

export function isFetchRequestError(error: unknown): error is FetchRequestError {
  return error instanceof FetchRequestError;
}

type FetchJsonOptions = {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
};

function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === "AbortError";
  }
  return (
    typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
  );
}

function mergeSignals(signals: Array<AbortSignal | null | undefined>): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const disposers: Array<() => void> = [];

  const abort = () => {
    controller.abort();
  };

  for (const signal of signals) {
    if (!signal) {
      continue;
    }

    if (signal.aborted) {
      abort();
      break;
    }

    signal.addEventListener("abort", abort, { once: true });
    disposers.push(() => {
      signal.removeEventListener("abort", abort);
    });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      for (const dispose of disposers) {
        dispose();
      }
    },
  };
}

function wait(delayMs: number): Promise<void> {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function computeBackoffDelay(attempt: number, retryDelayMs: number): number {
  return retryDelayMs * 2 ** attempt;
}

function normalizeUnknownFetchError(error: unknown, url: string): FetchRequestError {
  if (isFetchRequestError(error)) {
    return error;
  }

  if (isAbortError(error)) {
    return new FetchRequestError({
      code: "aborted",
      message: "The request was aborted.",
      retryable: false,
      url,
      cause: error,
    });
  }

  if (error instanceof TypeError) {
    return new FetchRequestError({
      code: "network",
      message: "Network request failed.",
      retryable: true,
      url,
      cause: error,
    });
  }

  return new FetchRequestError({
    code: "unknown",
    message: error instanceof Error ? error.message : "Unknown network error.",
    retryable: false,
    url,
    cause: error,
  });
}

export async function fetchJsonWithPolicy<T>(
  url: string,
  init: RequestInit = {},
  options: FetchJsonOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const retries = Math.max(0, options.retries ?? 0);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 250);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let didTimeout = false;
    const timeoutController = new AbortController();
    const mergedSignal = mergeSignals([init.signal, timeoutController.signal]);
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      timeoutController.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: mergedSignal.signal,
      });

      if (!response.ok) {
        throw new FetchRequestError({
          code: "http",
          message: `Request failed with status ${response.status}.`,
          status: response.status,
          retryable: RETRYABLE_HTTP_STATUS_CODES.has(response.status),
          url,
        });
      }

      try {
        return (await response.json()) as T;
      } catch (error) {
        throw new FetchRequestError({
          code: "parse",
          message: "Response payload is not valid JSON.",
          retryable: false,
          url,
          cause: error,
        });
      }
    } catch (error) {
      const normalized = didTimeout
        ? new FetchRequestError({
            code: "timeout",
            message: "The request timed out.",
            retryable: true,
            url,
            cause: error,
          })
        : normalizeUnknownFetchError(error, url);

      const hasMoreAttempts = attempt < retries;
      if (!hasMoreAttempts || !normalized.retryable) {
        throw normalized;
      }

      await wait(computeBackoffDelay(attempt, retryDelayMs));
    } finally {
      clearTimeout(timeoutId);
      mergedSignal.cleanup();
    }
  }

  throw new FetchRequestError({
    code: "unknown",
    message: "Network request failed.",
    retryable: false,
    url,
  });
}
