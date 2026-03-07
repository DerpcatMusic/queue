import { ConvexError } from "convex/values";
import {
  getRequiredEnv,
  type RapydSignatureEncoding,
  resolvePreferredRapydSignatureEncoding,
  resolveRapydBaseUrl,
} from "./config";

export type RapydRestMethod = "GET" | "POST";

export type RapydAvailablePaymentMethod = {
  type: string;
  category?: string;
  paymentFlowType?: string;
  supportedDigitalWalletProviders: string[];
  status?: number;
};

export type RapydCheckoutMethodSelection = {
  requestedSelectors: string[];
  paymentMethodTypesInclude?: string[];
  warnings: string[];
};

const RAPYD_PAYMENT_METHOD_CATEGORIES = new Set([
  "bank_redirect",
  "bank_transfer",
  "card",
  "cash",
  "ewallet",
  "rapyd_ewallet",
]);

const buildBase64FromBytes = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const signRapydPayload = async (payload: string, secretKey: string): Promise<Uint8Array> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return new Uint8Array(signature);
};

export const buildRapydRequestSignature = async ({
  method,
  path,
  salt,
  timestamp,
  accessKey,
  secretKey,
  body,
  encoding,
}: {
  method: string;
  path: string;
  salt: string;
  timestamp: string;
  accessKey: string;
  secretKey: string;
  body: string;
  encoding: RapydSignatureEncoding;
}): Promise<string> => {
  const toSign = `${method.toLowerCase()}${path}${salt}${timestamp}${accessKey}${secretKey}${body}`;
  const signatureBytes = await signRapydPayload(toSign, secretKey);
  if (encoding === "raw_base64") {
    return buildBase64FromBytes(signatureBytes);
  }
  const hexDigest = Array.from(signatureBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return btoa(hexDigest);
};

export const buildRapydWebhookSignature = async ({
  path,
  salt,
  timestamp,
  accessKey,
  secretKey,
  body,
  encoding,
}: {
  path: string;
  salt: string;
  timestamp: string;
  accessKey: string;
  secretKey: string;
  body: string;
  encoding: RapydSignatureEncoding;
}): Promise<string> => {
  const toSign = `${path}${salt}${timestamp}${accessKey}${secretKey}${body}`;
  const signatureBytes = await signRapydPayload(toSign, secretKey);
  if (encoding === "raw_base64") {
    return buildBase64FromBytes(signatureBytes);
  }
  const hexDigest = Array.from(signatureBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return btoa(hexDigest);
};

export const extractRapydErrorCode = (responseText: string): string | undefined => {
  try {
    const payload = JSON.parse(responseText) as {
      status?: { error_code?: string };
    };
    const errorCode = payload.status?.error_code?.trim();
    return errorCode || undefined;
  } catch {
    return undefined;
  }
};

export const executeRapydSignedRequest = async ({
  method,
  url,
  path,
  accessKey,
  secretKey,
  idempotency,
  body,
}: {
  method: RapydRestMethod;
  url: string;
  path: string;
  accessKey: string;
  secretKey: string;
  idempotency?: string;
  body: string;
}): Promise<{
  response: Response;
  responseText: string;
  signatureEncoding: RapydSignatureEncoding;
}> => {
  const preferred = resolvePreferredRapydSignatureEncoding();
  const fallback: RapydSignatureEncoding = preferred === "hex_base64" ? "raw_base64" : "hex_base64";
  const encodings: RapydSignatureEncoding[] = [preferred, fallback];

  let lastResponse: Response | null = null;
  let lastText = "";
  let lastEncoding: RapydSignatureEncoding = preferred;

  for (const encoding of encodings) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const salt = crypto.randomUUID().replace(/-/g, "");
    const signature = await buildRapydRequestSignature({
      method,
      path,
      salt,
      timestamp,
      accessKey,
      secretKey,
      body,
      encoding,
    });

    const response = await fetch(url, {
      method,
      headers: {
        access_key: accessKey,
        salt,
        timestamp,
        signature,
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        ...(idempotency ? { idempotency } : {}),
      },
      ...(method === "POST" ? { body } : {}),
    });
    const responseText = await response.text();
    lastResponse = response;
    lastText = responseText;
    lastEncoding = encoding;

    if (response.status !== 401) {
      return { response, responseText, signatureEncoding: encoding };
    }
  }

  return {
    response: lastResponse as Response,
    responseText: lastText,
    signatureEncoding: lastEncoding,
  };
};

export const executeRapydSignedPost = async ({
  url,
  path,
  accessKey,
  secretKey,
  idempotency,
  body,
}: {
  url: string;
  path: string;
  accessKey: string;
  secretKey: string;
  idempotency: string;
  body: string;
}) =>
  executeRapydSignedRequest({
    method: "POST",
    url,
    path,
    accessKey,
    secretKey,
    idempotency,
    body,
  });

export const executeRapydSignedGet = async ({
  url,
  path,
  accessKey,
  secretKey,
}: {
  url: string;
  path: string;
  accessKey: string;
  secretKey: string;
}) =>
  executeRapydSignedRequest({
    method: "GET",
    url,
    path,
    accessKey,
    secretKey,
    body: "",
  });

const parseConfiguredSelectorTokens = (configured: string | undefined): string[] => {
  const raw = configured?.trim() ?? "";
  if (!raw) return [];
  const selectors = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (selectors.length === 0) {
    throw new ConvexError("RAPYD_PAYMENT_METHODS is set but does not include any valid methods");
  }
  return selectors;
};

const normalizeAvailableMethods = (
  methods: ReadonlyArray<RapydAvailablePaymentMethod>,
): RapydAvailablePaymentMethod[] =>
  methods
    .filter((method) => method.type.trim().length > 0)
    .filter((method) => method.status === undefined || method.status === 1)
    .map((method) => ({
      type: method.type.trim().toLowerCase(),
      supportedDigitalWalletProviders: method.supportedDigitalWalletProviders.map((provider) =>
        provider.trim().toLowerCase(),
      ),
      ...(method.category?.trim() ? { category: method.category.trim().toLowerCase() } : {}),
      ...(method.paymentFlowType?.trim()
        ? { paymentFlowType: method.paymentFlowType.trim().toLowerCase() }
        : {}),
      ...(method.status !== undefined ? { status: method.status } : {}),
    }));

const matchSelectorToTypes = (
  selector: string,
  availableMethods: ReadonlyArray<RapydAvailablePaymentMethod>,
): string[] => {
  const normalized = selector.trim().toLowerCase();
  if (!normalized) return [];

  const exactType = availableMethods.find((method) => method.type === normalized);
  if (exactType) {
    return [exactType.type];
  }

  const explicitType = normalized.startsWith("type:")
    ? normalized.slice("type:".length).trim()
    : "";
  if (explicitType) {
    const direct = availableMethods.find((method) => method.type === explicitType);
    return direct ? [direct.type] : [];
  }

  const explicitCategory = normalized.startsWith("category:")
    ? normalized.slice("category:".length).trim()
    : "";
  const explicitWallet = normalized.startsWith("wallet:")
    ? normalized.slice("wallet:".length).trim()
    : "";

  const categoryCandidate =
    explicitCategory ||
    (RAPYD_PAYMENT_METHOD_CATEGORIES.has(normalized)
      ? normalized
      : (() => {
          const suffix = normalized.includes("_")
            ? normalized.slice(normalized.lastIndexOf("_") + 1)
            : "";
          return RAPYD_PAYMENT_METHOD_CATEGORIES.has(suffix) ? suffix : "";
        })());
  if (categoryCandidate) {
    return availableMethods
      .filter(
        (method) =>
          method.category === categoryCandidate || method.paymentFlowType === categoryCandidate,
      )
      .map((method) => method.type);
  }

  const walletCandidate = explicitWallet || normalized;
  return availableMethods
    .filter((method) => method.supportedDigitalWalletProviders.includes(walletCandidate))
    .map((method) => method.type);
};

export const resolveRapydCheckoutMethodSelectionFromAvailableMethods = ({
  configured,
  availableMethods,
}: {
  configured: string | undefined;
  availableMethods: ReadonlyArray<RapydAvailablePaymentMethod>;
}): RapydCheckoutMethodSelection => {
  const requestedSelectors = parseConfiguredSelectorTokens(configured);
  if (requestedSelectors.length === 0) {
    return { requestedSelectors, warnings: [] };
  }

  const warnings: string[] = [];
  const includedTypes: string[] = [];
  const seenTypes = new Set<string>();
  const normalizedMethods = normalizeAvailableMethods(availableMethods);

  for (const selector of requestedSelectors) {
    const matchedTypes = matchSelectorToTypes(selector, normalizedMethods);
    if (matchedTypes.length === 0) {
      warnings.push(`Unrecognized Rapyd payment selector: ${selector}`);
      continue;
    }
    for (const matchedType of matchedTypes) {
      if (seenTypes.has(matchedType)) continue;
      seenTypes.add(matchedType);
      includedTypes.push(matchedType);
    }
  }

  return {
    requestedSelectors,
    warnings,
    ...(includedTypes.length > 0 ? { paymentMethodTypesInclude: includedTypes } : {}),
  };
};

export const listRapydPaymentMethodsByCountry = async ({
  accessKey,
  secretKey,
  baseUrl,
  country,
  currency,
}: {
  accessKey: string;
  secretKey: string;
  baseUrl: string;
  country: string;
  currency: string;
}): Promise<RapydAvailablePaymentMethod[]> => {
  const requestPath = `/v1/payment_methods/countries/${country}?currency=${currency}`;
  const requestUrl = new URL(requestPath, `${baseUrl}/`);
  const { response, responseText, signatureEncoding } = await executeRapydSignedGet({
    url: requestUrl.toString(),
    path: `${requestUrl.pathname}${requestUrl.search}`,
    accessKey,
    secretKey,
  });

  if (!response.ok) {
    const snippet = responseText.slice(0, 500);
    throw new ConvexError(
      `Rapyd payment method lookup failed (HTTP ${response.status}) [${signatureEncoding}]: ${snippet}`,
    );
  }

  const payload = JSON.parse(responseText) as {
    status?: { status?: string; message?: string; error_code?: string };
    data?: Array<{
      type?: string;
      category?: string;
      payment_flow_type?: string;
      supported_digital_wallet_providers?: string[];
      status?: number;
    }>;
  };

  const providerStatus = payload.status?.status ?? "ERROR";
  if (providerStatus !== "SUCCESS" || !Array.isArray(payload.data)) {
    const providerReason = payload.status?.message ?? payload.status?.error_code ?? "Unknown error";
    throw new ConvexError(`Rapyd payment method lookup rejected: ${providerReason}`);
  }

  return payload.data
    .filter((method) => typeof method.type === "string" && method.type.trim().length > 0)
    .map((method) => ({
      type: method.type!.trim(),
      supportedDigitalWalletProviders: Array.isArray(method.supported_digital_wallet_providers)
        ? method.supported_digital_wallet_providers
            .filter((provider): provider is string => typeof provider === "string")
            .map((provider) => provider.trim())
            .filter((provider) => provider.length > 0)
        : [],
      ...(method.category?.trim() ? { category: method.category.trim() } : {}),
      ...(method.payment_flow_type?.trim()
        ? { paymentFlowType: method.payment_flow_type.trim() }
        : {}),
      ...(typeof method.status === "number" ? { status: method.status } : {}),
    }));
};

export const resolveRapydCheckoutMethodSelection = async ({
  configured,
  country,
  currency,
  accessKey,
  secretKey,
  baseUrl,
}: {
  configured: string | undefined;
  country: string;
  currency: string;
  accessKey: string;
  secretKey: string;
  baseUrl: string;
}): Promise<RapydCheckoutMethodSelection> => {
  const requestedSelectors = parseConfiguredSelectorTokens(configured);
  if (requestedSelectors.length === 0) {
    return { requestedSelectors, warnings: [] };
  }

  try {
    const availableMethods = await listRapydPaymentMethodsByCountry({
      accessKey,
      secretKey,
      baseUrl,
      country,
      currency,
    });
    return resolveRapydCheckoutMethodSelectionFromAvailableMethods({
      configured,
      availableMethods,
    });
  } catch (error) {
    return {
      requestedSelectors,
      warnings: [
        error instanceof Error
          ? `Failed to resolve Rapyd payment selectors dynamically: ${error.message}`
          : "Failed to resolve Rapyd payment selectors dynamically",
      ],
    };
  }
};

export const resolveRapydRequestCredentials = () => ({
  accessKey: getRequiredEnv("RAPYD_ACCESS_KEY"),
  secretKey: getRequiredEnv("RAPYD_SECRET_KEY"),
  baseUrl: resolveRapydBaseUrl(),
});
