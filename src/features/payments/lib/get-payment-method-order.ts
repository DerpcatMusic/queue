export function getPaymentMethodOrder(currency: string): string[] {
  const c = currency.toUpperCase();
  switch (c) {
    case "EUR":
      return ["sepa_debit", "card"];
    case "GBP":
      return ["bacs_debit", "card"];
    default:
      return ["card"];
  }
}