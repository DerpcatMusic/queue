import { Email } from "@convex-dev/auth/providers/Email";
import { Resend as ResendApi } from "resend";

function resolveRecipient(email: string) {
  const devInbox = process.env.AUTH_EMAIL_DEV_INBOX?.trim();
  const shouldReroute = Boolean(devInbox);
  return {
    to: shouldReroute ? devInbox! : email,
    shouldReroute,
  };
}

export const ResendMagicLink = Email({
  id: "resend",
  apiKey: (process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY)!,
  async authorize() {
    // Magic-link flow: token alone is enough to proceed.
  },
  maxAge: 60 * 30,
  async sendVerificationRequest({ identifier: email, provider, url }) {
    const { to, shouldReroute } = resolveRecipient(email);
    const resend = new ResendApi(provider.apiKey);
    const { error } = await resend.emails.send({
      from: process.env.AUTH_EMAIL_FROM ?? "Queue <onboarding@resend.dev>",
      to: [to],
      subject: "Your Queue magic sign-in link",
      text: shouldReroute
        ? `Dev reroute target: ${email}\nUse this sign-in link: ${url}`
        : `Use this sign-in link: ${url}`,
      html: shouldReroute
        ? `<p>Dev reroute target: <strong>${email}</strong></p><p><a href="${url}">Sign in to Queue</a></p>`
        : `<p><a href="${url}">Sign in to Queue</a></p>`,
    });

    if (error) {
      throw new Error(
        JSON.stringify({
          ...error,
          hint: "If using Resend test mode, set AUTH_EMAIL_DEV_INBOX to your verified testing inbox or verify a sender domain and use AUTH_EMAIL_FROM.",
        }),
      );
    }
  },
});
