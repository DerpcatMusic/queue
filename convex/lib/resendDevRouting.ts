import { Resend as ResendApi } from "resend";

type SendResendEmailArgs = {
  from: string;
  html?: string;
  originalTo: string;
  resend: ResendApi;
  subject: string;
  text: string;
};

function isDevEnvironment() {
  return process.env.NODE_ENV !== "production";
}

function getConfiguredDevInbox() {
  return isDevEnvironment() ? process.env.AUTH_EMAIL_DEV_INBOX?.trim() : undefined;
}

function buildDevReroutedText(originalTo: string, text: string) {
  return `Dev reroute target: ${originalTo}\n\n${text}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildDevReroutedHtml(originalTo: string, html?: string) {
  const banner = `<p>Dev reroute target: <strong>${escapeHtml(originalTo)}</strong></p>`;
  return html ? `${banner}${html}` : banner;
}

function parseResendTestingInbox(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "";
  const match = message.match(/own email address \(([^)]+)\)/i);
  return match?.[1]?.trim() || null;
}

function formatResendError(error: Record<string, unknown>) {
  return new Error(
    JSON.stringify({
      ...error,
      hint: "If using Resend test mode, set AUTH_EMAIL_DEV_INBOX to your verified testing inbox or verify a sender domain and use AUTH_EMAIL_FROM.",
    }),
  );
}

export async function sendResendEmailWithDevFallback({
  from,
  html,
  originalTo,
  resend,
  subject,
  text,
}: SendResendEmailArgs) {
  const configuredDevInbox = getConfiguredDevInbox();
  const initialTarget = configuredDevInbox || originalTo;
  const initialText =
    configuredDevInbox && configuredDevInbox !== originalTo
      ? buildDevReroutedText(originalTo, text)
      : text;
  const initialHtml =
    configuredDevInbox && configuredDevInbox !== originalTo
      ? buildDevReroutedHtml(originalTo, html)
      : html;

  const firstAttempt = await resend.emails.send({
    from,
    to: [initialTarget],
    subject,
    text: initialText,
    ...(initialHtml ? { html: initialHtml } : {}),
  });

  if (!firstAttempt.error) {
    return;
  }

  const detectedTestingInbox =
    !configuredDevInbox && isDevEnvironment()
      ? parseResendTestingInbox(firstAttempt.error)
      : null;

  if (detectedTestingInbox && detectedTestingInbox !== initialTarget) {
    const retryAttempt = await resend.emails.send({
      from,
      to: [detectedTestingInbox],
      subject,
      text: buildDevReroutedText(originalTo, text),
      html: buildDevReroutedHtml(originalTo, html),
    });

    if (!retryAttempt.error) {
      return;
    }

    throw formatResendError(retryAttempt.error as Record<string, unknown>);
  }

  throw formatResendError(firstAttempt.error as Record<string, unknown>);
}
