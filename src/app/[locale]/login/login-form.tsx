"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogoMark } from "@/components/brand/logo-mark";
import { LanguageToggle } from "@/components/language-toggle";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.4, ease: "easeOut" as const },
  }),
};

/** Only allow same-origin relative paths (block open redirects). */
function safeCallbackUrl(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return "/dashboard";
  }
  return raw;
}

function authErrorMessage(code: string | null): string | null {
  if (!code) return null;
  if (code === "AccessDenied" || code === "OAuthAccountNotLinked") {
    return "Google sign-in is only for invited or approved users. Request access via Sign up, or ask an admin for an invite.";
  }
  if (code === "Configuration") {
    return "Sign-in is misconfigured. Contact your admin.";
  }
  return "Sign-in failed. Try again or use email and password.";
}

export default function LoginForm({
  googleEnabled = false,
}: {
  googleEnabled?: boolean;
}) {
  const t = useTranslations("Login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") ? t("googleError") : null,
  );
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(t("credentialsError"));
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-background">
      <div className="ambient-glow -top-24 -left-24" />
      <div className="ambient-glow right-[-10%] bottom-[-20%] opacity-60" />

      <div className="absolute top-4 end-4 z-20">
        <LanguageToggle />
      </div>

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

        <div className="mb-5 flex rounded-xl border border-border bg-background/60 p-1 text-sm">
          <span className="flex-1 rounded-lg bg-primary px-3 py-2 text-center font-medium text-primary-foreground">
            Sign in
          </span>
          <Link
            href="/signup"
            className="flex-1 rounded-lg px-3 py-2 text-center text-text-secondary transition hover:text-foreground"
          >
            <LogoMark size={48} animated />
            <div>
              <p className="text-lg font-bold tracking-tight">
                <span className="text-primary">AI</span> Knowledge Base
              </p>
              <p className="text-sm text-text-secondary">{t("brandTagline")}</p>
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
              {t("productIntro")}
            </motion.p>
            <motion.h1
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="text-4xl font-extrabold leading-tight tracking-tight text-foreground xl:text-[2.75rem]"
            >
              {t("headingBefore")}{" "}
              <span className="text-primary">{t("headingAccent")}</span>
            </motion.h1>
            <motion.p
              custom={2}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="text-base leading-relaxed text-text-secondary"
            >
              {t("body")}
            </motion.p>
            <motion.ul
              custom={3}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="space-y-2 text-sm text-text-secondary"
            >
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {t("bullet1")}
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {t("bullet2")}
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {t("bullet3")}
              </li>
            </motion.ul>
            <motion.p
              custom={4}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="text-xs font-medium tracking-wide text-text-secondary/80 uppercase"
            >
              {t("secureTagline")}
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
              {t("enterpriseWorkspace")}
            </p>
          </div>
        </div>

      <section className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="w-full max-w-md rounded-3xl border border-border bg-surface/90 p-5 shadow-xl shadow-primary/5 backdrop-blur sm:p-8"
        >
          <div className="mb-8 space-y-3 text-center lg:text-left">
            <div className="mx-auto flex justify-center lg:hidden">
              <LogoMark size={44} animated />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              {t("signInHeading")}
            </h2>
            <p className="text-sm text-text-secondary">{t("signInSubheading")}</p>
          </div>

          <div className="space-y-4">
            {googleEnabled ? (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={googleLoading || loading}
                onClick={() => {
                  setGoogleLoading(true);
                  setError(null);
                  void signIn("google", { callbackUrl });
                }}
              >
                <GoogleGlyph />
                {googleLoading ? t("redirectingGoogle") : t("continueWithGoogle")}
              </Button>
            ) : null}

            {googleEnabled ? (
              <div className="relative text-center text-xs text-text-secondary">
                <span className="relative z-10 bg-surface px-2">{t("orEmail")}</span>
                <div className="absolute inset-x-0 top-1/2 z-0 h-px bg-border" />
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="space-y-3">
              <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show">
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder={t("emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </motion.div>
              <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show">
                <Input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="current-password"
                  placeholder={t("passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </motion.div>
              {error ? (
                <p className="text-sm text-danger" role="alert">
                  {error}
                </p>
              ) : null}
              <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t("signingIn") : t("signIn")}
                </Button>
              </motion.div>
            </form>
          </div>
        </motion.div>
      </section>
    </main>
  );
}

function GoogleGlyph() {
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
