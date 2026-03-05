import { httpAction } from "./_generated/server";

const DEFAULT_BENEFICIARY_APP_RETURN_URL = "queue://rapyd/beneficiary-return";
const DEFAULT_CHECKOUT_APP_RETURN_URL = "queue://rapyd/checkout-return";

const isHttpProtocol = (protocol: string) =>
  protocol === "http:" || protocol === "https:";

const resolveResult = (raw: string | null): "complete" | "cancel" => {
  const value = (raw ?? "").trim().toLowerCase();
  return value === "cancel" ? "cancel" : "complete";
};

const resolveTrustedAppReturnBase = ({
  requested,
  configured,
  fallback,
}: {
  requested: string | null;
  configured: string | undefined;
  fallback: string;
}): string => {
  const configuredValue = (configured ?? "").trim();
  const baseValue = configuredValue || fallback;

  let trustedBase: URL;
  try {
    trustedBase = new URL(baseValue);
  } catch {
    return fallback;
  }

  const requestedValue = (requested ?? "").trim();
  if (!requestedValue) {
    return trustedBase.toString();
  }

  let parsedRequested: URL;
  try {
    parsedRequested = new URL(requestedValue);
  } catch {
    return trustedBase.toString();
  }

  if (parsedRequested.protocol !== trustedBase.protocol) {
    return trustedBase.toString();
  }

  if (isHttpProtocol(trustedBase.protocol)) {
    if (parsedRequested.origin !== trustedBase.origin) {
      return trustedBase.toString();
    }
    return parsedRequested.toString();
  }

  if (parsedRequested.host !== trustedBase.host) {
    return trustedBase.toString();
  }

  return parsedRequested.toString();
};

const buildAppReturnUrl = ({
  appReturnBase,
  result,
  extras,
}: {
  appReturnBase: string;
  result: "complete" | "cancel";
  extras?: Record<string, string | undefined>;
}): string => {
  const parsed = new URL(appReturnBase);
  parsed.searchParams.set("result", result);
  for (const [key, value] of Object.entries(extras ?? {})) {
    if (!value) continue;
    parsed.searchParams.set(key, value);
  }
  return parsed.toString();
};

const buildBridgeHtmlResponse = (appReturnUrl: string) => {
  const escapedAppReturnUrl = appReturnUrl.replace(/"/g, "&quot;");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Return to Queue</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7fafc; color: #0f172a; }
      main { min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 24px; }
      section { width: min(480px, 100%); background: #ffffff; border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.1); }
      h1 { margin: 0 0 8px; font-size: 20px; }
      p { margin: 0 0 16px; color: #334155; line-height: 1.4; }
      a { color: #0ea5e9; font-weight: 600; text-decoration: none; }
      small { display: block; margin-top: 12px; color: #64748b; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>Returning to Queue</h1>
        <p>If the app does not open automatically, tap the link below.</p>
        <a id="open-app" href="${escapedAppReturnUrl}">Open Queue app</a>
        <small>You can close this window after the app opens.</small>
      </section>
    </main>
    <script>
      window.location.replace("${escapedAppReturnUrl}");
      setTimeout(function () {
        var anchor = document.getElementById("open-app");
        if (anchor) anchor.focus();
      }, 700);
    </script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};

export const rapydBeneficiaryReturnBridge = httpAction(async (_ctx, req) => {
  const url = new URL(req.url);
  const result = resolveResult(url.searchParams.get("result"));
  const appReturnBase = resolveTrustedAppReturnBase({
    requested: url.searchParams.get("target"),
    configured: process.env.RAPYD_APP_RETURN_URL,
    fallback: DEFAULT_BENEFICIARY_APP_RETURN_URL,
  });
  const appReturnUrl = buildAppReturnUrl({
    appReturnBase,
    result,
  });
  return buildBridgeHtmlResponse(appReturnUrl);
});

export const rapydCheckoutReturnBridge = httpAction(async (_ctx, req) => {
  const url = new URL(req.url);
  const result = resolveResult(url.searchParams.get("result"));
  const appReturnBase = resolveTrustedAppReturnBase({
    requested: url.searchParams.get("target"),
    configured: process.env.RAPYD_CHECKOUT_APP_RETURN_URL,
    fallback: DEFAULT_CHECKOUT_APP_RETURN_URL,
  });
  const appReturnUrl = buildAppReturnUrl({
    appReturnBase,
    result,
    extras: {
      paymentId: url.searchParams.get("paymentId") ?? undefined,
      checkoutId: url.searchParams.get("checkoutId") ?? undefined,
      jobId: url.searchParams.get("jobId") ?? undefined,
    },
  });
  return buildBridgeHtmlResponse(appReturnUrl);
});
