"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <SessionProvider>
        <ConfirmProvider>
          {children}
          <Toaster
            richColors
            position="top-center"
            closeButton
            toastOptions={{
              classNames: {
                toast:
                  "border border-border bg-surface text-foreground shadow-lg",
                title: "font-semibold",
                description: "text-text-secondary",
              },
            }}
          />
          <div className="grain" aria-hidden />
        </ConfirmProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
