import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import SignupForm from "./signup-form";

export default async function SignupRoute() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  if (session?.user?.id) {
    redirect({ href: "/dashboard", locale });
    return null;
  }

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
