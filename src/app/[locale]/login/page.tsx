import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import LoginForm from "./login-form";

export default async function LoginRoute() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  if (session) redirect({ href: "/dashboard", locale });

  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
  const t = await getTranslations("Login");

  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background text-text-secondary">
          {t("loading")}
        </main>
      }
    >
      <LoginForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
