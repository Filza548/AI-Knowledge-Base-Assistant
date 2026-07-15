import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LoginForm from "./login-form";

export default async function LoginRoute() {
  const session = await auth();
  if (session) redirect("/dashboard");

  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background text-text-secondary">
          Loading…
        </main>
      }
    >
      <LoginForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
