import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginRoute() {
  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-700">
          Loading…
        </main>
      }
    >
      <LoginForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
