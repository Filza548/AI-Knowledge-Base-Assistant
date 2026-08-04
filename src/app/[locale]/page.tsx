import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  redirect({ href: session ? "/dashboard" : "/login", locale });
}
