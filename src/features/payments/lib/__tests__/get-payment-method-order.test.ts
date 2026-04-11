import { describe, expect, it } from "vitest";
import { getPaymentMethodOrder } from "../get-payment-method-order";

describe("getPaymentMethodOrder", () => {
  it("returns SEPA debit first for EUR", () => {
    expect(getPaymentMethodOrder("EUR")).toEqual(["sepa_debit", "card"]);
  });

  it("returns SEPA debit first for lowercase eur", () => {
    expect(getPaymentMethodOrder("eur")).toEqual(["sepa_debit", "card"]);
  });

  it("returns BACS first for GBP", () => {
    expect(getPaymentMethodOrder("GBP")).toEqual(["bacs_debit", "card"]);
  });

  it("returns card only for ILS", () => {
    expect(getPaymentMethodOrder("ILS")).toEqual(["card"]);
  });

  it("returns card only for USD", () => {
    expect(getPaymentMethodOrder("USD")).toEqual(["card"]);
  });

  it("returns card only for unknown currency", () => {
    expect(getPaymentMethodOrder("XYZ")).toEqual(["card"]);
  });
});