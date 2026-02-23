import { Email } from "@convex-dev/auth/providers/Email";
import { type RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { Resend as ResendApi } from "resend";

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
    const { error } = await resend.emails.send({
      from: process.env.AUTH_EMAIL_FROM ?? "Queue <onboarding@resend.dev>",
      to: [email],
      subject: "Your Queue sign-in code",
      text: `Your verification code is ${token}`,
    });

    if (error) {
      throw new Error(JSON.stringify(error));
    }
  },
});
