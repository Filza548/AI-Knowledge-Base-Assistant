"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { LogoMark } from "@/components/brand/logo-mark";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.4, ease: "easeOut" as const },
  }),
};

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen overflow-hidden bg-background">
      <div className="ambient-glow -top-24 -left-24" />
      <div className="ambient-glow right-[-10%] bottom-[-20%] opacity-60" />

      <section className="relative z-10 hidden w-[52%] flex-col overflow-hidden border-r border-border lg:flex">
        <div className="absolute inset-0">
          <Image
            src="/images/kb-hero.png"
            alt="AI Knowledge Base introduction"
            fill
            priority
            className="object-cover object-center opacity-90"
            sizes="52vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/40" />
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between px-12 py-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
            className="flex items-center gap-3"
          >
            <LogoMark size={48} animated />
            <div>
              <p className="text-lg font-bold tracking-tight">
                <span className="text-primary">AI</span> Knowledge Base
              </p>
              <p className="text-sm text-text-secondary">
                Ask your documents. Get answers with sources.
              </p>
            </div>
          </motion.div>

          <div className="max-w-lg space-y-5">
            <motion.p
              custom={0}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="text-xs font-semibold tracking-[0.18em] text-primary uppercase"
            >
              Company access
            </motion.p>
            <motion.h1
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="text-4xl font-extrabold leading-tight tracking-tight text-foreground xl:text-[2.75rem]"
            >
              Invite-only knowledge for{" "}
              <span className="text-primary">your team.</span>
            </motion.h1>
            <motion.p
              custom={2}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="text-base leading-relaxed text-text-secondary"
            >
              Admins invite teammates or approve signup requests. Google sign-in
              works only for invited or approved accounts — not the open web.
            </motion.p>
          </div>

          <div className="flex gap-3">
            <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-border shadow-sm">
              <Image src="/images/kb-chat.png" alt="" fill className="object-cover" />
            </div>
            <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-border shadow-sm">
              <Image src="/images/kb-docs.png" alt="" fill className="object-cover" />
            </div>
            <p className="self-center text-xs text-text-secondary/80">
              Secure · invite-gated · source-backed
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        {children}
      </section>
    </main>
  );
}

export function GoogleGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 48 48"
      aria-hidden
      className="shrink-0"
    >
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7 12.9 19.6C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.2 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.1 5.5l.1.1 6.2 5.2C39.2 37.3 44 33 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}
