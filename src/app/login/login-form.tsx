"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogoMark } from "@/components/brand/logo-mark";
import { AuthShell, GoogleGlyph } from "@/components/auth/auth-shell";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    authErrorMessage(searchParams.get("error")),
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
      setError(
        "Invalid credentials, or your account is not active yet. Pending requests must be approved by an admin.",
      );
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <AuthShell>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-md rounded-3xl border border-border bg-surface/90 p-5 shadow-xl shadow-primary/5 backdrop-blur sm:p-8"
      >
        <div className="mb-6 space-y-3 text-center lg:text-left">
          <div className="mx-auto flex justify-center lg:hidden">
            <LogoMark size={44} animated />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
          <p className="text-sm text-text-secondary">
            Active accounts only. New here?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>{" "}
            to request access, or use an admin invite.
          </p>
        </div>

        <div className="mb-5 flex rounded-xl border border-border bg-background/60 p-1 text-sm">
          <span className="flex-1 rounded-lg bg-primary px-3 py-2 text-center font-medium text-primary-foreground">
            Sign in
          </span>
          <Link
            href="/signup"
            className="flex-1 rounded-lg px-3 py-2 text-center text-text-secondary transition hover:text-foreground"
          >
            Sign up
          </Link>
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
              {googleLoading ? "Redirecting to Google…" : "Continue with Google"}
            </Button>
          ) : null}

          {googleEnabled ? (
            <p className="text-center text-xs text-text-secondary">
              Google works only if an admin invited this email or already approved you.
            </p>
          ) : null}

          {googleEnabled ? (
            <div className="relative text-center text-xs text-text-secondary">
              <span className="relative z-10 bg-surface px-2">or email</span>
              <div className="absolute inset-x-0 top-1/2 -z-0 h-px bg-border" />
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </motion.div>
    </AuthShell>
  );
}
