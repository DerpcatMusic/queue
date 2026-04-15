import { Email } from "@convex-dev/auth/providers/Email";
import { Resend as ResendApi } from "resend";
import { sendResendEmailWithDevFallback } from "../lib/resendDevRouting";

export const ResendMagicLink = Email({
  id: "resend",
  apiKey: (process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY)!,
  async authorize() {
    // Magic-link flow: token alone is enough to proceed.
  },
  maxAge: 60 * 30,
  async sendVerificationRequest({ identifier: email, provider, url }) {
    const resend = new ResendApi(provider.apiKey);
    await sendResendEmailWithDevFallback({
      resend,
      from: process.env.AUTH_EMAIL_FROM ?? "Queue <onboarding@resend.dev>",
      originalTo: email,
      subject: "Your Queue magic sign-in link",
      text: `Use this sign-in link: ${url}`,
      html: `<p><a href="${url}">Sign in to Queue</a></p>`,
    });
  },
});
