import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { appBaseUrl, sendEmail } from "@/lib/email";

export type UserStatus = "invited" | "pending" | "active" | "rejected";

export function newInviteToken() {
  return randomBytes(32).toString("hex");
}

export function inviteExpiresAt(days = 14) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function listAdminEmails(): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("email")
    .eq("role", "admin")
    .eq("status", "active");
  if (error) throw error;
  return (data ?? []).map((u) => u.email).filter(Boolean);
}

export async function sendInviteEmail(input: {
  email: string;
  name: string;
  token: string;
}) {
  const link = `${appBaseUrl()}/signup?invite=${encodeURIComponent(input.token)}`;
  const result = await sendEmail({
    to: input.email,
    subject: "You're invited to AI Knowledge Base",
    text: `Hi ${input.name},\n\nAn admin invited you to AI Knowledge Base.\nAccept your invite: ${link}\n\nYou can set a password or continue with Google (same email).`,
    html: `
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>An admin invited you to <strong>AI Knowledge Base</strong>.</p>
      <p><a href="${link}">Accept invite &amp; get access</a></p>
      <p>You can set a password, or use <strong>Continue with Google</strong> with this same email.</p>
      <p style="color:#667">If you did not expect this, ignore this email.</p>
    `,
  });
  return { ...result, inviteUrl: link };
}

export async function sendSignupRequestToAdmins(input: {
  name: string;
  email: string;
}) {
  const admins = await listAdminEmails();
  if (!admins.length) {
    console.warn("[email] no active admins to notify about signup request");
    return { sent: false, reason: "no_admins" as const };
  }
  const link = `${appBaseUrl()}/admin-settings`;
  return sendEmail({
    to: admins,
    subject: `Access request: ${input.email}`,
    text: `${input.name} (${input.email}) requested access to AI Knowledge Base. Review in Admin Settings: ${link}`,
    html: `
      <p><strong>${escapeHtml(input.name)}</strong> (<code>${escapeHtml(input.email)}</code>) requested access.</p>
      <p>Approve or reject in <a href="${link}">Admin Settings</a>.</p>
    `,
  });
}

export async function sendAccessApprovedEmail(input: {
  email: string;
  name: string;
}) {
  const link = `${appBaseUrl()}/login`;
  return sendEmail({
    to: input.email,
    subject: "Access approved — AI Knowledge Base",
    text: `Hi ${input.name},\n\nYour access was approved. Sign in: ${link}`,
    html: `
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>Your access to <strong>AI Knowledge Base</strong> was approved.</p>
      <p><a href="${link}">Sign in</a></p>
    `,
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
