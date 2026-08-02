"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Settings,
  X,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandLockup, LogoMark } from "@/components/brand/logo-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { Badge } from "@/components/ui/badge";
import { useSidebar } from "@/components/sidebar/sidebar-context";

type AppSidebarProps = {
  email?: string | null;
  role?: string;
  name?: string | null;
};

export function AppSidebar({ email, role, name }: AppSidebarProps) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname();
  const { open, setOpen, toggle, isMobile } = useSidebar();

  const links = [
    {
      href: "/dashboard",
      label: t("dashboardLabel"),
      hint: t("dashboardHint"),
      icon: LayoutDashboard,
    },
    {
      href: "/document-workspace",
      label: t("documentsLabel"),
      hint: t("documentsHint"),
      icon: BookOpen,
    },
    {
      href: "/admin-settings",
      label: t("adminLabel"),
      hint: t("adminHint"),
      icon: Settings,
      adminOnly: true,
    },
  ];

  // Mobile: off-canvas drawer. Desktop: collapsible rail in-flow.
  const mobileHidden = isMobile && !open;
  const showLabels = isMobile || open;
  const isRtl = locale === "ar";

  return (
    <motion.aside
      initial={false}
      animate={
        isMobile
          ? { x: open ? 0 : isRtl ? "100%" : "-100%", width: 288 }
          : { x: 0, width: open ? 288 : 84 }
      }
      transition={{ type: "spring", stiffness: 360, damping: 34 }}
      className={cn(
        "z-50 flex h-dvh shrink-0 flex-col overflow-hidden border-e border-white/10 bg-sidebar text-sidebar-fg",
        isMobile
          ? "fixed inset-y-0 start-0 shadow-2xl"
          : "sticky top-0",
        mobileHidden && "pointer-events-none",
      )}
      aria-hidden={mobileHidden}
    >
      <div
        className={cn(
          "flex items-center border-b border-white/10 py-5",
          showLabels ? "justify-between gap-2 px-4" : "flex-col gap-3 px-2",
        )}
      >
        {showLabels ? (
          <BrandLockup size={40} inverted subtitle={t("sidebarSubtitle")} />
        ) : (
          <LogoMark size={36} />
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={open ? t("closeSidebar") : t("openSidebar")}
          className="shrink-0 text-sidebar-fg hover:bg-white/10 hover:text-white"
        >
          {isMobile ? (
            <X className="h-4 w-4" />
          ) : open ? (
            isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
          ) : isRtl ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className={cn("px-3 pt-4", !showLabels && "px-2")}>
        <AnimatePresence initial={false}>
          {showLabels ? (
            <motion.div
              key="intro"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3"
            >
              <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
                {t("workspace")}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {name ? t("greeting", { name: name.split(" ")[0] }) : t("greetingFallback")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-sidebar-fg/60">
                {t("sidebarDescription")}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {showLabels ? (
          <p className="mb-1 px-2 text-[10px] font-semibold tracking-[0.18em] text-sidebar-fg/40 uppercase">
            {t("navigate")}
          </p>
        ) : null}
        {links
          .filter((link) => !link.adminOnly || role === "admin")
          .map((link) => {
            const Icon = link.icon;
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                title={link.label}
                onClick={() => {
                  if (isMobile) setOpen(false);
                }}
                className={cn(
                  "relative flex items-center rounded-xl transition-colors",
                  showLabels ? "gap-2.5 px-3 py-2.5" : "justify-center px-2 py-3",
                  active
                    ? "bg-primary/20 text-white"
                    : "text-sidebar-fg/70 hover:bg-white/5 hover:text-white",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute top-1.5 bottom-1.5 start-0 w-1 rounded-full bg-accent"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                ) : null}
                <Icon className="h-4 w-4 shrink-0" />
                {showLabels ? (
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{link.label}</span>
                    <span className="block truncate text-[11px] text-sidebar-fg/45">
                      {link.hint}
                    </span>
                  </span>
                ) : null}
              </Link>
            );
          })}
      </nav>

      <div
        className={cn(
          "mt-auto space-y-3 border-t border-white/10 pb-[max(1rem,env(safe-area-inset-bottom))]",
          showLabels ? "p-4" : "p-2",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2",
            showLabels ? "justify-between" : "flex-col",
          )}
        >
          {showLabels ? (
            <Badge className="border-white/10 bg-white/5 capitalize text-sidebar-fg/80">
              {role ?? t("roleFallback")}
            </Badge>
          ) : null}
          <div className="flex items-center gap-1">
            <LanguageToggle className="text-sidebar-fg hover:bg-white/10 hover:text-white" />
            <ThemeToggle />
          </div>
        </div>
        {showLabels ? (
          <p className="truncate text-xs text-sidebar-fg/55">{email}</p>
        ) : null}
        <Button
          variant="outline"
          size={showLabels ? "sm" : "icon"}
          className={cn(
            "border-white/15 bg-transparent text-sidebar-fg hover:bg-white/10 hover:text-white",
            showLabels && "w-full",
          )}
          onClick={() =>
            signOut({ callbackUrl: locale === "en" ? "/login" : `/${locale}/login` })
          }
          aria-label={t("signOut")}
        >
          <LogOut className="h-4 w-4" />
          {showLabels ? t("signOut") : null}
        </Button>
      </div>
    </motion.aside>
  );
}
