import { getEnv } from "@/lib/env";

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export type SendEmailResult = {
  sent: boolean;
  reason?: string;
};

/**
 * Email via Resend HTTP API when RESEND_API_KEY is set.
 * Without a key, logs the payload (dev/fallback) and returns sent:false
 * so admins can still copy invite links from the UI.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const to = Array.isArray(input.to) ? input.to : [input.to];
  const env = getEnv();
  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM ?? "AI Knowledge Base <onboarding@resend.dev>";

  if (!apiKey) {
    console.info("[email] RESEND_API_KEY not set — skipping send", {
      to,
      subject: input.subject,
      text: input.text ?? input.html.replace(/<[^>]+>/g, " ").slice(0, 400),
    });
    return { sent: false, reason: "email_not_configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[email] Resend failed", res.status, body);
    return { sent: false, reason: "provider_error" };
  }

  return { sent: true };
}

export function appBaseUrl() {
  const env = getEnv();
  if (env.AUTH_URL) return env.AUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
