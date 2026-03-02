const DEFAULT_BENEFICIARY_APP_RETURN_URL = "queue://rapyd/beneficiary-return";
const DEFAULT_CHECKOUT_APP_RETURN_URL = "queue://rapyd/checkout-return";

const ensureAbsoluteUrl = (value: string, label: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required`);
  }
  try {
    return new URL(trimmed).toString();
  } catch {
    throw new Error(`${label} must be a valid absolute URL`);
  }
};

export const resolveConvexSiteUrl = (): string => {
  const explicit = process.env.EXPO_PUBLIC_CONVEX_SITE_URL?.trim();
  if (explicit) {
    return ensureAbsoluteUrl(explicit, "EXPO_PUBLIC_CONVEX_SITE_URL");
  }

  const cloud = process.env.EXPO_PUBLIC_CONVEX_URL?.trim();
  if (!cloud) {
    throw new Error("Missing EXPO_PUBLIC_CONVEX_URL or EXPO_PUBLIC_CONVEX_SITE_URL");
  }

  try {
    const parsed = new URL(cloud);
    if (parsed.hostname.endsWith(".convex.cloud")) {
      parsed.hostname = parsed.hostname.replace(".convex.cloud", ".convex.site");
    }
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    throw new Error("EXPO_PUBLIC_CONVEX_URL must be a valid absolute URL");
  }
};

export const resolveRapydAppReturnUrl = (kind: "beneficiary" | "checkout"): string => {
  const explicit =
    kind === "checkout"
      ? process.env.EXPO_PUBLIC_RAPYD_CHECKOUT_APP_RETURN_URL?.trim()
      : process.env.EXPO_PUBLIC_RAPYD_APP_RETURN_URL?.trim();
  if (explicit) {
    return ensureAbsoluteUrl(
      explicit,
      kind === "checkout"
        ? "EXPO_PUBLIC_RAPYD_CHECKOUT_APP_RETURN_URL"
        : "EXPO_PUBLIC_RAPYD_APP_RETURN_URL",
    );
  }
  return kind === "checkout" ? DEFAULT_CHECKOUT_APP_RETURN_URL : DEFAULT_BENEFICIARY_APP_RETURN_URL;
};

export const buildRapydBridgeUrl = ({
  bridgePath,
  result,
  appReturnUrl,
  query,
}: {
  bridgePath: "/rapyd/beneficiary-return-bridge" | "/rapyd/checkout-return-bridge";
  result: "complete" | "cancel";
  appReturnUrl: string;
  query?: Record<string, string | undefined>;
}): string => {
  const bridge = new URL(bridgePath, resolveConvexSiteUrl());
  bridge.searchParams.set("result", result);
  bridge.searchParams.set("target", appReturnUrl);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (!value) continue;
    bridge.searchParams.set(key, value);
  }

  return bridge.toString();
};
