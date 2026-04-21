function trimEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isAllowedRedirectTarget(redirectTo: string) {
  if (redirectTo.startsWith("/")) {
    return true;
  }
  if (redirectTo.startsWith("queue://") || redirectTo.startsWith("exp://")) {
    return true;
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(redirectTo)) {
    return true;
  }

  const siteOrigin = normalizeOrigin(process.env.SITE_URL);
  const convexSiteOrigin = normalizeOrigin(process.env.CONVEX_SITE_URL);

  try {
    const candidateOrigin = new URL(redirectTo).origin;
    return candidateOrigin === siteOrigin || candidateOrigin === convexSiteOrigin;
  } catch {
    return false;
  }
}

export function getFallbackRedirectTarget() {
  return process.env.SITE_URL ?? process.env.CONVEX_SITE_URL ?? "http://localhost:3000";
}

export { trimEnv };
