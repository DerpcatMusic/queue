import { Email } from "@convex-dev/auth/providers/Email";
import { generateRandomString, type RandomReader } from "@oslojs/crypto/random";
import { Resend as ResendApi } from "resend";
import { sendResendEmailWithDevFallback } from "../lib/resendDevRouting";

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
    const resend = new ResendApi(provider.apiKey);
    await sendResendEmailWithDevFallback({
      resend,
      from: process.env.AUTH_EMAIL_FROM ?? "Queue <onboarding@resend.dev>",
      originalTo: email,
      subject: "Your Queue sign-in code",
      text: `Your verification code is ${token}`,
    });
  },
});
