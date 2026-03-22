import { Email } from "@convex-dev/auth/providers/Email";
import { generateRandomString, type RandomReader } from "@oslojs/crypto/random";
import { Resend as ResendApi } from "resend";

function resolveRecipient(email: string) {
  // Only reroute in non-production environments to prevent accidental mass account takeover
  const isDev = process.env.NODE_ENV !== "production";
  const devInbox = isDev ? process.env.AUTH_EMAIL_DEV_INBOX?.trim() : undefined;
  const shouldReroute = Boolean(devInbox);
  return {
    to: shouldReroute ? devInbox! : email,
    shouldReroute,
  };
}

export const ResendOTP = Email({
  id: "resend-otp",
  apiKey: (process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY)!,
  maxAge: 60 * 15,
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes) {
        crypto.getRandomValues(bytes);
      },
    };

    return generateRandomString(random, "0123456789", 6);
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const { to, shouldReroute } = resolveRecipient(email);
    const resend = new ResendApi(provider.apiKey);
    const { error } = await resend.emails.send({
      from: process.env.AUTH_EMAIL_FROM ?? "Queue <onboarding@resend.dev>",
      to: [to],
      subject: "Your Queue sign-in code",
      text: shouldReroute
        ? `Dev reroute target: ${email}\nYour verification code is ${token}`
        : `Your verification code is ${token}`,
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
