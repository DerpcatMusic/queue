export const toAgorot = (amount: number): number => Math.max(0, Math.round(amount * 100));

export const normalizeOptionalText = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};
