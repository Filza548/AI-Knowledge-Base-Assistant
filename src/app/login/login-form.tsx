"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginForm({
  googleEnabled = false,
}: {
  googleEnabled?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      setError("Invalid email or password");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-200 via-zinc-100 to-white px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <Shield className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            AI Knowledge Assistant — sign in to your secure workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {googleEnabled ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => signIn("google", { callbackUrl })}
            >
              Continue with Google
            </Button>
          ) : null}

          {googleEnabled ? (
            <div className="relative text-center text-xs text-zinc-400">
              <span className="bg-white px-2">or email</span>
              <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-zinc-200" />
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
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
