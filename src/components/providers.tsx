"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <SessionProvider>
        {children}
        <Toaster richColors position="top-right" />
        <div className="grain" aria-hidden />
      </SessionProvider>
    </ThemeProvider>
  );
}
