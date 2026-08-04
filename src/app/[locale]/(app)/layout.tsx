import { getLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { AppShell } from "@/components/sidebar/app-shell";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  if (!session) {
    redirect({ href: "/login", locale });
    return null;
  }

  return (
    <AppShell
      email={session.user.email}
      role={session.user.role}
      name={session.user.name}
    >
      {children}
    </AppShell>
  );
}
