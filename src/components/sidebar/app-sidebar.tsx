"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Settings,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandLockup, LogoMark } from "@/components/brand/logo-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { useSidebar } from "@/components/sidebar/sidebar-context";

type AppSidebarProps = {
  email?: string | null;
  role?: string;
  name?: string | null;
};

const links = [
  {
    href: "/dashboard",
    label: "Dashboard",
    hint: "Ask & chat",
    icon: LayoutDashboard,
  },
  {
    href: "/document-workspace",
    label: "Documents",
    hint: "Summarize · extract",
    icon: BookOpen,
  },
];

export function AppSidebar({ email, role, name }: AppSidebarProps) {
  const pathname = usePathname();
  const { open, toggle } = useSidebar();

  return (
    <motion.aside
      initial={false}
      animate={{ width: open ? 288 : 84 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="sticky top-0 z-30 flex h-screen shrink-0 flex-col overflow-hidden border-r border-white/10 bg-sidebar text-sidebar-fg"
    >
      <div
        className={cn(
          "flex items-center border-b border-white/10 py-5",
          open ? "justify-between gap-2 px-4" : "flex-col gap-3 px-2",
        )}
      >
        {open ? (
          <BrandLockup size={40} inverted subtitle="Enterprise RAG workspace" />
        ) : (
          <LogoMark size={36} />
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={open ? "Close sidebar" : "Open sidebar"}
          className="shrink-0 text-sidebar-fg hover:bg-white/10 hover:text-white"
        >
          {open ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className={cn("px-3 pt-4", !open && "px-2")}>
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key="intro"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3"
            >
              <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
                Workspace
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {name ? `Hi, ${name.split(" ")[0]}` : "Knowledge hub"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-sidebar-fg/60">
                Search indexed PDFs, get cited answers, and manage collections
                from one place.
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {open ? (
          <p className="mb-1 px-2 text-[10px] font-semibold tracking-[0.18em] text-sidebar-fg/40 uppercase">
            Navigate
          </p>
        ) : null}
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              title={link.label}
              className={cn(
                "relative flex items-center rounded-xl transition-colors",
                open ? "gap-2.5 px-3 py-2.5" : "justify-center px-2 py-3",
                active
                  ? "bg-primary/20 text-white"
                  : "text-sidebar-fg/70 hover:bg-white/5 hover:text-white",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute top-1.5 bottom-1.5 left-0 w-1 rounded-full bg-accent"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              ) : null}
              <Icon className="h-4 w-4 shrink-0" />
              {open ? (
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{link.label}</span>
                  <span className="block truncate text-[11px] text-sidebar-fg/45">
                    {link.hint}
                  </span>
                </span>
              ) : null}
            </Link>
          );
        })}
        {role === "admin" ? (
          <Link
            href="/admin-settings"
            title="Admin Settings"
            className={cn(
              "relative flex items-center rounded-xl transition-colors",
              open ? "gap-2.5 px-3 py-2.5" : "justify-center px-2 py-3",
              pathname.startsWith("/admin-settings")
                ? "bg-primary/20 text-white"
                : "text-sidebar-fg/70 hover:bg-white/5 hover:text-white",
            )}
          >
            {pathname.startsWith("/admin-settings") ? (
              <motion.span
                layoutId="sidebar-active"
                className="absolute top-1.5 bottom-1.5 left-0 w-1 rounded-full bg-accent"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            ) : null}
            <Settings className="h-4 w-4 shrink-0" />
            {open ? (
              <span className="min-w-0">
                <span className="block text-sm font-medium">Admin Settings</span>
                <span className="block truncate text-[11px] text-sidebar-fg/45">
                  Upload · users · analytics
                </span>
              </span>
            ) : null}
          </Link>
        ) : null}
      </nav>

      <div
        className={cn(
          "mt-auto space-y-3 border-t border-white/10",
          open ? "p-4" : "p-2",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2",
            open ? "justify-between" : "flex-col",
          )}
        >
          {open ? (
            <Badge className="border-white/10 bg-white/5 capitalize text-sidebar-fg/80">
              {role ?? "viewer"}
            </Badge>
          ) : null}
          <ThemeToggle />
        </div>
        {open ? (
          <p className="truncate text-xs text-sidebar-fg/55">{email}</p>
        ) : null}
        <Button
          variant="outline"
          size={open ? "sm" : "icon"}
          className={cn(
            "border-white/15 bg-transparent text-sidebar-fg hover:bg-white/10 hover:text-white",
            open && "w-full",
          )}
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
          {open ? "Sign out" : null}
        </Button>
      </div>
    </motion.aside>
  );
}
