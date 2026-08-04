"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Error");

  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
        {t("eyebrow")}
      </p>
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p className="text-sm text-text-secondary" role="alert">
        {error.message || t("fallbackMessage")}
      </p>
      <Button type="button" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
