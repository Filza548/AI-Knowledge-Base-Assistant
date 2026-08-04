"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogoMark } from "@/components/brand/logo-mark";
import { AuthShell, GoogleGlyph } from "@/components/auth/auth-shell";

export default function SignupForm({
  googleEnabled = false,
}: {
  googleEnabled?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite")?.trim() ?? "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(Boolean(inviteToken));
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteToken) {
      setInviteLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/invite?token=${encodeURIComponent(inviteToken)}`,
        );
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? "Invalid invite");
        }
        if (cancelled) return;
        setName(json.invite?.name ?? "");
        setEmail(json.invite?.email ?? "");
        setInviteEmail(json.invite?.email ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Invalid invite");
        }
      } finally {
        if (!cancelled) setInviteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (inviteToken) {
        const res = await fetch("/api/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: inviteToken,
            name,
            password,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Could not accept invite");

        const signInResult = await signIn("credentials", {
          email: email || inviteEmail,
          password,
          redirect: false,
        });
        if (signInResult?.error) {
          setSuccess("Invite accepted. Please sign in.");
          router.push("/login");
          return;
        }
        router.push("/dashboard");
        router.refresh();
        return;
      }

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Could not submit request");

      setSuccess(
        json.message ??
          "Request submitted. An admin will review your access.",
      );
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const isInvite = Boolean(inviteToken);

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
          <h2 className="text-2xl font-bold tracking-tight">
            {isInvite ? "Accept invite" : "Sign up"}
          </h2>
          <p className="text-sm text-text-secondary">
            {isInvite
              ? "Set a password to activate your account, or continue with Google using the invited email."
              : "Request access. An admin must approve before you can use the app."}
          </p>
        </div>

        {!isInvite ? (
          <div className="mb-5 flex rounded-xl border border-border bg-background/60 p-1 text-sm">
            <Link
              href="/login"
              className="flex-1 rounded-lg px-3 py-2 text-center text-text-secondary transition hover:text-foreground"
            >
              Sign in
            </Link>
            <span className="flex-1 rounded-lg bg-primary px-3 py-2 text-center font-medium text-primary-foreground">
              Sign up
            </span>
          </div>
        ) : null}

        {inviteLoading ? (
          <p className="text-sm text-text-secondary">Loading invite…</p>
        ) : (
          <div className="space-y-4">
            {isInvite && googleEnabled ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  disabled={googleLoading || loading || Boolean(error && !inviteEmail)}
                  onClick={() => {
                    setGoogleLoading(true);
                    setError(null);
                    void signIn("google", { callbackUrl: "/dashboard" });
                  }}
                >
                  <GoogleGlyph />
                  {googleLoading
                    ? "Redirecting to Google…"
                    : "Continue with Google"}
                </Button>
                <div className="relative text-center text-xs text-text-secondary">
                  <span className="relative z-10 bg-surface px-2">
                    or set a password
                  </span>
                  <div className="absolute inset-x-0 top-1/2 -z-0 h-px bg-border" />
                </div>
              </>
            ) : null}

            <form onSubmit={onSubmit} className="space-y-3">
              <Input
                placeholder="Full name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
              <Input
                type="email"
                required
                autoComplete="email"
                placeholder="Work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isInvite}
              />
              <Input
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                placeholder="Password (min 10, mixed case + number)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error ? (
                <p className="text-sm text-danger" role="alert">
                  {error}
                </p>
              ) : null}
              {success ? (
                <p className="text-sm text-accent" role="status">
                  {success}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={loading || Boolean(error && isInvite && !inviteEmail)}>
                {loading
                  ? isInvite
                    ? "Activating…"
                    : "Submitting…"
                  : isInvite
                    ? "Activate account"
                    : "Request access"}
              </Button>
            </form>

            <p className="text-center text-sm text-text-secondary">
              Already approved?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        )}
      </motion.div>
    </AuthShell>
  );
}
