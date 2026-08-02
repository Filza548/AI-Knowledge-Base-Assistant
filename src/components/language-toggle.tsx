"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className }: { className?: string }) {
  const t = useTranslations("Language");
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const nextLocale = locale === "en" ? "ar" : "en";
  const query = searchParams.toString();
  const target = query ? `${pathname}?${query}` : pathname;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t("label")}
      title={t(nextLocale)}
      className={cn("text-foreground hover:bg-surface-muted", className)}
      onClick={() => router.replace(target, { locale: nextLocale })}
    >
      <span className="text-xs font-semibold uppercase">{nextLocale}</span>
    </Button>
  );
}
