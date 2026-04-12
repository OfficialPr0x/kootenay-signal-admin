import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  idempotencyKey?: string;
}

export async function sendEmail({ to, subject, html, replyTo, idempotencyKey }: SendEmailOptions) {
  const from = process.env.FROM_EMAIL || "Kootenay Signal <onboarding@resend.dev>";

  const { data, error } = await resend.emails.send({
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    ...(replyTo && { replyTo }),
    ...(idempotencyKey && { idempotencyKey }),
  });

  if (error) {
    console.error("Email send error:", error);
    return { success: false, error: error.message };
  }

  return { success: true, id: data?.id };
}
