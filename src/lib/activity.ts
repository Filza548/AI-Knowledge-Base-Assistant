import type { UserRole } from "@/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type ActivityAction =
  | "login_google"
  | "login_credentials"
  | "search"
  | "chat"
  | "chat_small_talk"
  | "upload"
  | "summarize"
  | "extract"
  | "delete_document"
  | "reindex";

type ActivityActor = {
  id: string;
  email?: string | null;
  role?: UserRole | string | null;
};

type LogActivityInput = {
  user: ActivityActor;
  action: ActivityAction;
  details?: Record<string, unknown>;
};

/**
 * Best-effort activity trail for Table Editor / analytics.
 * Never throws — logging must not break the main request.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const role = (input.user.role as UserRole | undefined) ?? "assistant";
    const email = input.user.email?.toLowerCase().trim() || null;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from("activity_logs").insert({
      user_id: input.user.id,
      user_email: email,
      user_role: role,
      action: input.action,
      details: input.details ?? {},
    });

    if (error) {
      console.error("[activity] insert failed:", error.message);
    }
  } catch (err) {
    console.error("[activity] unexpected error:", err);
  }
}

export function searchLogActorFields(user: ActivityActor) {
  return {
    user_id: user.id,
    user_email: user.email?.toLowerCase().trim() || null,
    user_role: (user.role as string | undefined) ?? "assistant",
  };
}
