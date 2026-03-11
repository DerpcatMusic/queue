const DEFAULT_BENEFICIARY_APP_RETURN_URL = "queue://rapyd/beneficiary-return";
const DEFAULT_CHECKOUT_APP_RETURN_URL = "queue://rapyd/checkout-return";

export type RapydReturnKind = "beneficiary" | "checkout";
export type RapydReturnResult = "cancel" | "complete";

export type RapydReturnPayload = {
  kind: RapydReturnKind;
  result: RapydReturnResult;
  url: string;
  receivedAt: number;
  jobId?: string;
};

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

const normalizeRapydReturnPath = (url: URL): string => {
  const host = url.hostname.trim().toLowerCase();
  const pathname = url.pathname.trim().toLowerCase();
  if (url.protocol === "queue:" && host === "rapyd") {
    return pathname || "/";
  }
  return pathname;
};

export const parseRapydReturnUrl = (url: string): RapydReturnPayload | null => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const path = normalizeRapydReturnPath(parsed);
  const kind: RapydReturnKind | null =
    path === "/beneficiary-return"
      ? "beneficiary"
      : path === "/checkout-return" || path === "/rapyd/checkout-return"
        ? "checkout"
        : path === "/rapyd/beneficiary-return"
          ? "beneficiary"
          : null;
  if (!kind) {
    return null;
  }

  const rawResult = parsed.searchParams.get("result")?.trim().toLowerCase();
  const result: RapydReturnResult = rawResult === "cancel" ? "cancel" : "complete";
  const jobId = parsed.searchParams.get("jobId")?.trim() || undefined;

  return {
    kind,
    result,
    url: parsed.toString(),
    receivedAt: Date.now(),
    ...(jobId ? { jobId } : {}),
  };
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
