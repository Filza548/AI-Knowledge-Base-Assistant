import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/sidebar/app-sidebar";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-zinc-100">
      <AppSidebar email={session.user.email} role={session.user.role} />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-zinc-200 bg-white px-6">
          <p className="text-sm text-zinc-500">
            Secure knowledge workspace · session expires in 15 minutes
          </p>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
