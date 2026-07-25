"use client";

import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarProvider, useSidebar } from "@/components/sidebar/sidebar-context";
import { Button } from "@/components/ui/button";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type ShellProps = {
  email?: string | null;
  role?: string;
  name?: string | null;
  children: React.ReactNode;
};

function ShellInner({ email, role, name, children }: ShellProps) {
  const { open, toggle } = useSidebar();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar email={email} role={role} name={name} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={toggle}
              aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                AI Knowledge Base
              </p>
              <p className="truncate text-xs text-text-secondary">
                Secure knowledge workspace · session lasts up to 8 hours
              </p>
            </div>
          </div>
          <span
            className={cn(
              "hidden rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent sm:inline",
            )}
          >
            Source-backed answers
          </span>
        </header>
        <main className="relative min-h-0 flex-1 overflow-auto p-4 sm:p-6">
          <div className="ambient-glow top-[-12rem] right-[-8rem] opacity-40" />
          <div className="relative z-10">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function AppShell({ email, role, name, children }: ShellProps) {
  return (
    <SidebarProvider>
      <ShellInner email={email} role={role} name={name}>
        {children}
      </ShellInner>
    </SidebarProvider>
  );
}
