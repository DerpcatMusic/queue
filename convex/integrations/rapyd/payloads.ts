import { omitUndefined } from "../../lib/validation";

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const buildCanonicalRapydPayload = (payload: unknown): Record<string, unknown> => {
  const root = toRecord(payload) ?? {};
  const data = toRecord(root.data);
  const payment = toRecord(data?.payment);
  const payout = toRecord(data?.payout);
  const checkout = toRecord(data?.checkout);
  const metadata = toRecord(data?.metadata);

  return omitUndefined({
    id: toTrimmedString(root.id),
    type: toTrimmedString(root.type) ?? toTrimmedString(root.event),
    data: data
      ? omitUndefined({
          id: toTrimmedString(data.id),
          status: toTrimmedString(data.status),
          merchant_reference_id: toTrimmedString(data.merchant_reference_id),
          payout_method_type: toTrimmedString(data.payout_method_type),
          default_payout_method_type: toTrimmedString(data.default_payout_method_type),
          payment: payment
            ? omitUndefined({
                id: toTrimmedString(payment.id),
                status: toTrimmedString(payment.status),
              })
            : undefined,
          payout: payout
            ? omitUndefined({
                id: toTrimmedString(payout.id),
                status: toTrimmedString(payout.status),
              })
            : undefined,
          checkout: checkout
            ? omitUndefined({
                id: toTrimmedString(checkout.id),
              })
            : undefined,
          metadata: metadata
            ? omitUndefined({
                payoutId: toTrimmedString(metadata.payoutId),
                paymentId: toTrimmedString(metadata.paymentId),
                merchant_reference_id: toTrimmedString(metadata.merchant_reference_id),
              })
            : undefined,
        })
      : undefined,
  });
};
