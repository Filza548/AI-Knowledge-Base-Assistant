import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import SignupForm from "./signup-form";

export default async function SignupRoute() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

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
      <SignupForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
