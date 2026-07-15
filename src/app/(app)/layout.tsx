import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/sidebar/app-shell";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

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
