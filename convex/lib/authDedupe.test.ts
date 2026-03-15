import { describe, expect, it } from "bun:test";

import { canProceedWithEmailDedupe } from "./authDedupe";

describe("canProceedWithEmailDedupe", () => {
  it("allows dedupe when verification is not required", () => {
    expect(
      canProceedWithEmailDedupe({
        requireVerifiedUser: false,
        users: [{}, {}],
      }),
    ).toBe(true);
  });

  it("allows dedupe when the current sign-in already proved email ownership", () => {
    expect(
      canProceedWithEmailDedupe({
        requireVerifiedUser: true,
        emailOwnershipVerified: true,
        users: [{}, {}],
      }),
    ).toBe(true);
  });

  it("allows dedupe when an existing duplicate already has a verified email", () => {
    expect(
      canProceedWithEmailDedupe({
        requireVerifiedUser: true,
        users: [{}, { emailVerificationTime: Date.now() }],
      }),
    ).toBe(true);
  });

  it("blocks dedupe when verification is required but no email ownership is verified", () => {
    expect(
      canProceedWithEmailDedupe({
        requireVerifiedUser: true,
        users: [{}, {}],
      }),
    ).toBe(false);
  });
});
