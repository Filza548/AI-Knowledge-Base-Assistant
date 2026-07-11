"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type AppSidebarProps = {
  email?: string | null;
  role?: string;
};

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/document-workspace", label: "Documents", icon: BookOpen },
];

export function AppSidebar({ email, role }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-zinc-200 bg-zinc-50">
      <div className="border-b border-zinc-200 px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">Knowledge AI</p>
            <p className="text-xs text-zinc-500">Enterprise assistant</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-700 hover:bg-zinc-200/70",
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
        {role === "admin" ? (
          <Link
            href="/admin-settings"
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              pathname.startsWith("/admin-settings")
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-200/70",
            )}
          >
            <Settings className="h-4 w-4" />
            Admin
          </Link>
        ) : null}
      </nav>

      <div className="border-t border-zinc-200 p-4">
        <p className="truncate text-xs text-zinc-500">{email}</p>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
          {role}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
