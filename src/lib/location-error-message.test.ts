import { describe, expect, it } from "bun:test";

import { getLocationResolveErrorMessage } from "./location-error-message";

describe("getLocationResolveErrorMessage", () => {
  const t = (key: string) => `tx:${key}`;

  it("returns translated mapped error key when code is mapped", () => {
    const message = getLocationResolveErrorMessage({
      code: "timeout",
      fallbackMessage: null,
      fallbackKey: "genericError",
      translationPrefix: "onboarding.errors",
      t,
    });

    expect(message).toBe("tx:onboarding.errors.locationTimeout");
  });

  it("returns explicit fallback message when code is unknown", () => {
    const message = getLocationResolveErrorMessage({
      code: "unknown",
      fallbackMessage: "Custom fallback",
      fallbackKey: "genericError",
      translationPrefix: "onboarding.errors",
      t,
    });

    expect(message).toBe("Custom fallback");
  });

  it("falls back to translated fallback key when no fallback message is provided", () => {
    const message = getLocationResolveErrorMessage({
      code: "unsupported_platform",
      fallbackMessage: null,
      fallbackKey: "genericError",
      translationPrefix: "onboarding.errors",
      t,
    });

    expect(message).toBe("tx:onboarding.errors.genericError");
  });
});
