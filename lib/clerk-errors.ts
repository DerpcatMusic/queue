export function getClerkErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "errors" in error &&
    Array.isArray((error as { errors?: unknown[] }).errors)
  ) {
    const firstError = (
      error as {
        errors?: { longMessage?: string; message?: string; code?: string }[];
      }
    ).errors?.[0];
    const codeSuffix = firstError?.code ? ` [${firstError.code}]` : "";

    if (firstError?.longMessage) {
      return `${firstError.longMessage}${codeSuffix}`;
    }
    if (firstError?.message) {
      return `${firstError.message}${codeSuffix}`;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
