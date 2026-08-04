import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AccountSettingsForm } from "@/components/account/account-settings-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
    return null;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("name, email, role, password_hash")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    redirect({ href: "/login", locale });
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
          Account
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Profile settings</h1>
        <p className="text-sm text-text-secondary">
          Update your display name or password. Email stays fixed for security.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountSettingsForm
            name={data.name}
            email={data.email}
            role={data.role}
            hasPassword={Boolean(data.password_hash)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
